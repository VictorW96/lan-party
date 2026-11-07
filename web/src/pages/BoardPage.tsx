import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, voteBudget, type Board, type Game, type User } from '../api.ts';
import { AddGameDialog } from '../components/AddGameDialog.tsx';
import { Badges, Cover, Meta, Voters } from '../components/bits.tsx';
import { GameDialog } from '../components/GameDialog.tsx';
import { Header } from '../components/Header.tsx';
import { VoteButton } from '../components/VoteButton.tsx';

type Filter = 'all' | 'classic' | 'newcomer' | 'questionable' | 'mine';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'classic', label: 'Klassiker' },
  { id: 'newcomer', label: 'Newcomer' },
  { id: 'questionable', label: 'Fraglich' },
  { id: 'mine', label: 'Meine Votes' },
];

function Podium({ games, onOpen }: { games: Game[]; onOpen: (g: Game) => void }) {
  if (!games.length) return null;
  return (
    <section className="podium" aria-label="Top-Spiele">
      {games.map((g, i) => (
        <button key={g.id} className={`podium-card podium-${i + 1} cat-${g.category}`} onClick={() => onOpen(g)}>
          <Cover game={g} variant="hero" className="podium-bg" />
          <div className="podium-shade" />
          <div className="podium-content">
            <span className="podium-rank">{i + 1}</span>
            <div>
              <Badges game={g} />
              <h3>{g.name}</h3>
              <p className="podium-votes">
                <strong>{g.votes}</strong> {g.votes === 1 ? 'Vote' : 'Votes'}
              </p>
            </div>
          </div>
        </button>
      ))}
    </section>
  );
}

function GameRow({
  game,
  rank,
  board,
  onVote,
  onThumbsDown,
  onOpen,
}: {
  game: Game;
  rank: number;
  board: Board;
  onVote: (g: Game, n: number) => void;
  onThumbsDown: (g: Game, on: boolean) => void;
  onOpen: (g: Game) => void;
}) {
  return (
    <article
      className={`game cat-${game.category}${game.questionable ? ' is-questionable' : ''}${game.myVotes ? ' is-voted' : ''}${game.myThumbsDown ? ' is-thumbed-down' : ''}`}
      onClick={() => onOpen(game)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(game)}
    >
      <div className="game-rank">{rank}</div>
      <div className="game-art">
        <Cover game={game} />
        {game.enrichStatus === 'pending' && <span className="game-art-loading">lädt …</span>}
      </div>
      <div className="game-body">
        <div className="game-head">
          <Badges game={game} />
          {game.note && <span className="game-note">„{game.note}“</span>}
        </div>
        <h3 className="game-title">{game.name}</h3>
        {game.questionable && game.questionableReason && <p className="game-warn">
            <b>Fraglich:</b> {game.questionableReason}
          </p>}
        <p className="game-desc">{game.description ?? (game.enrichStatus === 'pending' ? 'Infos laden noch.' : '')}</p>
        <div className="game-foot">
          <Meta game={game} minPlayers={board.settings.minPlayers} />
          <Voters voters={game.voters} />
        </div>
      </div>
      <VoteButton game={game} board={board} onVote={onVote} onThumbsDown={onThumbsDown} />
    </article>
  );
}

