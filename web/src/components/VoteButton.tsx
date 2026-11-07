import type { Board, Game } from '../api.ts';

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
  const { maxVotes, maxVotesPerGame, votingOpen } = board.settings;
  const used = board.games.reduce((sum, g) => sum + g.myVotes, 0);
  const canAdd = votingOpen && used < maxVotes && game.myVotes < maxVotesPerGame;
  const size = large ? ' vote-lg' : '';

  if (maxVotesPerGame === 1) {
    const active = game.myVotes > 0;
    return (
      <button
        className={`vote${size}${active ? ' vote-active' : ''}`}
        disabled={!votingOpen || (!active && !canAdd)}
        onClick={(e) => {
          e.stopPropagation();
          onVote(game, active ? 0 : 1);
        }}
        title={!votingOpen ? 'Abstimmung geschlossen' : !active && !canAdd ? 'Keine Votes mehr übrig' : undefined}
      >
        <span className="vote-count">{game.votes}</span>
        <span className="vote-label">{active ? '✓ Gevotet' : '+ Vote'}</span>
      </button>
    );
  }

  return (
    <div className={`vote vote-stepper${size}${game.myVotes ? ' vote-active' : ''}`} onClick={(e) => e.stopPropagation()}>
      <span className="vote-count">{game.votes}</span>
      <div className="vote-steps">
        <button disabled={!votingOpen || game.myVotes === 0} onClick={() => onVote(game, game.myVotes - 1)} aria-label="Vote entfernen">
          −
        </button>
        <span>{game.myVotes}</span>
        <button disabled={!canAdd} onClick={() => onVote(game, game.myVotes + 1)} aria-label="Vote hinzufügen">
          +
        </button>
      </div>
    </div>
  );
}
