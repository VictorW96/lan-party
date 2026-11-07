import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.ts';
import { db } from './db.ts';
import { getSteamDetails, playerCountFromText, type SteamDetails } from './steam.ts';

type GameRow = {
  id: number;
  name: string;
  category: string;
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
};

type AiAssessment = {
  description_de: string;
  max_players: number | null;
  lan: boolean;
  online: boolean;
  coop: boolean;
  pvp: boolean;
  questionable: boolean;
  questionable_reason: string;
  price_eur: string;
  tags: string[];
};

const nullableInt = { anyOf: [{ type: 'integer' }, { type: 'null' }] };
const ASSESSMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['description_de', 'max_players', 'lan', 'online', 'coop', 'pvp', 'questionable', 'questionable_reason', 'price_eur', 'tags'],
  properties: {
    description_de: {
      type: 'string',
      description:
        '2–3 sachliche deutsche Sätze: worum geht es, was macht man in der Gruppe konkret. Kurze Hauptsätze. Keine Gedankenstriche, keine Ausrufezeichen, keine Werbesprache oder Schlagworte wie "Pflichtprogramm", "Garant", "der ultimative", "schlechthin".',
    },
    max_players: { ...nullableInt, description: 'Maximale Spielerzahl in EINER gemeinsamen Partie (inkl. Dedicated Server), null wenn unbekannt.' },
    lan: { type: 'boolean', description: 'Im LAN oder per selbst gehostetem/Dedicated Server spielbar.' },
    online: { type: 'boolean' },
    coop: { type: 'boolean' },
    pvp: { type: 'boolean' },
    questionable: { type: 'boolean', description: 'true, wenn unklar ist, ob die ganze Gruppe zusammen spielen kann.' },
    questionable_reason: { type: 'string', description: 'Kurzer deutscher Grund, leer wenn nicht fraglich.' },
    price_eur: { type: 'string', description: 'Aktueller Preis gerundet, z. B. "0€", "15€" oder "2–20€".' },
    tags: { type: 'array', items: { type: 'string' }, description: '2–4 kurze deutsche Genre-Tags.' },
  },
};

const SYSTEM = `Du recherchierst Spiele für eine LAN-Party unter Freunden im "House of Gaming" in Miesbach.
Ein Spiel ist geeignet, wenn mindestens ${config.minPlayers} Leute GEMEINSAM in einer Partie spielen können
(LAN, eigener/Dedicated Server oder online in einer gemeinsamen Lobby). Nutze die Websuche, um Spielerzahl und
Multiplayer-Optionen zu prüfen. Markiere ein Spiel als fraglich, wenn es weniger als ${config.minPlayers} Spieler
unterstützt, noch nicht erschienen ist, keine gemeinsamen Lobbys/Server erlaubt oder die Server abgeschaltet wurden.
Antworte ausschließlich im vorgegebenen JSON-Format.`;

