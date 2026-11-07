import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  checkRateLimit,
  clientIp,
  createInvite,
  endSession,
  hashPassword,
  inviteUrl,
  loadUser,
  pickColor,
  requireAdmin,
  requireUser,
  startSession,
  validateName,
  validatePassword,
  verifyPassword,
  type AppEnv,
} from './auth.ts';
import { config } from './config.ts';
import { db, getSetting, setSetting, transaction } from './db.ts';
import { enrichGame } from './enrich.ts';
import { rankGames, type Category } from './ranking.ts';
import { parseSteamAppId, searchSteam } from './steam.ts';
import { voteLimitError } from './votes.ts';

type GameRow = {
  id: number;
  name: string;
  category: Category;
  questionable: number;
  questionable_reason: string | null;
  note: string | null;
  price: string | null;
  description: string | null;
  image_url: string | null;
  hero_url: string | null;
  screenshots: string;
  steam_appid: number | null;
  store_url: string | null;
  max_players: number | null;
  modes: string;
  tags: string;
  release_info: string | null;
  enrich_status: string;
  added_by: number | null;
  added_by_name: string | null;
  votes: number;
};

export const api = new Hono<AppEnv>();
api.use('*', loadUser);

/** Mutations must be JSON, which a cross-site form cannot send – a cheap CSRF guard on top of SameSite cookies. */
api.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && !c.req.header('content-type')?.includes('application/json'))
    throw new HTTPException(415, { message: 'Erwarte JSON.' });
  await next();
});

