import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROGRAMME_VERSION } from './content/programmes';
import { repo } from './data';
import type { Workspace } from './data/repo';
import { longDate } from './engine/report';
import type { EngagementType } from './engine/types';
import { ErrorNote, Field, useAction, useLoad } from './ui';

export const TYPE_LABEL: Record<EngagementType, string> = {
  audit: 'Audit',
  review: 'Review',
  compilation: 'Compilation',
};

export function AuthPage() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  return (
    <div className="narrow stack">
      <div>
        <h1>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Engagement files for Nigerian audit, review and compilation work.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setNotice(null);
          void run(async () => {
            if (mode === 'in') await repo.signIn(email, password);
            else if (await repo.signUp(email, password)) {
              setNotice('Check your email to confirm the account, then sign in.');
              setMode('in');
            }
          });
        }}
      >
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNote error={error} />
        {notice && <div className="banner info">{notice}</div>}
        <button className="primary" disabled={busy}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="small">
        {mode === 'in' ? 'New here? ' : 'Already registered? '}
        <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}

export function FirmSetup({ onDone }: { onDone: () => Promise<void> }) {
  const [f, setF] = useState({ name: '', frcNumber: '', address: '', fullName: '', memberFrc: '' });
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="narrow stack" style={{ maxWidth: 560 }}>
      <div>
        <h1>Set up your firm</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          You become the firm’s first engagement partner. FRC numbers are printed on every signed report, and a file cannot be signed without them.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await repo.createFirm(f);
            await onDone();
          });
        }}
      >
        <Field label="Firm name">
          <input type="text" required value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Firm FRC registration number" hint="You can add this later, but it is needed before sign-off.">
          <input type="text" value={f.frcNumber} onChange={set('frcNumber')} />
        </Field>
        <Field label="Office address">
          <input type="text" value={f.address} onChange={set('address')} />
        </Field>
        <div className="grid2">
          <Field label="Your full name">
            <input type="text" required value={f.fullName} onChange={set('fullName')} />
          </Field>
          <Field label="Your FRC registration number">
            <input type="text" value={f.memberFrc} onChange={set('memberFrc')} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <button className="primary" disabled={busy}>
          Create firm
        </button>
      </form>
    </div>
  );
}