async function assessWithClaude(name: string, steam: SteamDetails | null, hint: string | null): Promise<AiAssessment | null> {
  const client = new Anthropic();
  const facts = steam
    ? `Steam-Daten: ${JSON.stringify({
        name: steam.name,
        beschreibung: steam.description,
        modi: steam.modes,
        genres: steam.tags,
        preis: steam.price,
        release: steam.releaseInfo,
        erscheintBald: steam.comingSoon,
      })}`
    : 'Das Spiel ist nicht auf Steam (oder wurde dort nicht gefunden).';
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Spiel: ${name}\n${hint ? `Hinweis vom Vorschlagenden: ${hint}\n` : ''}${facts}` },
  ];

  for (let turn = 0; turn < 4; turn++) {
    // `fallbacks: "default"` lets the API retry a safety-declined request on its recommended fallback model.
    const response = await client.beta.messages.create({
      model: config.anthropicModel,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ASSESSMENT_SCHEMA } },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
      messages,
    });

    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (response.stop_reason === 'refusal') return null;

    const texts = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text);
    const last = texts.at(-1);
    if (!last) return null;
    try {
      return JSON.parse(last) as AiAssessment;
    } catch {
      return JSON.parse(texts.join('')) as AiAssessment;
    }
  }
  return null;
}

type PageMeta = { image: string | null; description: string | null };

/** Reads og:image / og:description from a game's website, for games that are not on Steam. */
async function fetchPageMeta(url: string): Promise<PageMeta> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; LanPartyVote/1.0)', accept: 'text/html' },
  });
  if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) return { image: null, description: null };
  const html = (await res.text()).slice(0, 500_000);
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1] ??
    null;
  const image = meta('og:image') ?? meta('twitter:image');
  return {
    image: image ? new URL(image.replace(/&amp;/g, '&'), url).href : null,
    description: meta('og:description') ?? meta('description'),
  };
}

const parseList = (json: string): string[] => {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
};

/**
 * Fills in images, description, player count and multiplayer modes. Only empty fields are
 * filled, so anything a person typed in stays. `curated` games (the seed list) never get
 * their "fraglich" flag changed automatically.
 */
export async function enrichGame(gameId: number, opts: { ai?: boolean; curated?: boolean } = {}): Promise<void> {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as GameRow | undefined;
  if (!game) return;
  db.prepare("UPDATE games SET enrich_status = 'pending' WHERE id = ?").run(gameId);

  try {
    const steam = game.steam_appid ? await getSteamDetails(game.steam_appid) : null;
    let page: PageMeta | null = null;
    if (!steam && game.store_url && (!game.image_url || !game.description)) {
      page = await fetchPageMeta(game.store_url).catch(() => null);
    }
    let ai: AiAssessment | null = null;
    if (opts.ai && config.aiEnrichment) {
      try {
        ai = await assessWithClaude(game.name, steam, game.note);
      } catch (err) {
        console.warn(`KI-Anreicherung für "${game.name}" fehlgeschlagen:`, err instanceof Error ? err.message : err);
      }
    }

    const modes = parseList(game.modes);
    const aiModes = ai ? ([ai.lan && 'LAN', ai.online && 'Online', ai.coop && 'Koop', ai.pvp && 'PvP'].filter(Boolean) as string[]) : [];
    const tags = parseList(game.tags);
    const screenshots = parseList(game.screenshots);
    const maxPlayers = game.max_players ?? ai?.max_players ?? (steam ? playerCountFromText(steam.description) : null);

    let questionable = game.questionable;
    let reason = game.questionable_reason;
    if (!opts.curated && !questionable) {
      const autoReason =
        (steam?.comingSoon && `Noch nicht erschienen${steam.releaseInfo ? ` (${steam.releaseInfo})` : ''}`) ||
        (ai?.questionable && ai.questionable_reason) ||
        (maxPlayers !== null && maxPlayers < config.minPlayers && `Nur bis ${maxPlayers} Spieler`) ||
        (steam && !steam.isMultiplayer && 'Laut Steam kein Mehrspieler-Modus') ||
        null;
      if (autoReason) {
        questionable = 1;
        reason = autoReason;
      }
    }

    db.prepare(
      `UPDATE games SET
         description = ?, image_url = ?, hero_url = ?, screenshots = ?, store_url = ?, max_players = ?,
         modes = ?, tags = ?, price = ?, release_info = ?, questionable = ?, questionable_reason = ?,
         enrich_status = 'done', enrich_source = ?
       WHERE id = ?`,
    ).run(
      game.description || ai?.description_de || steam?.description || page?.description || null,
      game.image_url || steam?.headerImage || page?.image || null,
      game.hero_url || steam?.heroImage || page?.image || null,
      JSON.stringify(screenshots.length ? screenshots : (steam?.screenshots ?? [])),
      game.store_url || steam?.storeUrl || null,
      maxPlayers,
      JSON.stringify(modes.length ? modes : aiModes.length ? aiModes : (steam?.modes ?? [])),
      JSON.stringify(tags.length ? tags : ai?.tags?.length ? ai.tags.slice(0, 4) : (steam?.tags ?? [])),
      game.price || steam?.price || ai?.price_eur || null,
      game.release_info || steam?.releaseInfo || null,
      questionable,
      reason,
      [steam && 'steam', page?.image && 'web', ai && 'ai'].filter(Boolean).join('+') || null,
      gameId,
    );
  } catch (err) {
    console.warn(`Anreicherung für "${game.name}" fehlgeschlagen:`, err instanceof Error ? err.message : err);
    db.prepare("UPDATE games SET enrich_status = 'failed' WHERE id = ?").run(gameId);
  }
}