async function body<T>(c: { req: { json: () => Promise<unknown> } }): Promise<Partial<T>> {
  try {
    return ((await c.req.json()) ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}

function settings() {
  return {
    votingOpen: getSetting('voting_open', '1') === '1',
    eventDate: getSetting('event_date', ''),
    maxVotes: config.maxVotes,
    maxVotesPerGame: config.maxVotesPerGame,
    maxClassicVotes: config.maxClassicVotes,
    minPlayers: config.minPlayers,
    aiEnrichment: config.aiEnrichment,
  };
}

// ---------------------------------------------------------------- auth

api.get('/me', (c) => c.json({ user: c.get('user') }));

api.post('/auth/login', async (c) => {
  checkRateLimit(`login:${clientIp(c)}`);
  const { name, password } = await body<{ name: string; password: string }>(c);
  const user = db.prepare('SELECT id, password_hash FROM users WHERE name = ?').get(String(name ?? '').trim()) as
    | { id: number; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(String(password ?? ''), user.password_hash))
    throw new HTTPException(401, { message: 'Name oder Passwort falsch.' });
  startSession(c, user.id);
  return c.json({ ok: true });
});

api.post('/auth/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

type InviteRow = { code: string; label: string; is_admin: number; reset_user_id: number | null; used_by: number | null; reset_name: string | null };
function findInvite(code: string): InviteRow {
  const invite = db
    .prepare(
      `SELECT i.code, i.label, i.is_admin, i.reset_user_id, i.used_by, u.name AS reset_name
       FROM invites i LEFT JOIN users u ON u.id = i.reset_user_id WHERE i.code = ?`,
    )
    .get(code) as InviteRow | undefined;
  if (!invite || invite.used_by) throw new HTTPException(404, { message: 'Dieser Einladungslink ist ungültig oder wurde schon benutzt.' });
  return invite;
}

api.get('/invites/:code', (c) => {
  checkRateLimit(`invite:${clientIp(c)}`, 30);
  const invite = findInvite(c.req.param('code'));
  return c.json({ label: invite.label, isAdmin: Boolean(invite.is_admin), resetName: invite.reset_name, maxVotes: config.maxVotes });
});

api.post('/invites/:code', async (c) => {
  checkRateLimit(`invite:${clientIp(c)}`, 30);
  const invite = findInvite(c.req.param('code'));
  const input = await body<{ name: string; password: string }>(c);
  const password = validatePassword(input.password);

  const userId = transaction(() => {
    let id: number;
    if (invite.reset_user_id) {
      id = invite.reset_user_id;
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    } else {
      const name = validateName(input.name);
      if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name))
        throw new HTTPException(409, { message: 'Diesen Namen gibt es schon.' });
      id = db
        .prepare('INSERT INTO users (name, password_hash, is_admin, color) VALUES (?, ?, ?, ?)')
        .run(name, hashPassword(password), invite.is_admin, pickColor()).lastInsertRowid as number;
    }
    db.prepare("UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE code = ?").run(id, invite.code);
    return id;
  });
  startSession(c, userId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- board

function loadBoard(userId: number) {
  const rows = db
    .prepare(
      `SELECT g.*, u.name AS added_by_name, COALESCE((SELECT SUM(count) FROM votes v WHERE v.game_id = g.id), 0) AS votes
       FROM games g LEFT JOIN users u ON u.id = g.added_by`,
    )
    .all() as GameRow[];
  const voters = db
    .prepare('SELECT v.game_id, v.count, u.id, u.name, u.color FROM votes v JOIN users u ON u.id = v.user_id ORDER BY u.name')
    .all() as { game_id: number; count: number; id: number; name: string; color: string }[];
  const thumbsDown = db
    .prepare('SELECT t.game_id, u.id, u.name, u.color FROM thumbs_down t JOIN users u ON u.id = t.user_id ORDER BY u.name')
    .all() as { game_id: number; id: number; name: string; color: string }[];

  const games = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    questionable: Boolean(r.questionable),
    questionableReason: r.questionable_reason,
    note: r.note,
    price: r.price,
    description: r.description,
    imageUrl: r.image_url,
    heroUrl: r.hero_url,
    screenshots: JSON.parse(r.screenshots) as string[],
    steamAppId: r.steam_appid,
    storeUrl: r.store_url,
    maxPlayers: r.max_players,
    modes: JSON.parse(r.modes) as string[],
    tags: JSON.parse(r.tags) as string[],
    releaseInfo: r.release_info,
    enrichStatus: r.enrich_status,
    addedBy: r.added_by_name,
    addedById: r.added_by,
    votes: r.votes,
    voters: voters.filter((v) => v.game_id === r.id).map(({ id, name, color, count }) => ({ id, name, color, count })),
    myVotes: voters.find((v) => v.game_id === r.id && v.id === userId)?.count ?? 0,
    thumbsDown: thumbsDown.filter((t) => t.game_id === r.id).map(({ id, name, color }) => ({ id, name, color })),
    myThumbsDown: thumbsDown.some((t) => t.game_id === r.id && t.id === userId),
  }));

  const { players } = db.prepare('SELECT COUNT(*) AS players FROM users').get() as { players: number };
  const { voted } = db.prepare('SELECT COUNT(DISTINCT user_id) AS voted FROM votes').get() as { voted: number };
  return { games: rankGames(games), settings: settings(), stats: { players, voted } };
}

api.get('/board', (c) => {
  const user = requireUser(c);
  return c.json(loadBoard(user.id));
});

api.put('/games/:id/vote', async (c) => {
  const user = requireUser(c);
  const gameId = Number(c.req.param('id'));
  const { count } = await body<{ count: number }>(c);
  const wanted = Number(count);
  if (!settings().votingOpen) throw new HTTPException(423, { message: 'Die Abstimmung ist geschlossen.' });

  transaction(() => {
    const game = db.prepare('SELECT category FROM games WHERE id = ?').get(gameId) as { category: Category } | undefined;
    if (!game) throw new HTTPException(404, { message: 'Spiel nicht gefunden.' });
    const { used, classic } = db
      .prepare(
        `SELECT COALESCE(SUM(v.count), 0) AS used,
                COALESCE(SUM(CASE WHEN g.category = 'classic' THEN v.count END), 0) AS classic
         FROM votes v JOIN games g ON g.id = v.game_id WHERE v.user_id = ? AND v.game_id != ?`,
      )
      .get(user.id, gameId) as { used: number; classic: number };
    const error = voteLimitError(config, game, wanted, used, classic);
    if (error) throw new HTTPException(409, { message: error });
    if (wanted === 0) db.prepare('DELETE FROM votes WHERE user_id = ? AND game_id = ?').run(user.id, gameId);
    else {
      db.prepare(
        'INSERT INTO votes (user_id, game_id, count) VALUES (?, ?, ?) ON CONFLICT(user_id, game_id) DO UPDATE SET count = excluded.count',
      ).run(user.id, gameId, wanted);
      // Voting for a game takes back your thumbs down on it.
      db.prepare('DELETE FROM thumbs_down WHERE user_id = ? AND game_id = ?').run(user.id, gameId);
    }
  });
  return c.json(loadBoard(user.id));
});

api.put('/games/:id/thumbs-down', async (c) => {
  const user = requireUser(c);
  const gameId = Number(c.req.param('id'));
  const { on } = await body<{ on: boolean }>(c);
  if (!settings().votingOpen) throw new HTTPException(423, { message: 'Die Abstimmung ist geschlossen.' });

  transaction(() => {
    if (!db.prepare('SELECT 1 FROM games WHERE id = ?').get(gameId)) throw new HTTPException(404, { message: 'Spiel nicht gefunden.' });
    if (on === true) {
      db.prepare('INSERT OR IGNORE INTO thumbs_down (user_id, game_id) VALUES (?, ?)').run(user.id, gameId);
      // A thumbs down frees the votes you had on that game.
      db.prepare('DELETE FROM votes WHERE user_id = ? AND game_id = ?').run(user.id, gameId);
    } else db.prepare('DELETE FROM thumbs_down WHERE user_id = ? AND game_id = ?').run(user.id, gameId);
  });
  return c.json(loadBoard(user.id));
});

// ---------------------------------------------------------------- games

api.get('/steam/search', async (c) => {
  requireUser(c);
  const q = c.req.query('q')?.trim() ?? '';
  if (q.length < 2) return c.json({ results: [] });
  try {
    return c.json({ results: await searchSteam(q) });
  } catch {
    return c.json({ results: [] });
  }
});

type GameInput = {
  name: string;
  category: Category;
  steam: string;
  storeUrl: string;
  imageUrl: string;
  price: string;
  note: string;
  questionable: boolean;
  questionableReason: string;
  description: string;
  maxPlayers: number | null;
};

const clean = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const cleanUrl = (v: unknown) => {
  const s = clean(v, 1000);
  return s && /^https?:\/\//i.test(s) ? s : null;
};
const isCategory = (v: unknown): v is Category => v === 'classic' || v === 'newcomer';

api.post('/games', async (c) => {
  const user = requireUser(c);
  const input = await body<GameInput>(c);
  const name = clean(input.name, 80);
  if (!name) throw new HTTPException(400, { message: 'Wie heißt das Spiel?' });
  if (!isCategory(input.category)) throw new HTTPException(400, { message: 'Klassiker oder Newcomer?' });
  const appid = input.steam ? parseSteamAppId(String(input.steam)) : null;

  const duplicate = db
    .prepare('SELECT name FROM games WHERE lower(name) = lower(?) OR (steam_appid IS NOT NULL AND steam_appid = ?)')
    .get(name, appid) as { name: string } | undefined;
  if (duplicate) throw new HTTPException(409, { message: `"${duplicate.name}" steht schon auf der Liste.` });

  const id = db
    .prepare(
      `INSERT INTO games (name, category, steam_appid, store_url, image_url, price, note, questionable, questionable_reason, added_by, enrich_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      name,
      input.category,
      appid,
      cleanUrl(input.storeUrl),
      cleanUrl(input.imageUrl),
      clean(input.price, 20),
      clean(input.note, 120),
      input.questionable ? 1 : 0,
      input.questionable ? clean(input.questionableReason, 160) : null,
      user.id,
    ).lastInsertRowid as number;

  void enrichGame(id, { ai: true });
  return c.json({ id });
});

function canEdit(user: { id: number; is_admin: number }, gameId: number): boolean {
  if (user.is_admin) return true;
  const game = db.prepare('SELECT added_by FROM games WHERE id = ?').get(gameId) as { added_by: number | null } | undefined;
  return game?.added_by === user.id;
}

api.patch('/games/:id', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!canEdit(user, id)) throw new HTTPException(403, { message: 'Nur wer das Spiel hinzugefügt hat (oder ein Admin) darf es bearbeiten.' });
  const input = await body<GameInput>(c);

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = clean(input.name, 80) ?? undefined;
  if (input.category !== undefined && isCategory(input.category)) updates.category = input.category;
  if (input.price !== undefined) updates.price = clean(input.price, 20);
  if (input.note !== undefined) updates.note = clean(input.note, 120);
  if (input.description !== undefined) updates.description = clean(input.description, 1000);
  if (input.imageUrl !== undefined) updates.image_url = cleanUrl(input.imageUrl);
  if (input.storeUrl !== undefined) updates.store_url = cleanUrl(input.storeUrl);
  if (input.maxPlayers !== undefined)
    updates.max_players = input.maxPlayers === null || input.maxPlayers === ('' as unknown) ? null : Math.max(1, Math.round(Number(input.maxPlayers)) || 1);
  if (input.questionable !== undefined) {
    updates.questionable = input.questionable ? 1 : 0;
    updates.questionable_reason = input.questionable ? clean(input.questionableReason, 160) : null;
  }
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (entries.length) {
    db.prepare(`UPDATE games SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...(entries.map(([, v]) => v) as (string | number | null)[]),
      id,
    );
  }
  return c.json({ ok: true });
});

