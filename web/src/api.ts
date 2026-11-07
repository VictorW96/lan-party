export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Category = 'classic' | 'newcomer';

export type User = { id: number; name: string; is_admin: number; color: string };

export type Voter = { id: number; name: string; color: string; count: number };

export type Game = {
  id: number;
  name: string;
  category: Category;
  questionable: boolean;
  questionableReason: string | null;
  note: string | null;
  price: string | null;
  description: string | null;
  imageUrl: string | null;
  heroUrl: string | null;
  screenshots: string[];
  steamAppId: number | null;
  storeUrl: string | null;
  maxPlayers: number | null;
  modes: string[];
  tags: string[];
  releaseInfo: string | null;
  enrichStatus: 'pending' | 'done' | 'failed';
  addedBy: string | null;
  addedById: number | null;
  votes: number;
  voters: Voter[];
  myVotes: number;
};

export type Settings = {
  votingOpen: boolean;
  eventDate: string;
  maxVotes: number;
  maxVotesPerGame: number;
  maxClassicVotes: number;
  minPlayers: number;
  aiEnrichment: boolean;
};

export type Board = { games: Game[]; settings: Settings; stats: { players: number; voted: number } };

export function voteBudget(board: Board) {
  const used = board.games.reduce((sum, g) => sum + g.myVotes, 0);
  const classicUsed = board.games.reduce((sum, g) => sum + (g.category === 'classic' ? g.myVotes : 0), 0);
  return {
    used,
    classicUsed,
    newcomerUsed: used - classicUsed,
    left: Math.max(0, board.settings.maxVotes - used),
    classicLeft: Math.max(0, Math.min(board.settings.maxClassicVotes - classicUsed, board.settings.maxVotes - used)),
  };
}

export type SteamHit ={ appid: number; name: string; image: string; price: string | null };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? (init.method && init.method !== 'GET' ? '{}' : undefined) : JSON.stringify(init.body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Fehler ${res.status}`, res.status);
  return data;
}

export function navigate(path: string): void {
  history.pushState(null, '', `${BASE}${path}`);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function currentPath(): string {
  const p = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  return p || '/';
}
