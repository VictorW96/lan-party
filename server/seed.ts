import { readFileSync } from 'node:fs';
import { db } from './db.ts';
import { enrichGame } from './enrich.ts';

type SeedGame = {
  name: string;
  category: 'classic' | 'newcomer';
  price?: string;
  steam_appid?: number;
  store_url?: string;
  max_players?: number;
  modes?: string[];
  tags?: string[];
  note?: string;
  questionable?: boolean;
  questionable_reason?: string;
  description: string;
};

/** Inserts the starting game list on a fresh database and pulls images from Steam in the background. */
export function seedGames(): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number };
  if (n > 0) return;

  const seed = JSON.parse(readFileSync(new URL('./seed/games.json', import.meta.url), 'utf8')) as SeedGame[];
  const insert = db.prepare(
    `INSERT INTO games (name, category, price, steam_appid, store_url, max_players, modes, tags, note,
                        questionable, questionable_reason, description, enrich_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  );
  const ids = seed.map(
    (g) =>
      insert.run(
        g.name,
        g.category,
        g.price ?? null,
        g.steam_appid ?? null,
        g.store_url ?? null,
        g.max_players ?? null,
        JSON.stringify(g.modes ?? []),
        JSON.stringify(g.tags ?? []),
        g.note ?? null,
        g.questionable ? 1 : 0,
        g.questionable_reason ?? null,
        g.description,
      ).lastInsertRowid as number,
  );
  console.log(`${ids.length} Startspiele angelegt, hole Bilder von Steam …`);

  void (async () => {
    for (const id of ids) await enrichGame(id, { curated: true });
    console.log('Startspiele angereichert.');
  })();
}
