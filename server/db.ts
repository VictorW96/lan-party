import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE ?? join(config.dataDir, 'lanparty.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    color         TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    code          TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    reset_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_at       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id                  INTEGER PRIMARY KEY,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL CHECK (category IN ('classic', 'newcomer')),
    questionable        INTEGER NOT NULL DEFAULT 0,
    questionable_reason TEXT,
    note                TEXT,
    price               TEXT,
    description         TEXT,
    image_url           TEXT,
    hero_url            TEXT,
    screenshots         TEXT NOT NULL DEFAULT '[]',
    steam_appid         INTEGER UNIQUE,
    store_url           TEXT,
    max_players         INTEGER,
    modes               TEXT NOT NULL DEFAULT '[]',
    tags                TEXT NOT NULL DEFAULT '[]',
    release_info        TEXT,
    enrich_status       TEXT NOT NULL DEFAULT 'done',
    enrich_source       TEXT,
    added_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    count   INTEGER NOT NULL CHECK (count > 0),
    PRIMARY KEY (user_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getSetting(key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}

/** Runs `fn` inside a write transaction. node:sqlite is synchronous, so nothing else interleaves. */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
