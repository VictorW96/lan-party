import { useEffect, useState } from 'react';
import { navigate, type User } from '../api.ts';
import { Avatar } from './bits.tsx';
import { Logo } from './Logo.tsx';

function Countdown({ date }: { date: string }) {
  const target = new Date(date).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return <span className="countdown countdown-live">LAN läuft!</span>;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return (
    <span className="countdown" title={new Date(date).toLocaleString('de-DE')}>
      <strong>{days}</strong>d <strong>{hours}</strong>h bis zur LAN
    </span>
  );
}

export function Header({
  user,
  onLogout,
  votesUsed,
  maxVotes,
  eventDate,
}: {
  user: User;
  onLogout: () => void;
  votesUsed?: number;
  maxVotes?: number;
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
        {maxVotes !== undefined && votesUsed !== undefined && (
          <div className="pips" title={`${maxVotes - votesUsed} von ${maxVotes} Votes übrig`}>
            {Array.from({ length: maxVotes }, (_, i) => (
              <span key={i} className={`pip${i < votesUsed ? ' pip-used' : ''}`} />
            ))}
            <span className="pips-label">
              {maxVotes - votesUsed}/{maxVotes}
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