api.post('/games/:id/enrich', (c) => {
  requireAdmin(c);
  const id = Number(c.req.param('id'));
  // Re-fetch from scratch: clear the automatically filled fields first.
  db.prepare(
    "UPDATE games SET description = NULL, image_url = NULL, hero_url = NULL, screenshots = '[]', modes = '[]', tags = '[]', max_players = NULL WHERE id = ?",
  ).run(id);
  void enrichGame(id, { ai: true });
  return c.json({ ok: true });
});

api.delete('/games/:id', (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!canEdit(user, id)) throw new HTTPException(403, { message: 'Nur wer das Spiel hinzugefügt hat (oder ein Admin) darf es löschen.' });
  db.prepare('DELETE FROM games WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- admin

api.get('/admin', (c) => {
  requireAdmin(c);
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.is_admin AS isAdmin, u.color, u.created_at AS createdAt,
              COALESCE((SELECT SUM(count) FROM votes v WHERE v.user_id = u.id), 0) AS votesUsed
       FROM users u ORDER BY u.created_at`,
    )
    .all();
  const invites = (
    db
      .prepare(
        `SELECT i.code, i.label, i.is_admin AS isAdmin, i.created_at AS createdAt, u.name AS resetName
         FROM invites i LEFT JOIN users u ON u.id = i.reset_user_id WHERE i.used_by IS NULL ORDER BY i.created_at DESC`,
      )
      .all() as { code: string }[]
  ).map((i) => ({ ...i, url: inviteUrl(i.code) }));
  return c.json({ users, invites, settings: settings() });
});

api.post('/admin/invites', async (c) => {
  const admin = requireAdmin(c);
  const { label, isAdmin } = await body<{ label: string; isAdmin: boolean }>(c);
  const code = createInvite(clean(label, 40) ?? 'Freund', { isAdmin: Boolean(isAdmin), createdBy: admin.id });
  return c.json({ url: inviteUrl(code) });
});

api.delete('/admin/invites/:code', (c) => {
  requireAdmin(c);
  db.prepare('DELETE FROM invites WHERE code = ? AND used_by IS NULL').run(c.req.param('code'));
  return c.json({ ok: true });
});

api.post('/admin/users/:id/reset', (c) => {
  const admin = requireAdmin(c);
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(Number(c.req.param('id'))) as { id: number; name: string } | undefined;
  if (!user) throw new HTTPException(404, { message: 'Unbekannter Account.' });
  const code = createInvite(`Passwort-Reset ${user.name}`, { resetUserId: user.id, createdBy: admin.id });
  return c.json({ url: inviteUrl(code) });
});

api.delete('/admin/users/:id', (c) => {
  const admin = requireAdmin(c);
  const id = Number(c.req.param('id'));
  if (id === admin.id) throw new HTTPException(400, { message: 'Du kannst dich nicht selbst löschen.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return c.json({ ok: true });
});

api.put('/admin/settings', async (c) => {
  requireAdmin(c);
  const input = await body<{ votingOpen: boolean; eventDate: string }>(c);
  if (input.votingOpen !== undefined) setSetting('voting_open', input.votingOpen ? '1' : '0');
  if (input.eventDate !== undefined) setSetting('event_date', clean(input.eventDate, 40) ?? '');
  return c.json({ settings: settings() });
});

api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Da ist was schiefgelaufen.' }, 500);
});
