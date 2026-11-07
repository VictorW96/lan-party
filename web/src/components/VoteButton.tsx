import { voteBudget, type Board, type Game } from '../api.ts';
import { Cross } from './bits.tsx';

/**
 * Total votes plus one ballot box per vote you may give this game. Clicking an empty box adds a cross,
 * clicking a crossed one takes one away.
 */
export function VoteButton({
  game,
  board,
  onVote,
  large = false,
}: {
  game: Game;
  board: Board;
  onVote: (game: Game, count: number) => void;
  large?: boolean;
}) {
  const { maxVotesPerGame, maxClassicVotes, votingOpen } = board.settings;
  const budget = voteBudget(board);
  const classicFull = game.category === 'classic' && budget.classicLeft === 0 && budget.left > 0;
  const blocked = !votingOpen
    ? 'Die Abstimmung ist geschlossen.'
    : budget.left === 0
      ? 'Du hast alle Votes vergeben. Nimm erst woanders einen weg.'
      : classicFull
        ? `Deine ${maxClassicVotes} Klassiker-Votes sind vergeben. Der Rest geht an Newcomer.`
        : game.myVotes >= maxVotesPerGame
          ? `Pro Spiel gehen höchstens ${maxVotesPerGame} Votes.`
          : null;

  return (
    <div className={`vote${large ? ' vote-lg' : ''}`} onClick={(e) => e.stopPropagation()} title={blocked ?? undefined}>
      <span className="vote-count">
        {game.votes}
        {large && <small>{game.votes === 1 ? 'Vote' : 'Votes'} insgesamt</small>}
      </span>
      <span className="vote-boxes">
        {Array.from({ length: maxVotesPerGame }, (_, i) => {
          const on = i < game.myVotes;
          return (
            <button
              key={i}
              className={`box${on ? ' on' : ''}`}
              disabled={on ? !votingOpen : Boolean(blocked)}
              aria-pressed={on}
              aria-label={on ? 'Vote zurücknehmen' : 'Vote geben'}
              onClick={() => onVote(game, on ? game.myVotes - 1 : game.myVotes + 1)}
            >
              {on && <Cross />}
            </button>
          );
        })}
      </span>
      {!game.myVotes && classicFull && <span className="vote-note">Klassiker voll</span>}
    </div>
  );
}
