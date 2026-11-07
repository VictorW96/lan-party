import { useCallback, useEffect, useState } from 'react';
import { api, currentPath, navigate, type User } from './api.ts';
import { AdminPage } from './pages/AdminPage.tsx';
import { BoardPage } from './pages/BoardPage.tsx';
import { InvitePage, LoginPage } from './pages/AuthPages.tsx';

function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api<{ user: User | null }>('/me');
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const inviteCode = path.match(/^\/invite\/([\w-]+)/)?.[1];
  if (inviteCode) return <InvitePage code={inviteCode} onDone={async () => (await refreshUser(), navigate('/'))} />;

  if (user === undefined) return <div className="splash">Lade …</div>;
  if (!user) return <LoginPage onDone={refreshUser} />;

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (path.startsWith('/admin') && user.is_admin) return <AdminPage user={user} onLogout={logout} />;
  return <BoardPage user={user} onLogout={logout} />;
}
