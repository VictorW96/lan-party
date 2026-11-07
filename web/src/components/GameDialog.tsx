import { useState, type FormEvent } from 'react';
import { api, type Board, type Category, type Game, type User } from '../api.ts';
import { CategoryToggle } from './AddGameDialog.tsx';
import { Avatar, Badges, Cover, Meta, Modal } from './bits.tsx';
import { VoteButton } from './VoteButton.tsx';

function EditForm({ game, onDone, onCancel }: { game: Game; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: game.name,
    category: game.category as Category,
    price: game.price ?? '',
    note: game.note ?? '',
    description: game.description ?? '',
    imageUrl: game.imageUrl ?? '',
    storeUrl: game.storeUrl ?? '',
    maxPlayers: game.maxPlayers?.toString() ?? '',
    questionable: game.questionable,
    questionableReason: game.questionableReason ?? '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/games/${game.id}`, { method: 'PATCH', body: { ...form, maxPlayers: form.maxPlayers === '' ? null : Number(form.maxPlayers) } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <CategoryToggle value={form.category} onChange={(c) => set('category', c)} />
      <div className="row">
        <label className="field">
          <span>Preis</span>
          <input value={form.price} onChange={(e) => set('price', e.target.value)} />
        </label>
        <label className="field">
          <span>Max. Spieler</span>
          <input type="number" min={1} value={form.maxPlayers} onChange={(e) => set('maxPlayers', e.target.value)} />
        </label>
        <label className="field grow">
          <span>Notiz</span>
          <input value={form.note} onChange={(e) => set('note', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Beschreibung</span>
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="row">
        <label className="field grow">
          <span>Bild-URL</span>
          <input type="url" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
        </label>
        <label className="field grow">
          <span>Link</span>
          <input type="url" value={form.storeUrl} onChange={(e) => set('storeUrl', e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.questionable} onChange={(e) => set('questionable', e.target.checked)} />
        <span>Fraglich</span>
      </label>
      {form.questionable && (
        <label className="field">
          <span>Warum fraglich?</span>
          <input value={form.questionableReason} onChange={(e) => set('questionableReason', e.target.value)} />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn-primary">Speichern</button>
      </div>
    </form>
  );
}

export function GameDialog({
  game,
  board,
  user,
  onVote,
  onClose,
  onChanged,
}: {
  game: Game;
  board: Board;
  user: User;
  onVote: (g: Game, n: number) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const canEdit = Boolean(user.is_admin) || game.addedById === user.id;

  const remove = async () => {
    if (!confirm(`„${game.name}“ wirklich von der Liste löschen? Alle Votes dafür gehen verloren.`)) return;
    await api(`/games/${game.id}`, { method: 'DELETE' });
    onClose();
    await onChanged();
  };

  const reenrich = async () => {
    await api(`/games/${game.id}/enrich`, { method: 'POST' });
    await onChanged();
  };

  return (
    <Modal onClose={onClose} wide>
      <div className={`detail cat-${game.category}`}>
        <div className="detail-hero">
          <Cover game={game} variant="hero" />
          <div className="detail-hero-shade" />
          <div className="detail-hero-content">
            <Badges game={game} />
            <h2>{game.name}</h2>
            {game.note && <p className="game-note">„{game.note}“</p>}
          </div>
        </div>

        {editing ? (
          <EditForm
            game={game}
            onCancel={() => setEditing(false)}
            onDone={async () => {
              setEditing(false);
              await onChanged();
            }}
          />
        ) : (
          <div className="detail-body">
            <div className="detail-main">
              {game.questionable && <p className="game-warn">⚠ {game.questionableReason || 'Fraglich, ob das für die ganze Gruppe passt.'}</p>}
              <p className="detail-desc">{game.description || 'Noch keine Beschreibung.'}</p>
              <Meta game={game} minPlayers={board.settings.minPlayers} />
              {game.tags.length > 0 && (
                <div className="tags">
                  {game.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              )}
              {game.screenshots.length > 0 && (
                <div className="shots">
                  {game.screenshots.slice(0, 6).map((s) => (
                    <button key={s} onClick={() => setShot(s)}>
                      <img src={s.replace('.1920x1080', '.600x338')} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <aside className="detail-side">
              <VoteButton game={game} board={board} onVote={onVote} large />
              <div className="detail-voters">
                <h4>{game.voters.length ? 'Dafür gestimmt' : 'Noch keine Votes'}</h4>
                {game.voters.map((v) => (
                  <div key={v.id} className="voter-line">
                    <Avatar voter={v} size={22} /> {v.name}
                    {v.count > 1 && <span className="muted">×{v.count}</span>}
                  </div>
                ))}
              </div>
              <dl className="facts">
                {game.releaseInfo && (
                  <>
                    <dt>Release</dt>
                    <dd>{game.releaseInfo}</dd>
                  </>
                )}
                {game.addedBy && (
                  <>
                    <dt>Vorgeschlagen von</dt>
                    <dd>{game.addedBy}</dd>
                  </>
                )}
              </dl>
              {game.storeUrl && (
                <a className="btn btn-ghost btn-block" href={game.storeUrl} target="_blank" rel="noreferrer">
                  {game.steamAppId ? 'Auf Steam ansehen ↗' : 'Zur Website ↗'}
                </a>
              )}
              {canEdit && (
                <div className="detail-admin">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                    Bearbeiten
                  </button>
                  {user.is_admin ? (
                    <button className="btn btn-ghost btn-sm" onClick={reenrich} title="Infos neu von Steam/KI holen">
                      Neu anreichern
                    </button>
                  ) : null}
                  <button className="btn btn-danger btn-sm" onClick={remove}>
                    Löschen
                  </button>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
      {shot && (
        <div className="lightbox" onClick={() => setShot(null)}>
          <img src={shot} alt="" />
        </div>
      )}
    </Modal>
  );
}