export function BoardPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await api<Board>('/board'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konnte die Liste nicht laden.');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  // Poll faster while a freshly added game is still being enriched.
  const pending = board?.games.some((g) => g.enrichStatus === 'pending');
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void load(), 3_000);
    return () => clearInterval(t);
  }, [pending, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const vote = async (game: Game, count: number) => {
    if (!board) return;
    // Optimistic update so the click feels instant; the server answer replaces it.
    const delta = count - game.myVotes;
    setBoard({
      ...board,
      games: board.games.map((g) =>
        g.id !== game.id
          ? g
          : {
              ...g,
              myVotes: count,
              votes: g.votes + delta,
              // A vote takes back your thumbs down on the same game.
              ...(count > 0 && { myThumbsDown: false, thumbsDown: g.thumbsDown.filter((t) => t.id !== user.id) }),
            },
      ),
    });
    try {
      setBoard(await api<Board>(`/games/${game.id}/vote`, { method: 'PUT', body: { count } }));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Vote fehlgeschlagen.');
      void load();
    }
  };

  const thumbsDown = async (game: Game, on: boolean) => {
    if (!board) return;
    const others = game.thumbsDown.filter((t) => t.id !== user.id);
    setBoard({
      ...board,
      games: board.games.map((g) =>
        g.id !== game.id
          ? g
          : on
            ? // A thumbs down frees your votes on that game.
              { ...g, myThumbsDown: true, thumbsDown: [...others, user], votes: g.votes - g.myVotes, myVotes: 0 }
            : { ...g, myThumbsDown: false, thumbsDown: others },
      ),
    });
    try {
      setBoard(await api<Board>(`/games/${game.id}/thumbs-down`, { method: 'PUT', body: { on } }));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Hat nicht geklappt.');
      void load();
    }
  };

  const visible = useMemo(() => {
    if (!board) return [];
    const q = query.trim().toLowerCase();
    return board.games
      .map((g, i) => ({ game: g, rank: i + 1 }))
      .filter(({ game }) => {
        if (q && !game.name.toLowerCase().includes(q)) return false;
        if (filter === 'classic' || filter === 'newcomer') return game.category === filter;
        if (filter === 'questionable') return game.questionable;
        if (filter === 'mine') return game.myVotes > 0;
        return true;
      });
  }, [board, filter, query]);

  if (!board)
    return (
      <>
        <Header user={user} onLogout={onLogout} />
        <div className="splash">{error || 'Lade Spiele …'}</div>
      </>
    );

  const budget = voteBudget(board);
  const { maxVotes, maxClassicVotes, maxVotesPerGame, eventDate } = board.settings;
  const eventTime = eventDate ? new Date(eventDate) : null;
  const eventLabel =
    eventTime && !Number.isNaN(eventTime.getTime())
      ? `${eventTime.toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr`
      : '';
  const top = board.games.filter((g) => g.votes > 0).slice(0, 3);
  const openGame = board.games.find((g) => g.id === openId) ?? null;

  return (
    <>
      <Header
        user={user}
        onLogout={onLogout}
        votes={{ classic: budget.classicUsed, newcomer: budget.newcomerUsed, max: maxVotes }}
        eventDate={board.settings.eventDate || undefined}
      />
      <main className="page">
        <section className="hero">
          <p className="dateline">
            House of Gaming, Miesbach
            {eventLabel && ` · ${eventLabel}`}
          </p>
          <h1>Was zocken wir auf der LAN?</h1>
          <p className="lead">
            Du hast {maxVotes} Votes, höchstens {maxVotesPerGame} pro Spiel. Maximal {maxClassicVotes} davon dürfen an Klassiker gehen, der Rest
            an Newcomer. Auf die Liste gehört, was mindestens {board.settings.minPlayers} Leute zusammen spielen können. Oben stehen
            Klassiker und Newcomer abwechselnd. Mit dem Daumen nach unten zeigst du, was du auf keinen Fall spielen willst.
          </p>
          <dl className="tally">
            <div>
              <dt>Spiele</dt>
              <dd>{board.games.length}</dd>
            </div>
            <div>
              <dt>haben gevotet</dt>
              <dd>
                {board.stats.voted}/{board.stats.players}
              </dd>
            </div>
            <div className="is-mine">
              <dt>{budget.left === 1 ? 'Vote übrig' : 'Votes übrig'}</dt>
              <dd>{budget.left}</dd>
            </div>
            <div className={budget.classicUsed >= maxClassicVotes ? 'is-full' : ''}>
              <dt>Klassiker-Votes</dt>
              <dd>
                {budget.classicUsed}/{maxClassicVotes}
              </dd>
            </div>
          </dl>
          {!board.settings.votingOpen && <p className="banner">Abstimmung geschlossen. Das ist das Endergebnis.</p>}
        </section>

        <Podium games={top} onOpen={(g) => setOpenId(g.id)} />

        <div className="toolbar">
          <div className="filters" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <input className="search" placeholder="Suchen …" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Spiel vorschlagen
            </button>
          </div>
        </div>

        <section className="games">
          {visible.map(({ game, rank }) => (
            <GameRow key={game.id} game={game} rank={rank} board={board} onVote={vote} onThumbsDown={thumbsDown} onOpen={(g) => setOpenId(g.id)} />
          ))}
          {!visible.length && <p className="empty">Nichts gefunden.</p>}
        </section>
      </main>

      {openGame && (
        <GameDialog
          game={openGame}
          board={board}
          user={user}
          onVote={vote}
          onThumbsDown={thumbsDown}
          onClose={() => setOpenId(null)} onChanged={load} />
      )}
      {adding && (
        <AddGameDialog
          aiEnrichment={board.settings.aiEnrichment}
          onClose={() => setAdding(false)}
          onAdded={async (name) => {
            setAdding(false);
            setToast(`„${name}“ steht auf der Liste. Bilder und Infos laden noch.`);
            await load();
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
