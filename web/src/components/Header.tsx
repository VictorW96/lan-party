import { useEffect, useState } from 'react';
import { navigate, type User } from '../api.ts';
import { Avatar, Box } from './bits.tsx';
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
  const when = new Date(date).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  if (diff <= 0) return <span className="countdown countdown-live">LAN läuft</span>;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return (
    <span className="countdown" title={`LAN-Start: ${when} Uhr`}>
      <small>LAN in</small>
      <b>{days}</b>
      <small>{days === 1 ? 'Tag' : 'Tage'}</small>
      <b>{String(hours).padStart(2, '0')}</b>
      <small>Std</small>
      <b>{String(minutes).padStart(2, '0')}</b>
      <small>Min</small>
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
            className="budget"
            title={`${Math.max(0, votes.max - votes.classic - votes.newcomer)} von ${votes.max} Votes übrig. Vergeben: ${votes.classic} Klassiker, ${votes.newcomer} Newcomer.`}
          >
            <span className="budget-boxes">
              {Array.from({ length: votes.max }, (_, i) => (
                <Box key={i} on={i < votes.classic + votes.newcomer} small />
              ))}
            </span>
            <span className="budget-label">{Math.max(0, votes.max - votes.classic - votes.newcomer)} übrig</span>
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
