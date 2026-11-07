import { voteBudget, type Board, type Game } from '../api.ts';
import { Cross, ThumbDownIcon } from './bits.tsx';

/**
 * Total votes plus one ballot box per vote you may give this game. Clicking an empty box adds a cross,
 * clicking a crossed one takes one away. Below sits the thumbs down ("lieber nicht"), which excludes
 * your votes on the same game.
 */
export function VoteButton({
  game,
  board,
  onVote,
  onThumbsDown,
  large = false,
}: {
  game: Game;
  board: Board;
  onVote: (game: Game, count: number) => void;
  onThumbsDown: (game: Game, on: boolean) => void;
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

  const downNames = game.thumbsDown.map((t) => t.name).join(', ');
  const downTitle = game.myThumbsDown
    ? `Du willst das lieber nicht spielen. Klicken zum Zurücknehmen.${downNames ? ` Lieber nicht: ${downNames}` : ''}`
    : `Lieber nicht spielen${game.myVotes ? ' (nimmt deine Votes auf dieses Spiel zurück)' : ''}.${downNames ? ` Lieber nicht: ${downNames}` : ''}`;

  return (
    <div className={`vote${large ? ' vote-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
      <span className="vote-count">
        {game.votes}
        {large && <small>{game.votes === 1 ? 'Vote' : 'Votes'} insgesamt</small>}
      </span>
      <span className="vote-boxes" title={blocked ?? undefined}>
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
      <button
        className={`thumbs${game.myThumbsDown ? ' on' : ''}`}
        disabled={!votingOpen}
        aria-pressed={game.myThumbsDown}
        aria-label="Daumen runter: lieber nicht spielen"
        title={downTitle}
        onClick={() => onThumbsDown(game, !game.myThumbsDown)}
      >
        <ThumbDownIcon />
        {large ? (game.myThumbsDown ? 'Lieber nicht' : 'Daumen runter') : null}
        {game.thumbsDown.length > 0 && <b>{game.thumbsDown.length}</b>}
      </button>
    </div>
  );
}
