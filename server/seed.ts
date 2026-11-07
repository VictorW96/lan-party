import { readFileSync } from 'node:fs';
import { config } from './config.ts';
import { db, getSetting, setSetting } from './db.ts';
import { enrichGame } from './enrich.ts';

type SeedGame = {
  name: string;
  category: 'classic' | 'newcomer';
  /** Seed version that introduced the game; later versions are added to databases that already exist. */
  since?: number;
  price?: string;
  steam_appid?: number;
  store_url?: string;
  /** Paths starting with "/" are served by this app and get the base path prefixed. */
  image_url?: string;
  hero_url?: string;
  screenshots?: string[];
  max_players?: number;
  modes?: string[];
  tags?: string[];
  note?: string;
  questionable?: boolean;
  questionable_reason?: string;
  description: string;
};

const localUrl = (url: string | undefined) => (url?.startsWith('/') ? `${config.basePath}${url}` : (url ?? null));

/**
 * Inserts the starting game list. A fresh database gets every game; an existing one only
 * gets games from seed versions it has not seen yet, so games deleted by an admin stay deleted.
 */
export function seedGames(): void {
  const seed = JSON.parse(readFileSync(new URL('./seed/games.json', import.meta.url), 'utf8')) as SeedGame[];
  const latest = Math.max(...seed.map((g) => g.since ?? 1));
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number };
  const applied = Number(getSetting('seed_version', n > 0 ? '1' : '0'));
  if (applied >= latest) return;

  const exists = db.prepare('SELECT 1 FROM games WHERE lower(name) = lower(?) OR (steam_appid IS NOT NULL AND steam_appid = ?)');
  const insert = db.prepare(
    `INSERT INTO games (name, category, price, steam_appid, store_url, image_url, hero_url, screenshots, max_players, modes,
                        tags, note, questionable, questionable_reason, description, enrich_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  );
  const ids = seed
    .filter((g) => (g.since ?? 1) > applied && !exists.get(g.name, g.steam_appid ?? null))
    .map(
      (g) =>
        insert.run(
          g.name,
          g.category,
          g.price ?? null,
          g.steam_appid ?? null,
          g.store_url ?? null,
          localUrl(g.image_url),
          localUrl(g.hero_url),
          JSON.stringify((g.screenshots ?? []).map(localUrl)),
          g.max_players ?? null,
          JSON.stringify(g.modes ?? []),
          JSON.stringify(g.tags ?? []),
          g.note ?? null,
          g.questionable ? 1 : 0,
          g.questionable_reason ?? null,
          g.description,
        ).lastInsertRowid as number,
    );
  setSetting('seed_version', String(latest));
  if (!ids.length) return;
  console.log(`${ids.length} Spiele aus der Startliste angelegt, hole Bilder …`);

  void (async () => {
    for (const id of ids) await enrichGame(id, { curated: true });
    console.log('Startspiele angereichert.');
  })();
}
