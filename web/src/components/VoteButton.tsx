import { voteBudget, type Board, type Game } from '../api.ts';

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
    ? 'Abstimmung geschlossen'
    : budget.left === 0
      ? 'Keine Votes mehr übrig'
      : classicFull
        ? `Maximal ${maxClassicVotes} Votes für Klassiker – vote einen Newcomer!`
        : game.myVotes >= maxVotesPerGame
          ? `Maximal ${maxVotesPerGame} Votes pro Spiel`
          : null;
  const size = large ? ' vote-lg' : '';

  if (maxVotesPerGame === 1) {
    const active = game.myVotes > 0;
    return (
      <button
        className={`vote${size}${active ? ' vote-active' : ''}${!active && classicFull ? ' vote-capped' : ''}`}
        disabled={!votingOpen || (!active && Boolean(blocked))}
        onClick={(e) => {
          e.stopPropagation();
          onVote(game, active ? 0 : 1);
        }}
        title={active ? undefined : (blocked ?? undefined)}
      >
        <span className="vote-count">{game.votes}</span>
        <span className="vote-label">{active ? '✓ Gevotet' : classicFull ? 'Klassiker voll' : '+ Vote'}</span>
      </button>
    );
  }

  return (
    <div
      className={`vote vote-stepper${size}${game.myVotes ? ' vote-active' : ''}${!game.myVotes && classicFull ? ' vote-capped' : ''}`}
      onClick={(e) => e.stopPropagation()}
      title={blocked ?? undefined}
    >
      <span className="vote-count">{game.votes}</span>
      <div className="vote-steps">
        <button disabled={!votingOpen || game.myVotes === 0} onClick={() => onVote(game, game.myVotes - 1)} aria-label="Vote entfernen">
          −
        </button>
        <span className="vote-mine" aria-label={`Deine Votes: ${game.myVotes} von ${maxVotesPerGame}`}>
          {Array.from({ length: maxVotesPerGame }, (_, i) => (
            <i key={i} className={i < game.myVotes ? 'on' : ''} />
          ))}
        </span>
        <button disabled={Boolean(blocked)} onClick={() => onVote(game, game.myVotes + 1)} aria-label="Vote hinzufügen">
          +
        </button>
      </div>
      {!game.myVotes && classicFull && <span className="vote-label">Klassiker voll</span>}
    </div>
  );
}
