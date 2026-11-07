export type Category = 'classic' | 'newcomer';

export type Rankable = {
  name: string;
  category: Category;
  votes: number;
  questionable: boolean;
};

function byVotes(a: Rankable, b: Rankable): number {
  return b.votes - a.votes || Number(a.questionable) - Number(b.questionable) || a.name.localeCompare(b.name, 'de');
}

/**
 * Orders games for the voting board: classics and newcomers alternate, each side
 * taking its next most-voted game. As soon as the side whose turn it is has no
 * voted game left, the alternation stops and everything remaining follows purely
 * by votes. The category with the overall top game starts.
 */
export function rankGames<T extends Rankable>(games: readonly T[]): T[] {
  const queues: Record<Category, T[]> = {
    classic: games.filter((g) => g.category === 'classic').sort(byVotes),
    newcomer: games.filter((g) => g.category === 'newcomer').sort(byVotes),
  };
  const ranked: T[] = [];

  const topClassic = queues.classic[0];
  const topNewcomer = queues.newcomer[0];
  let turn: Category = topClassic && (!topNewcomer || byVotes(topClassic, topNewcomer) <= 0) ? 'classic' : 'newcomer';

  while ((queues[turn][0]?.votes ?? 0) > 0) {
    ranked.push(queues[turn].shift()!);
    turn = turn === 'classic' ? 'newcomer' : 'classic';
  }

  return ranked.concat([...queues.classic, ...queues.newcomer].sort(byVotes));
}
