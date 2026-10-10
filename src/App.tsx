import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { repo } from './data';
import type { User, Workspace } from './data/repo';
import { AuthPage, Dashboard, FirmSettings, FirmSetup } from './pages';
import { message } from './ui';
import { EngagementPage } from './workspace';

type Session =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'signed-out' }
  | { state: 'no-firm'; user: User }
  | { state: 'ready'; user: User; ws: Workspace };

export function App() {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const user = await repo.currentUser();
      if (!user) return setSession({ state: 'signed-out' });
      const ws = await repo.workspace();
      setSession(ws ? { state: 'ready', user, ws } : { state: 'no-firm', user });
    } catch (e) {
      setSession({ state: 'error', error: message(e) });
    }
  };

  useEffect(() => {
    void refresh();
    return repo.onAuthChange(() => void refresh());
  }, []);

  return (
    <>
      {repo.mode === 'demo' && (
        <div className="demo-strip">
          Demo mode. Data is kept in this browser only and is not secure. Do not enter real client data until the database is connected.
        </div>
      )}
      <header className="topbar">
        <Link to="/" className="brand">
          Verit<span>Books</span>
        </Link>
        <div className="spacer" />
        {session.state === 'ready' && (
          <>
            <Link to="/firm" className="small">
              {session.ws.firm.name}
            </Link>
            <span className="small muted">
              {session.ws.me.fullName || session.user.email} · {session.ws.me.role}
            </span>
          </>
        )}
        {(session.state === 'ready' || session.state === 'no-firm') && (
          <button
            onClick={() => {
              // The next person to sign in on this browser starts from the home page.
              nav('/');
              void repo.signOut();
            }}
          >
            Sign out
          </button>
        )}
      </header>

      {session.state === 'loading' && <div className="page muted">Loading…</div>}
      {session.state === 'error' && (
        <div className="page">
          <div className="banner bad">Could not reach the database: {session.error}</div>
        </div>
      )}
      {session.state === 'signed-out' && <AuthPage />}
      {session.state === 'no-firm' && <FirmSetup onDone={refresh} />}
      {session.state === 'ready' && (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/firm" element={<FirmSettings ws={session.ws} onSaved={refresh} />} />
          <Route path="/engagements/:id/:step?" element={<EngagementPage ws={session.ws} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
