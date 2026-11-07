import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '../api.ts';
import { Logo } from '../components/Logo.tsx';

function AuthShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <h1>{title}</h1>
        {children}
      </div>
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
    <AuthShell title="Anmelden">
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
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
      <p className="hint">Noch kein Account? Victor schickt dir einen Einladungslink.</p>
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
      <AuthShell title="Einladung">
        <p className="error">{loadError}</p>
        <a className="btn btn-ghost btn-block" href={import.meta.env.BASE_URL}>
          Zum Login
        </a>
      </AuthShell>
    );
  if (!info) return <div className="splash">Lade Einladung …</div>;

  return (
    <AuthShell title={info.resetName ? `Neues Passwort für ${info.resetName}` : 'Account anlegen'}>
      {!info.resetName && (
        <p className="lead">
          Mit deinem Account hast du {info.maxVotes} Votes für die Spiele, die wir auf der LAN zocken.
        </p>
      )}
      <form onSubmit={submit} className="stack">
        {!info.resetName && (
          <label className="field">
            <span>Name (sehen die anderen)</span>
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
          {busy ? 'Speichern …' : info.resetName ? 'Passwort speichern' : 'Account anlegen'}
        </button>
      </form>
    </AuthShell>
  );
}
