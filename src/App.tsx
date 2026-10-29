import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AdminApp } from './admin';
import { PARTNER_INTENT, PartnerApp } from './partners/PartnerApp';
import { ClientsPage } from './clients';
import { BillingPage, PlanStrip } from './billing';
import { SecondFactor } from './mfa';
import { Landing } from './landing/Landing';
import { PortalPage } from './portal';
import { VerifyPage } from './seal';
import { PrivacyPage, TermsPage } from './legal';
import { QualityPage } from './quality';
import { repo } from './data';
import type { User, Workspace } from './data/repo';
import { AuthPage, Dashboard, FirmSettings, FirmSetup, ForgotPage, NewPasswordPage } from './pages';
import { message } from './ui';
import { EngagementPage } from './workspace';
import { applyReportTypeface } from './content/typefaces';
import { setDateLocale } from './engine/report';

type Session =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'signed-out' }
  | { state: 'no-firm'; user: User }
  | { state: 'new-password'; user: User }
  | { state: 'second-factor'; user: User }
  | { state: 'ready'; user: User; ws: Workspace };

export function App() {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const nav = useNavigate();
  // A client's upload link. It works without a sign-in and shows nothing of the firm's workspace.
  const path = useLocation().pathname;
  const portal = /^\/r\/([^/]+)\/?$/.exec(path)?.[1];
  // The platform owner's console has its own sign-in and shares nothing with a firm's workspace.
  const admin = /^\/admin\/?$/.test(path);
  // The partner portal has its own sign-in and shows nothing of any firm's workspace.
  const partners = /^\/partners\/?$/.test(path);
  // Anyone holding a signed report checks its seal here, with no sign-in.
  const verify = /^\/verify(?:\/([^/]+))?\/?$/.exec(path);
  // The privacy policy and terms are public pages.
  const legal = /^\/(privacy|terms)\/?$/.exec(path)?.[1];

  const refresh = async () => {
    try {
      const user = await repo.currentUser();
      if (!user) return setSession({ state: 'signed-out' });
      const ws = await repo.workspace();
      // Someone who came from a reset link chooses a new password before anything else opens.
      if (repo.recovering()) return setSession({ state: 'new-password', user });
      // Someone who has turned on two-factor enters their code before anything of the firm opens.
      const mfa = await repo.mfaStatus().catch(() => ({ enrolled: false, verified: false }));
      if (mfa.enrolled && !mfa.verified) return setSession({ state: 'second-factor', user });
      // A platform admin with no firm of their own belongs in the admin console, not firm setup.
      // A public page (a seal check or a client's upload link) is never redirected away from.
      const publicPage = /^\/(verify|r|privacy|terms)(\/|$)/.test(window.location.pathname);
      if (!ws && !publicPage && (await repo.adminStatus()).admin) return nav('/admin', { replace: true });
      // A partner with no firm of their own, or someone who signed up to be one, belongs in the partner portal.
      if (!ws) {
        let intent = false;
        try {
          intent = localStorage.getItem(PARTNER_INTENT) === '1';
        } catch {
          // Storage unavailable.
        }
        if (!publicPage && (intent || (await repo.partnerMe().catch(() => null)))) return nav('/partners', { replace: true });
      }
      setSession(ws ? { state: 'ready', user, ws } : { state: 'no-firm', user });
    } catch (e) {
      setSession({ state: 'error', error: message(e) });
    }
  };

  useEffect(() => {
    void refresh();
    return repo.onAuthChange(() => void refresh());
  }, []);
  // The firm's report typeface, for every report sheet.
  const reportFont = session.state === 'ready' ? session.ws.firm.branding?.font : undefined;
  useEffect(() => applyReportTypeface(reportFont), [reportFont]);
  // Dates read the way the firm's country writes them. Set before the pages render.
  setDateLocale(session.state === 'ready' ? session.ws.firm.country : 'NG');

  if (admin && session.state !== 'new-password') return <AdminApp />;
  if (partners && session.state !== 'new-password') return <PartnerApp />;
  // A visitor who is not signed in sees the public site at the front door.
  if (session.state === 'signed-out' && path === '/') return <Landing />;
  if (legal)
    return (
      <>
        <header className="topbar">
          <a className="brand" href="/" style={{ textDecoration: 'none' }}>
            Verit<span>Books</span>
          </a>
        </header>
        {legal === 'privacy' ? <PrivacyPage /> : <TermsPage />}
      </>
    );
  if (verify)
    return (
      <>
        <header className="topbar">
          <a className="brand" href="/" style={{ textDecoration: 'none' }}>
            Verit<span>Books</span>
          </a>
        </header>
        <VerifyPage code={verify[1] ? decodeURIComponent(verify[1]) : undefined} />
      </>
    );
  if (portal)
    return (
      <>
        <header className="topbar">
          <span className="brand">
            Verit<span>Books</span>
          </span>
        </header>
        <PortalPage token={portal} />
      </>
    );

  return (
    <>
      {repo.mode === 'demo' && (
        <div className="demo-strip">
          Demo mode. Data is kept in this browser only and is not secure. Do not enter real client data until the database is connected.
        </div>
      )}
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/landing/logo-mark.png" alt="" />
          Verit<span>Books</span>
        </Link>
        <div className="spacer" />
        {session.state === 'ready' && (
          <>
            <Link to="/" className="small">
              Engagements
            </Link>
            <Link to="/clients" className="small">
              Clients
            </Link>
            <Link to="/quality" className="small">
              Quality
            </Link>
            <Link to="/billing" className="small">
              Billing
            </Link>
            <Link to="/firm" className="small">
              {session.ws.firm.name}
            </Link>
            <span className="small muted">
              {session.ws.me.fullName || session.user.email} · {session.ws.me.role}
            </span>
          </>
        )}
        {(session.state === 'ready' || session.state === 'no-firm' || session.state === 'new-password' || session.state === 'second-factor') && (
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

      {session.state === 'ready' && <PlanStrip billing={session.ws.billing} />}
      {session.state === 'loading' && <div className="page muted">Loading…</div>}
      {session.state === 'error' && (
        <div className="page">
          <div className="banner bad">Could not reach the database: {session.error}</div>
        </div>
      )}
      {session.state === 'signed-out' && (path === '/forgot' ? <ForgotPage /> : <AuthPage key={path} start={path === '/signup' ? 'up' : 'in'} />)}
      {session.state === 'new-password' && <NewPasswordPage onDone={refresh} />}
      {session.state === 'second-factor' && <SecondFactor enrolled onDone={() => void refresh()} />}
      {session.state === 'no-firm' && <FirmSetup onDone={refresh} user={session.user} />}
      {session.state === 'ready' && (
        <Routes>
          <Route path="/" element={<Dashboard ws={session.ws} />} />
          <Route path="/clients" element={<ClientsPage ws={session.ws} />} />
          <Route path="/quality" element={<QualityPage ws={session.ws} />} />
          <Route path="/billing" element={<BillingPage ws={session.ws} onChanged={refresh} />} />
          <Route path="/firm" element={<FirmSettings ws={session.ws} onSaved={refresh} />} />
          <Route path="/engagements/:id/:step?" element={<EngagementPage ws={session.ws} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
