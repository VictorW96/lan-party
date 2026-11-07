export type SteamSearchHit = { appid: number; name: string; image: string; price: string | null };

export type SteamDetails = {
  appid: number;
  name: string;
  description: string;
  headerImage: string | null;
  heroImage: string;
  screenshots: string[];
  modes: string[];
  tags: string[];
  price: string | null;
  comingSoon: boolean;
  releaseInfo: string | null;
  storeUrl: string;
  isMultiplayer: boolean;
};

const STORE = 'https://store.steampowered.com';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'accept-language': 'de-DE,de;q=0.9' } });
  if (!res.ok) throw new Error(`Steam antwortet mit ${res.status}`);
  return res.json();
}

const decodeEntities = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

/** Rounds Steam's "16,79€" to the friendly "17€" style the group uses. */
function formatPrice(cents: number | undefined, isFree: boolean): string | null {
  if (isFree) return '0€';
  if (cents === undefined) return null;
  return `${Math.round(cents / 100)}€`;
}

export async function searchSteam(term: string): Promise<SteamSearchHit[]> {
  const data = (await getJson(`${STORE}/api/storesearch/?term=${encodeURIComponent(term)}&l=german&cc=DE`)) as {
    items?: { id: number; name: string; tiny_image: string; price?: { final: number } }[];
  };
  return (data.items ?? []).slice(0, 8).map((item) => ({
    appid: item.id,
    name: item.name,
    image: item.tiny_image,
    price: item.price ? formatPrice(item.price.final, false) : null,
  }));
}

type RawDetails = {
  name: string;
  short_description?: string;
  header_image?: string;
  is_free?: boolean;
  price_overview?: { final: number };
  release_date?: { coming_soon: boolean; date: string };
  categories?: { id: number; description: string }[];
  genres?: { description: string }[];
  screenshots?: { path_full: string }[];
};

// Steam category ids: 1 Multi-player, 9 Co-op, 38 Online Co-op, 48 LAN Co-op, 49 PvP, 36 Online PvP, 47 LAN PvP, 20 MMO
const LAN = [47, 48];
const ONLINE = [36, 38, 20];
const COOP = [9, 38, 48];
const PVP = [49, 36, 47];

export async function getSteamDetails(appid: number): Promise<SteamDetails | null> {
  const data = (await getJson(`${STORE}/api/appdetails?appids=${appid}&l=german&cc=DE`)) as Record<
    string,
    { success: boolean; data?: RawDetails }
  >;
  const d = data[String(appid)]?.data;
  if (!d) return null;

  const categoryIds = new Set((d.categories ?? []).map((c) => c.id));
  const has = (ids: number[]) => ids.some((id) => categoryIds.has(id));
  const modes = [has(LAN) && 'LAN', has(ONLINE) && 'Online', has(COOP) && 'Koop', has(PVP) && 'PvP'].filter(Boolean) as string[];

  return {
    appid,
    name: d.name,
    description: decodeEntities(d.short_description ?? ''),
    headerImage: d.header_image ?? null,
    heroImage: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`,
    screenshots: (d.screenshots ?? []).slice(0, 6).map((s) => s.path_full),
    modes,
    tags: (d.genres ?? []).map((g) => g.description).filter((t) => t !== 'Indie' && t !== 'Early Access').slice(0, 4),
    price: formatPrice(d.price_overview?.final, Boolean(d.is_free)),
    comingSoon: Boolean(d.release_date?.coming_soon),
    releaseInfo: d.release_date?.date ?? null,
    storeUrl: `${STORE}/app/${appid}`,
    isMultiplayer: categoryIds.has(1) || categoryIds.has(20) || modes.length > 0,
  };
}

/** Pulls a player count out of store copy like "Koop-FPS für 1-4 Spieler" or "up to 16 players". */
export function playerCountFromText(text: string): number | null {
  const range = text.match(/\b\d{1,2}\s*[-–]\s*(\d{1,3})\s+(?:Spieler|players)/i);
  const upTo = text.match(/\b(?:bis zu|up to|max(?:imal|\.)?)\s+(\d{1,3})\s+(?:Spieler|players)/i);
  const n = Number(range?.[1] ?? upTo?.[1]);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** Accepts "https://store.steampowered.com/app/123/Name/" or a bare app id. */
export function parseSteamAppId(input: string): number | null {
  const match = input.match(/store\.steampowered\.com\/app\/(\d+)/) ?? input.trim().match(/^(\d{2,8})$/);
  return match ? Number(match[1]) : null;
}
