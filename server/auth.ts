import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { config } from './config.ts';
import { db } from './db.ts';

export type User = { id: number; name: string; is_admin: number; color: string };
export type AppEnv = { Variables: { user: User | null } };

const COOKIE = 'lp_session';
const SESSION_DAYS = 180;
const AVATAR_COLORS = ['#ff4d6d', '#ffb703', '#2ec4b6', '#8338ec', '#3a86ff', '#fb5607', '#06d6a0', '#ff70a6', '#70d6ff', '#c3f73a'];

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function randomCode(bytes = 12): string {
  return randomBytes(bytes).toString('base64url');
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function pickColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
}

export function startSession(c: Context, userId: number): void {
  const token = randomCode(32);
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  setCookie(c, COOKIE, token, {
    path: config.basePath || '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.secureCookies,
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function endSession(c: Context): void {
  const token = getCookie(c, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  deleteCookie(c, COOKIE, { path: config.basePath || '/' });
}

export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  let user: User | null = null;
  if (token) {
    user =
      (db
        .prepare(
          `SELECT u.id, u.name, u.is_admin, u.color FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?`,
        )
        .get(sha256(token), Date.now()) as User | undefined) ?? null;
  }
  c.set('user', user);
  await next();
};

export function requireUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'Bitte zuerst einloggen.' });
  return user;
}

export function requireAdmin(c: Context<AppEnv>): User {
  const user = requireUser(c);
  if (!user.is_admin) throw new HTTPException(403, { message: 'Nur für Admins.' });
  return user;
}

/** Tiny in-memory limiter so nobody can brute-force a friend's password. */
const attempts = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(key: string, limit = 10, windowMs = 15 * 60_000): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) throw new HTTPException(429, { message: 'Zu viele Versuche. Probier es in ein paar Minuten nochmal.' });
}

export function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

export function validateName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 2 || trimmed.length > 24) throw new HTTPException(400, { message: 'Name muss 2–24 Zeichen lang sein.' });
  return trimmed;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6)
    throw new HTTPException(400, { message: 'Passwort muss mindestens 6 Zeichen haben.' });
  return password;
}

/** Creates a single-use invite link. `resetUserId` turns it into a password-reset link for an existing account. */
export function createInvite(label: string, opts: { isAdmin?: boolean; resetUserId?: number; createdBy?: number } = {}): string {
  const code = randomCode(12);
  db.prepare('INSERT INTO invites (code, label, is_admin, reset_user_id, created_by) VALUES (?, ?, ?, ?, ?)').run(
    code,
    label,
    opts.isAdmin ? 1 : 0,
    opts.resetUserId ?? null,
    opts.createdBy ?? null,
  );
  return code;
}

export const inviteUrl = (code: string) => `${config.publicUrl}/invite/${code}`;

/** On a fresh install there is nobody who could invite anyone, so print an admin invite to the log. */
export function ensureAdminInvite(): void {
  const hasAdmin = db.prepare('SELECT 1 FROM users WHERE is_admin = 1').get();
  if (hasAdmin) return;
  const open = db.prepare('SELECT code FROM invites WHERE is_admin = 1 AND used_by IS NULL').get() as { code: string } | undefined;
  const code = open?.code ?? createInvite('Admin', { isAdmin: true });
  console.log(`\n  ★ Noch kein Admin vorhanden. Admin-Account anlegen über:\n    ${inviteUrl(code)}\n`);
}