export function FirmSettings({ ws, onSaved }: { ws: Workspace; onSaved: () => Promise<void> }) {
  const [firm, setFirm] = useState({ name: ws.firm.name, frcNumber: ws.firm.frcNumber, address: ws.firm.address });
  const [me, setMe] = useState({ fullName: ws.me.fullName, frcNumber: ws.me.frcNumber });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';

  return (
    <div className="page stack" style={{ maxWidth: 720 }}>
      <h1>Firm details</h1>
      {!partner && <div className="banner info">Only a partner can change these details.</div>}
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          void run(async () => {
            await repo.updateFirm(firm);
            await repo.updateMyProfile(me);
            await onSaved();
            setSaved(true);
          });
        }}
      >
        <div className="grid2">
          <Field label="Firm name">
            <input type="text" required disabled={!partner} value={firm.name} onChange={(e) => setFirm({ ...firm, name: e.target.value })} />
          </Field>
          <Field label="Firm FRC registration number">
            <input type="text" disabled={!partner} value={firm.frcNumber} onChange={(e) => setFirm({ ...firm, frcNumber: e.target.value })} />
          </Field>
        </div>
        <Field label="Office address">
          <input type="text" disabled={!partner} value={firm.address} onChange={(e) => setFirm({ ...firm, address: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label="Your full name">
            <input type="text" disabled={!partner} value={me.fullName} onChange={(e) => setMe({ ...me, fullName: e.target.value })} />
          </Field>
          <Field label="Your FRC registration number">
            <input type="text" disabled={!partner} value={me.frcNumber} onChange={(e) => setMe({ ...me, frcNumber: e.target.value })} />
          </Field>
        </div>
        <ErrorNote error={error} />
        {saved && <div className="banner info">Saved.</div>}
        {partner && (
          <div>
            <button className="primary" disabled={busy}>
              Save
            </button>
          </div>
        )}
      </form>
      <div className="card">
        <h3>Team</h3>
        <table className="data" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>FRC number</th>
            </tr>
          </thead>
          <tbody>
            {ws.members.map((m) => (
              <tr key={m.userId}>
                <td>{m.fullName || '—'}</td>
                <td>{m.role}</td>
                <td>{m.frcNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Inviting managers and staff is not built yet.
        </p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const nav = useNavigate();
  const { data, error, reload } = useLoad(
    async () => ({ clients: await repo.listClients(), engagements: await repo.listEngagements() }),
    [],
  );
  const [client, setClient] = useState({ name: '', rcNumber: '' });
  const [eng, setEng] = useState({ clientId: '', type: 'audit' as EngagementType, yearEnd: '', notPie: false });
  const a1 = useAction();
  const a2 = useAction();

  if (error) return <div className="page"><ErrorNote error={error} /></div>;
  if (!data) return <div className="page muted">Loading…</div>;
  const name = (id: string) => data.clients.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="page stack">
      <h1>Engagements</h1>

      <div className="card">
        {data.engagements.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No engagements yet. Add a client, then open an engagement for a year end.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Year end</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.engagements.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => nav(`/engagements/${e.id}`)}>
                    <td>
                      <a
                        href={`/engagements/${e.id}`}
                        onClick={(ev) => {
                          ev.preventDefault();
                        }}
                      >
                        {name(e.clientId)}
                      </a>
                    </td>
                    <td>{TYPE_LABEL[e.type]}</td>
                    <td>{longDate(e.yearEnd)}</td>
                    <td>
                      {e.status === 'locked' ? <span className="tag ok">Signed and locked</span> : <span className="tag">In progress</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void a2.run(async () => {
              const created = await repo.createEngagement({
                clientId: eng.clientId,
                type: eng.type,
                yearEnd: eng.yearEnd,
                programmeVersion: PROGRAMME_VERSION,
              });
              nav(`/engagements/${created.id}`);
            });
          }}
        >
          <h3>New engagement</h3>
          <Field label="Client">
            <select required value={eng.clientId} onChange={(e) => setEng({ ...eng, clientId: e.target.value })}>
              <option value="">Select a client</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Engagement type">
              <select value={eng.type} onChange={(e) => setEng({ ...eng, type: e.target.value as EngagementType })}>
                <option value="audit">Audit</option>
                <option value="review">Review</option>
                <option value="compilation">Compilation</option>
              </select>
            </Field>
            <Field label="Year end">
              <input type="date" required value={eng.yearEnd} onChange={(e) => setEng({ ...eng, yearEnd: e.target.value })} />
            </Field>
          </div>
          <label className="row small" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input type="checkbox" required checked={eng.notPie} onChange={(e) => setEng({ ...eng, notPie: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              The client is not a public interest entity and reports under the IFRS for SMEs Accounting Standard. Listed companies, banks, insurers and other regulated entities need full IFRS, which this version does not support.
            </span>
          </label>
          <ErrorNote error={a2.error} />
          <div>
            <button className="primary" disabled={a2.busy || data.clients.length === 0}>
              Open engagement
            </button>
          </div>
        </form>

        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void a1.run(async () => {
              const c = await repo.createClient({ ...client, sector: 'General trading and services' });
              setClient({ name: '', rcNumber: '' });
              setEng((x) => ({ ...x, clientId: c.id }));
              reload();
            });
          }}
        >
          <h3>New client</h3>
          <Field label="Company name">
            <input type="text" required value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          </Field>
          <Field label="RC number">
            <input type="text" value={client.rcNumber} onChange={(e) => setClient({ ...client, rcNumber: e.target.value })} />
          </Field>
          <p className="small muted" style={{ margin: 0 }}>Sector template: general trading and services.</p>
          <ErrorNote error={a1.error} />
          <div>
            <button disabled={a1.busy}>Add client</button>
          </div>
        </form>
      </div>
    </div>
  );
}
