import { useEffect, useState, type ReactNode } from 'react';
import type { Category, Game, Voter } from '../api.ts';

export const CATEGORY_LABEL: Record<Category, string> = { classic: 'Klassiker', newcomer: 'Newcomer' };

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Game art with graceful fallbacks: hero → header → generated cover. */
export function Cover({ game, variant = 'header', className = '' }: { game: Game; variant?: 'header' | 'hero'; className?: string }) {
  const sources = (variant === 'hero' ? [game.heroUrl, game.imageUrl] : [game.imageUrl]).filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [game.imageUrl, game.heroUrl]);
  const src = sources[index];

  if (!src) {
    const h = hue(game.name);
    const initials = game.name
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0])
      .join('');
    return (
      <div
        className={`cover cover-generated ${className}`}
        style={{ background: `linear-gradient(135deg, hsl(${h} 70% 22%), hsl(${(h + 60) % 360} 80% 12%))` }}
        aria-label={game.name}
      >
        <span>{initials}</span>
      </div>
    );
  }
  return <img className={`cover ${className}`} src={src} alt="" loading="lazy" onError={() => setIndex((i) => i + 1)} />;
}

export function Avatar({ voter, size = 26 }: { voter: Pick<Voter, 'name' | 'color'>; size?: number }) {
  return (
    <span className="avatar" title={voter.name} style={{ background: voter.color, width: size, height: size, fontSize: size * 0.42 }}>
      {voter.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Voters({ voters, max = 6 }: { voters: Voter[]; max?: number }) {
  if (!voters.length) return null;
  return (
    <div className="voters" title={voters.map((v) => v.name + (v.count > 1 ? ` ×${v.count}` : '')).join(', ')}>
      {voters.slice(0, max).map((v) => (
        <span key={v.id} className="voter">
          <Avatar voter={v} />
          {v.count > 1 && <span className="voter-count">×{v.count}</span>}
        </span>
      ))}
      {voters.length > max && <span className="avatar avatar-more">+{voters.length - max}</span>}
    </div>
  );
}

export function Badges({ game }: { game: Game }) {
  return (
    <div className="badges">
      <span className={`badge badge-${game.category}`}>{CATEGORY_LABEL[game.category]}</span>
      {game.questionable && (
        <span className="badge badge-warn" title={game.questionableReason ?? undefined}>
          ⚠ Fraglich
        </span>
      )}
    </div>
  );
}

export function Meta({ game, minPlayers }: { game: Game; minPlayers: number }) {
  const enough = game.maxPlayers === null ? null : game.maxPlayers >= minPlayers;
  return (
    <div className="meta">
      {game.maxPlayers !== null && (
        <span className={`chip ${enough ? 'chip-ok' : 'chip-bad'}`} title="Maximale Spielerzahl">
          <PlayersIcon /> {game.maxPlayers >= 64 ? '64+' : game.maxPlayers}
        </span>
      )}
      {game.modes.map((m) => (
        <span key={m} className={`chip ${m === 'LAN' ? 'chip-lan' : ''}`}>
          {m}
        </span>
      ))}
      {game.price && <span className="chip chip-price">{game.price}</span>}
    </div>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
      <path
        fill="currentColor"
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-3.3 0-7 1.6-7 4.5V20h14v-2.5C16 14.6 12.3 13 9 13zm7.5 0c-.5 0-1 0-1.5.1 1.2.9 2 2.3 2 4.4V20h5v-2.4c0-2.8-3-4.6-5.5-4.6z"
      />
    </svg>
  );
}

export function Modal({ onClose, children, wide = false }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal>
        <button className="modal-close" onClick={onClose} aria-label="Schließen">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
