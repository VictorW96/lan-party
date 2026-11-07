const basePath = (process.env.BASE_PATH ?? '/lanparty').replace(/\/+$/, '');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  /** URL prefix the app lives under, e.g. "/lanparty" for victor-wolf.com/lanparty. */
  basePath,
  /** Public origin + base path, used to print invite links. */
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:5173${basePath}`).replace(/\/+$/, ''),
  dataDir: process.env.DATA_DIR ?? './data',
  webDist: process.env.WEB_DIST ?? './dist/web',
  maxVotes: Number(process.env.MAX_VOTES ?? 10),
  maxVotesPerGame: Number(process.env.MAX_VOTES_PER_GAME ?? 2),
  /** Cap on votes for classics, so everyone has to back some newcomers too. */
  maxClassicVotes: Number(process.env.MAX_CLASSIC_VOTES ?? 6),
  minPlayers: Number(process.env.MIN_PLAYERS ?? 10),
  secureCookies: process.env.NODE_ENV === 'production',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  aiEnrichment: Boolean(process.env.ANTHROPIC_API_KEY),
};
