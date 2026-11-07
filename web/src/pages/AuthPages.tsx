import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '../api.ts';
import { Logo } from '../components/Logo.tsx';

function AuthShell({ children, kicker }: { children: ReactNode; kicker: string }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <p className="kicker">{kicker}</p>
        {children}
      </div>
      <p className="auth-foot">House of Gaming · Miesbach</p>
    </div>
  );
}

export function LoginPage({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: { name, password } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell kicker="Login für die Crew">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Moment …' : 'Einloggen'}
        </button>
      </form>
      <p className="hint">Noch keinen Account? Lass dir von Victor deinen persönlichen Einladungslink schicken.</p>
    </AuthShell>
  );
}

type InviteInfo = { label: string; isAdmin: boolean; resetName: string | null; maxVotes: number };

export function InvitePage({ code, onDone }: { code: string; onDone: () => void }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/invites/${code}`)
      .then((i) => {
        setInfo(i);
        if (!i.resetName && i.label !== 'Admin' && i.label !== 'Freund') setName(i.label);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : 'Link konnte nicht geladen werden.'));
  }, [code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    setError('');
    try {
      await api(`/invites/${code}`, { method: 'POST', body: { name, password } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError)
    return (
      <AuthShell kicker="Einladung">
        <p className="error">{loadError}</p>
        <a className="btn btn-ghost btn-block" href={import.meta.env.BASE_URL}>
          Zum Login
        </a>
      </AuthShell>
    );
  if (!info) return <div className="splash">Lade Einladung …</div>;

  return (
    <AuthShell kicker={info.resetName ? `Neues Passwort für ${info.resetName}` : 'Du bist eingeladen!'}>
      {!info.resetName && (
        <p className="lead">
          Leg dir deinen Account an. Damit bekommst du <strong>{info.maxVotes} Votes</strong> für die Spiele, die wir auf der LAN zocken.
        </p>
      )}
      <form onSubmit={submit} className="stack">
        {!info.resetName && (
          <label className="field">
            <span>Dein Name (so sehen dich die anderen)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="username" required autoFocus />
          </label>
        )}
        <label className="field">
          <span>Passwort</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
        </label>
        <label className="field">
          <span>Passwort wiederholen</span>
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} minLength={6} autoComplete="new-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Moment …' : info.resetName ? 'Passwort speichern' : "Los geht's"}
        </button>
      </form>
    </AuthShell>
  );
}
