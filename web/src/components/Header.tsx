import { useEffect, useState } from 'react';
import { navigate, type User } from '../api.ts';
import { Avatar } from './bits.tsx';
import { Logo } from './Logo.tsx';

function Countdown({ date }: { date: string }) {
  const target = new Date(date).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0)
    return (
      <span className="countdown countdown-live">
        <span className="cd-dot" /> LAN läuft!
      </span>
    );
  const units = [
    { value: Math.floor(diff / 86_400_000), label: 'Tage' },
    { value: Math.floor((diff % 86_400_000) / 3_600_000), label: 'Std' },
    { value: Math.floor((diff % 3_600_000) / 60_000), label: 'Min' },
  ];
  const when = new Date(date).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return (
    <span className="countdown" title={`LAN-Start: ${when} Uhr`}>
      <span className="cd-label">LAN in</span>
      {units.map((u, i) => (
        <span key={u.label} className="cd-unit">
          <strong>{i === 0 ? u.value : String(u.value).padStart(2, '0')}</strong>
          <small>{u.label}</small>
        </span>
      ))}
    </span>
  );
}

export function Header({
  user,
  onLogout,
  votes,
  eventDate,
}: {
  user: User;
  onLogout: () => void;
  votes?: { classic: number; newcomer: number; max: number };
  eventDate?: string;
}) {
  return (
    <header className="topbar">
      <a
        href={import.meta.env.BASE_URL}
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
      >
        <Logo compact />
      </a>
      <div className="topbar-right">
        {eventDate && <Countdown date={eventDate} />}
        {votes && (
          <div
            className="pips"
            title={`${Math.max(0, votes.max - votes.classic - votes.newcomer)} von ${votes.max} Votes übrig · ${votes.classic} Klassiker, ${votes.newcomer} Newcomer`}
          >
            {Array.from({ length: votes.max }, (_, i) => (
              <span
                key={i}
                className={`pip${i < votes.classic ? ' pip-classic' : i < votes.classic + votes.newcomer ? ' pip-newcomer' : ''}`}
              />
            ))}
            <span className="pips-label">
              {Math.max(0, votes.max - votes.classic - votes.newcomer)}/{votes.max}
            </span>
          </div>
        )}
        <div className="usermenu">
          <Avatar voter={user} size={30} />
          <span className="usermenu-name">{user.name}</span>
          {user.is_admin ? (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>
              Admin
            </button>
          ) : null}
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
