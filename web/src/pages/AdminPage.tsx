import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, navigate, type Settings, type User } from '../api.ts';
import { Avatar } from '../components/bits.tsx';
import { Header } from '../components/Header.tsx';

type AdminUser = { id: number; name: string; isAdmin: number; color: string; createdAt: string; votesUsed: number };
type Invite = { code: string; label: string; isAdmin: number; createdAt: string; resetName: string | null; url: string };
type AdminData = { users: AdminUser[]; invites: Invite[]; settings: Settings };

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy">
      <code>{url}</code>
      <button
        className="btn btn-ghost btn-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
    </div>
  );
}

export function AdminPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [label, setLabel] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  const [fresh, setFresh] = useState<{ title: string; url: string } | null>(null);
  const [eventDate, setEventDate] = useState('');

  const load = useCallback(async () => {
    const d = await api<AdminData>('/admin');
    setData(d);
    setEventDate(d.settings.eventDate);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const { url } = await api<{ url: string }>('/admin/invites', { method: 'POST', body: { label, isAdmin: asAdmin } });
    setFresh({ title: `Einladung für ${label || 'Freund'}`, url });
    setLabel('');
    setAsAdmin(false);
    await load();
  };

  const reset = async (u: AdminUser) => {
    const { url } = await api<{ url: string }>(`/admin/users/${u.id}/reset`, { method: 'POST' });
    setFresh({ title: `Passwort-Reset für ${u.name}`, url });
    await load();
  };

  const removeUser = async (u: AdminUser) => {
    if (!confirm(`Account „${u.name}“ inkl. aller Votes löschen?`)) return;
    await api(`/admin/users/${u.id}`, { method: 'DELETE' });
    await load();
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    await api('/admin/settings', { method: 'PUT', body: patch });
    await load();
  };

  return (
    <>
      <Header user={user} onLogout={onLogout} />
      <main className="page admin">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← Zur Abstimmung
        </button>
        <h1>Admin</h1>
        {!data ? (
          <p className="muted">Lade …</p>
        ) : (
          <div className="admin-grid">
            <section className="panel">
              <h2>Freunde einladen</h2>
              <p className="muted">
                Jeder bekommt einen eigenen Link, der genau einmal funktioniert. Darüber legt man Namen und Passwort fest und hat
                dann {data.settings.maxVotes} Votes.
              </p>
              <form className="row" onSubmit={invite}>
                <input className="grow" placeholder="Name, z. B. Max" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} />
                <label className="check">
                  <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} /> Admin
                </label>
                <button className="btn btn-primary">Link erstellen</button>
              </form>
              {fresh && (
                <div className="fresh">
                  <strong>{fresh.title}</strong>
                  <CopyLink url={fresh.url} />
                </div>
              )}
              {data.invites.length > 0 && (
                <>
                  <h3>Offene Links</h3>
                  <ul className="list">
                    {data.invites.map((i) => (
                      <li key={i.code}>
                        <div className="grow">
                          <strong>{i.resetName ? `Reset: ${i.resetName}` : i.label}</strong>
                          {i.isAdmin ? <span className="badge badge-warn">Admin</span> : null}
                          <CopyLink url={i.url} />
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            await api(`/admin/invites/${i.code}`, { method: 'DELETE' });
                            await load();
                          }}
                        >
                          Widerrufen
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="panel">
              <h2>Abstimmung</h2>
              <label className="check">
                <input type="checkbox" checked={data.settings.votingOpen} onChange={(e) => saveSettings({ votingOpen: e.target.checked })} />
                <span>Abstimmung offen (Votes können geändert werden)</span>
              </label>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveSettings({ eventDate });
                }}
              >
                <label className="field grow">
                  <span>Start der LAN (für den Countdown)</span>
                  <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </label>
                <button className="btn btn-ghost">Speichern</button>
              </form>
              <p className="muted small">
                KI-Anreicherung: {data.settings.aiEnrichment ? 'aktiv (Claude)' : 'aus, nur Steam-Daten. Zum Einschalten ANTHROPIC_API_KEY setzen.'}
              </p>
            </section>

            <section className="panel panel-wide">
              <h2>Accounts ({data.users.length})</h2>
              <ul className="list">
                {data.users.map((u) => (
                  <li key={u.id}>
                    <Avatar voter={u} size={28} />
                    <div className="grow">
                      <strong>{u.name}</strong> {u.isAdmin ? <span className="badge badge-warn">Admin</span> : null}
                      <div className="muted small">
                        {u.votesUsed}/{data.settings.maxVotes} Votes vergeben
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => reset(u)}>
                      Passwort-Reset-Link
                    </button>
                    {u.id !== user.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeUser(u)}>
                        Löschen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
