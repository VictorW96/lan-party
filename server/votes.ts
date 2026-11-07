import type { Category } from './ranking.ts';

export type VoteLimits = { maxVotes: number; maxVotesPerGame: number; maxClassicVotes: number };

/**
 * Checks whether a user may set their votes on one game to `wanted`.
 * `usedElsewhere` / `classicElsewhere` are the user's votes on all *other* games.
 * Returns a German error message, or null when the vote is allowed.
 */
export function voteLimitError(
  limits: VoteLimits,
  game: { category: Category },
  wanted: number,
  usedElsewhere: number,
  classicElsewhere: number,
): string | null {
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > limits.maxVotesPerGame)
    return `Pro Spiel sind maximal ${limits.maxVotesPerGame} Votes erlaubt.`;
  if (wanted === 0) return null;
  if (usedElsewhere + wanted > limits.maxVotes) return `Du hast nur ${limits.maxVotes} Votes. Nimm erst woanders einen weg.`;
  if (game.category === 'classic' && classicElsewhere + wanted > limits.maxClassicVotes)
    return `Maximal ${limits.maxClassicVotes} Votes für Klassiker – gib den Rest einem Newcomer!`;
  return null;
}
