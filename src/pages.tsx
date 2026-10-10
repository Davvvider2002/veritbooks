import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROGRAMME_VERSION } from './content/programmes';
import { repo } from './data';
import type { Workspace } from './data/repo';
import { longDate } from './engine/report';
import type { EngagementType, Role } from './engine/types';
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
  const [join, setJoin] = useState({ fullName: '', frcNumber: '' });
  const { busy, error, run } = useAction();
  const joining = useAction();
  // Invitations are checked quietly: a database without the team update simply shows none.
  const invites = useLoad(() => repo.myInvites().catch(() => []), []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const pending = invites.data ?? [];

  return (
    <div className="narrow stack" style={{ maxWidth: 560 }}>
      {pending.length > 0 && (
        <>
          <div>
            <h1>Join your firm</h1>
            <p className="muted" style={{ marginTop: 6 }}>You have been invited. Confirm your details to join.</p>
          </div>
          <div className="card stack">
            <div className="grid2">
              <Field label="Your full name">
                <input type="text" value={join.fullName} onChange={(e) => setJoin({ ...join, fullName: e.target.value })} />
              </Field>
              <Field label="Your FRC registration number" hint="Leave blank if you are not registered.">
                <input type="text" value={join.frcNumber} onChange={(e) => setJoin({ ...join, frcNumber: e.target.value })} />
              </Field>
            </div>
            <ErrorNote error={joining.error} />
            {pending.map((i) => (
              <div key={i.id} className="between" style={{ alignItems: 'center' }}>
                <span>
                  <strong>{i.firmName}</strong> <span className="muted">as {i.role}</span>
                </span>
                <button
                  className="primary"
                  disabled={joining.busy}
                  onClick={() => {
                    if (!join.fullName.trim()) return joining.setError('Enter your full name.');
                    void joining.run(async () => {
                      await repo.acceptInvite(i.id, join.fullName, join.frcNumber);
                      await onDone();
                    });
                  }}
                >
                  Join {i.firmName}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div>
        {pending.length > 0 ? <h2>Or set up a new firm</h2> : <h1>Set up your firm</h1>}
        <p className="muted" style={{ marginTop: 6 }}>
          You become the firm’s first engagement partner. FRC numbers are printed on every signed report, and a file cannot be signed without them.
          {pending.length === 0 && ' If a colleague has invited you instead, sign in with the email address they invited.'}
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
          <Field label="Partner’s full name">
            <input type="text" required value={f.fullName} onChange={set('fullName')} />
          </Field>
          <Field label="Partner’s FRC registration number">
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

const ROLES: Role[] = ['partner', 'manager', 'staff'];

function Team({ ws, onChanged }: { ws: Workspace; onChanged: () => Promise<void> }) {
  const partner = ws.me.role === 'partner';
  const invites = useLoad(() => (partner ? repo.listInvites() : Promise.resolve([])), [partner]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const { busy, error, run } = useAction();
  const open = (invites.data ?? []).filter((i) => !i.accepted);

  return (
    <div className="card stack">
      <h3>Team</h3>
      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>FRC number</th>
              {partner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ws.members.map((m) => (
              <tr key={m.userId}>
                <td>
                  {m.fullName || '—'}
                  {m.userId === ws.me.userId && <span className="muted"> (you)</span>}
                </td>
                <td>
                  {partner ? (
                    <select
                      aria-label={`Role of ${m.fullName || 'member'}`}
                      disabled={busy}
                      value={m.role}
                      onChange={(e) =>
                        void run(async () => {
                          await repo.setMemberRole(m.userId, e.target.value as Role);
                          await onChanged();
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    m.role
                  )}
                </td>
                <td>{m.frcNumber || '—'}</td>
                {partner && (
                  <td style={{ textAlign: 'right' }}>
                    {m.userId !== ws.me.userId && (
                      <button
                        className="link danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await repo.removeMember(m.userId);
                            await onChanged();
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorNote error={error} />
      {partner && invites.error && (
        <div className="banner warn">
          Invitations need a database update. Run <code>supabase/migrations/0003_team_and_evidence.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      )}
      {partner && !invites.error && (
        <>
          {open.length > 0 && (
            <div>
              <div className="small muted" style={{ fontWeight: 600 }}>Invited, not yet joined</div>
              {open.map((i) => (
                <div key={i.id} className="between" style={{ padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span>
                    {i.email} <span className="muted">as {i.role}</span>
                  </span>
                  <button
                    className="link danger"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await repo.deleteInvite(i.id);
                        invites.reload();
                      })
                    }
                  >
                    Withdraw
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            className="row"
            style={{ alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await repo.createInvite(email, role);
                setEmail('');
                invites.reload();
              });
            }}
          >
            <div style={{ flex: '1 1 240px' }}>
              <Field label="Invite a colleague by email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <div style={{ width: 140 }}>
              <Field label="Role">
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
            <button disabled={busy}>Invite</button>
          </form>
          <p className="small muted" style={{ margin: 0 }}>
            No email is sent. Ask your colleague to create an account at this site with the same email address. Once they confirm it, they are offered a place in the firm. Only partners can sign a file.
          </p>
        </>
      )}
    </div>
  );
}

/** AI assistance is off until a partner turns it on, with the consequences set out first. */
function AssistSetting({ ws, onChanged }: { ws: Workspace; onChanged: () => Promise<void> }) {
  const { busy, error, run } = useAction();
  const [agreed, setAgreed] = useState(false);
  const on = ws.firm.aiEnabled;
  const partner = ws.me.role === 'partner';
  return (
    <section className="card stack" aria-label="AI assistance">
      <div className="between">
        <h3>AI assistance</h3>
        <span className={`tag ${on ? 'ok' : ''}`}>{on ? 'On' : 'Off'}</span>
      </div>
      <p style={{ margin: 0 }}>
        When this is on, your team can ask for a suggested statement line for an unmapped account, and for a plain-language explanation of a flagged journal. Every suggestion is shown for a person to accept or reject. Nothing is applied on its own, and the AI never chooses an opinion, concludes on a test or signs anything.
      </p>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Each request sends data outside VeritBooks to Anthropic, the maker of the Claude models, for processing. A mapping request sends account codes, names and balances. A journal request sends its date, description, the name of whoever posted it, the accounts and the amounts.</li>
        <li>Client and firm names are not sent. A journal description can still name a person or a company.</li>
        <li>Check your engagement letters and your duties under the Nigeria Data Protection Act before turning this on. How the data is handled after it is sent is governed by the terms of the API account this installation uses.</li>
        <li>AI output can be wrong and can sound sure when it is. It has not seen your evidence. Treat it as a prompt for your own work, never as audit evidence.</li>
        <li>Each request is logged with who made it and when. The content is not kept in the log.</li>
      </ul>
      <ErrorNote error={error} />
      {partner ? (
        on ? (
          <div>
            <button disabled={busy} onClick={() => void run(async () => { await repo.setAssist(false); await onChanged(); })}>
              Turn AI assistance off
            </button>
          </div>
        ) : (
          <>
            <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
              <span>I am a partner. I have read the points above and I am satisfied the firm may send this data.</span>
            </label>
            <div>
              <button className="primary" disabled={busy || !agreed} onClick={() => void run(async () => { await repo.setAssist(true); setAgreed(false); await onChanged(); })}>
                Turn AI assistance on
              </button>
            </div>
          </>
        )
      ) : (
        <span className="small muted">Only a partner can change this.</span>
      )}
    </section>
  );
}

export function FirmSettings({ ws, onSaved }: { ws: Workspace; onSaved: () => Promise<void> }) {
  const [firm, setFirm] = useState({ name: ws.firm.name, frcNumber: ws.firm.frcNumber, address: ws.firm.address });
  const [me, setMe] = useState({ fullName: ws.me.fullName, frcNumber: ws.me.frcNumber });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';

  return (
    <div className="page stack" style={{ maxWidth: 760 }}>
      <h1>Firm details</h1>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          void run(async () => {
            if (partner) await repo.updateFirm(firm);
            await repo.updateMyProfile(me);
            await onSaved();
            setSaved(true);
          });
        }}
      >
        {!partner && <div className="banner info">Only a partner can change the firm’s details. You can change your own.</div>}
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
            <input type="text" value={me.fullName} onChange={(e) => setMe({ ...me, fullName: e.target.value })} />
          </Field>
          <Field label="Your FRC registration number">
            <input type="text" value={me.frcNumber} onChange={(e) => setMe({ ...me, frcNumber: e.target.value })} />
          </Field>
        </div>
        <ErrorNote error={error} />
        {saved && <div className="banner info">Saved.</div>}
        <div>
          <button className="primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
      <AssistSetting ws={ws} onChanged={onSaved} />
      <Team ws={ws} onChanged={onSaved} />
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
