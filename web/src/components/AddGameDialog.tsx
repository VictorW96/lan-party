import { useEffect, useState, type FormEvent } from 'react';
import { api, type Category, type SteamHit } from '../api.ts';
import { Modal } from './bits.tsx';

export function CategoryToggle({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="segmented">
      <button type="button" className={value === 'newcomer' ? 'active seg-newcomer' : ''} onClick={() => onChange('newcomer')}>
        Newcomer
        <small>neu für uns</small>
      </button>
      <button type="button" className={value === 'classic' ? 'active seg-classic' : ''} onClick={() => onChange('classic')}>
        Klassiker
        <small>schon oft gezockt</small>
      </button>
    </div>
  );
}

export function AddGameDialog({
  aiEnrichment,
  onClose,
  onAdded,
}: {
  aiEnrichment: boolean;
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SteamHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SteamHit | null>(null);
  const [manual, setManual] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('newcomer');
  const [storeUrl, setStoreUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [questionable, setQuestionable] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (manual || picked || query.trim().length < 2) return setHits([]);
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await api<{ results: SteamHit[] }>(`/steam/search?q=${encodeURIComponent(query.trim())}`);
        setHits(results);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, manual, picked]);

  const pick = (hit: SteamHit) => {
    setPicked(hit);
    setName(hit.name.replace(/[®™]/g, ''));
    setHits([]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/games', {
        method: 'POST',
        body: {
          name,
          category,
          steam: picked ? String(picked.appid) : '',
          storeUrl,
          imageUrl,
          price,
          note,
          questionable,
          questionableReason: reason,
        },
      });
      onAdded(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hat nicht geklappt.');
      setBusy(false);
    }
  };

  const ready = picked || manual;

  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Spiel vorschlagen</h2>
      <p className="muted">
        Such das Spiel auf Steam. Bilder, Beschreibung und Multiplayer-Infos kommen von dort.
        {aiEnrichment ? ' Claude prüft zusätzlich, ob es für die ganze Gruppe taugt.' : ''}
      </p>

      {!ready && (
        <div className="stack">
          <input className="search search-lg" placeholder="Spielname, z. B. Deep Rock Galactic" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <ul className="hits">
            {hits.map((h) => (
              <li key={h.appid}>
                <button type="button" onClick={() => pick(h)}>
                  <img src={h.image} alt="" loading="lazy" />
                  <span className="hit-name">{h.name}</span>
                  {h.price && <span className="chip chip-price">{h.price}</span>}
                </button>
              </li>
            ))}
            {searching && <li className="muted">Suche läuft …</li>}
            {!searching && query.trim().length >= 2 && !hits.length && <li className="muted">Nichts auf Steam gefunden.</li>}
          </ul>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setManual(true);
              setName(query.trim());
            }}
          >
            Nicht auf Steam? Von Hand eintragen
          </button>
        </div>
      )}

      {ready && (
        <form onSubmit={submit} className="stack">
          {picked && (
            <div className="picked">
              <img src={picked.image} alt="" />
              <div>
                <strong>{picked.name}</strong>
                <span className="muted">Steam-App {picked.appid}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>
                ändern
              </button>
            </div>
          )}
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </label>
          <CategoryToggle value={category} onChange={setCategory} />
          {manual && (
            <>
              <label className="field">
                <span>Link (Website, Shop …)</span>
                <input type="url" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://" />
              </label>
              <label className="field">
                <span>Bild-URL (optional)</span>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/cover.jpg" />
              </label>
            </>
          )}
          <div className="row">
            <label className="field">
              <span>Preis (optional)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="automatisch" maxLength={20} />
            </label>
            <label className="field grow">
              <span>Notiz (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. nur Koop, Playtest" maxLength={120} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={questionable} onChange={(e) => setQuestionable(e.target.checked)} />
            <span>Fraglich: vielleicht nicht für die ganze Gruppe</span>
          </label>
          {questionable && (
            <label className="field">
              <span>Warum fraglich?</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={160} placeholder="z. B. nur 8 Spieler" />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
            <button className="btn btn-primary" disabled={busy || !name.trim()}>
              {busy ? 'Speichere …' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
