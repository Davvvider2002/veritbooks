import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PROGRAMME_VERSION } from './content/programmes';
import { repo } from './data';
import { readLogo } from './image';
import { TwoFactorSetting } from './mfa';
import type { Branding, Workspace } from './data/repo';
import { longDate } from './engine/report';
import type { EngagementType, Role } from './engine/types';
import { ErrorNote, Field, message, useAction, useLoad } from './ui';

export const TYPE_LABEL: Record<EngagementType, string> = {
  audit: 'Audit',
  review: 'Review',
  compilation: 'Compilation',
};

export function AuthPage({ start = 'in' }: { start?: 'in' | 'up' }) {
  const [mode, setMode] = useState<'in' | 'up'>(start);
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
      {mode === 'in' && (
        <p className="small">
          <Link to="/forgot">Forgot your password?</Link>
        </p>
      )}
      <p className="small">
        {mode === 'in' ? 'New here? ' : 'Already registered? '}
        <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}

/** Asks for the account's email and sends a link for choosing a new password. */
export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <div className="narrow stack">
      <div>
        <h1>Reset your password</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Enter the email address you sign in with. We will send a link for choosing a new password.
        </p>
      </div>
      {sent ? (
        <div className="banner info">
          If an account uses {email}, a reset link is on its way. Open it on this device. It can take a few minutes, and it may land in spam.
        </div>
      ) : (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await repo.requestPasswordReset(email.trim());
              setSent(true);
            });
          }}
        >
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <button className="primary" disabled={busy}>
            Send reset link
          </button>
        </form>
      )}
      <p className="small">
        <Link to="/signin">Back to sign in</Link>
      </p>
    </div>
  );
}

/** Shown to someone who arrived from a reset link. Nothing else opens until a new password is set. */
export function NewPasswordPage({ onDone }: { onDone: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <div className="narrow stack">
      <div>
        <h1>Choose a new password</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Use at least 8 characters. You stay signed in once it is saved. If you were invited by a colleague, you can join their firm next.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== again) return setMismatch(true);
          setMismatch(false);
          void run(async () => {
            await repo.setPassword(password);
            await onDone();
          });
        }}
      >
        <Field label="New password">
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="New password again">
          <input type="password" required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        <ErrorNote error={mismatch ? 'The two passwords are not the same.' : error} />
        <button className="primary" disabled={busy}>
          Save new password
        </button>
      </form>
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
  const [notice, setNotice] = useState<string | null>(null);
  const open = (invites.data ?? []).filter((i) => !i.accepted);
  const send = (id: string) =>
    run(async () => {
      setNotice(null);
      try {
        setNotice(await repo.sendInvite(id));
      } finally {
        invites.reload();
      }
    });

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
      {notice && <div className="banner info">{notice}</div>}
      {partner && invites.error && (
        <div className="banner warn">
          Invitations could not be loaded: {invites.error}{' '}
          <button className="link" onClick={() => invites.reload()}>
            Try again
          </button>
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
                  <span className="row" style={{ gap: 16 }}>
                    <button className="link" disabled={busy} aria-label={`Resend invitation to ${i.email}`} onClick={() => void send(i.id)}>
                      Resend
                    </button>
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
                  </span>
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
                setNotice(null);
                const id = await repo.createInvite(email, role);
                setEmail('');
                invites.reload();
                setNotice(await repo.sendInvite(id).catch((e) => `The invitation is saved, but the email was not sent: ${message(e)}`));
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
            Your colleague gets an email with a link. They set a password, confirm their name, and join the firm. If the email does not arrive, use Resend, or ask them to create an account here with the same email address. Only partners can sign a file.
          </p>
        </>
      )}
    </div>
  );
}

/** How the firm's printed reports look. Partners and managers. */
function BrandingSetting({ ws, onChanged }: { ws: Workspace; onChanged: () => Promise<void> }) {
  const [b, setB] = useState<Branding>({ cover: true, contents: true, logoOnReport: true, watermark: true, font: 'serif', ...ws.firm.branding });
  const [saved, setSaved] = useState(false);
  const { busy, error, run, setError } = useAction();
  const can = ws.me.role === 'partner' || ws.me.role === 'manager';
  const set = (patch: Partial<Branding>) => {
    setSaved(false);
    setB({ ...b, ...patch });
  };
  const tick = (key: 'cover' | 'contents' | 'logoOnReport' | 'watermark', label: string) => (
    <label className="row small" style={{ flexWrap: 'nowrap' }}>
      <input type="checkbox" disabled={!can} checked={b[key] !== false} onChange={(e) => set({ [key]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );
  return (
    <section className="card stack" aria-label="Report branding">
      <h3>Report branding</h3>
      <p className="small muted" style={{ margin: 0 }}>
        How your financial statements, reports and management letters look when printed. A client’s own logo and its position are set on the Clients page.
      </p>
      <div className="grid2">
        <Field label="Firm logo">
          <div className="row">
            {b.logo ? <img className="logo-preview" src={b.logo} alt={`${ws.firm.name} logo`} /> : <span className="small muted">No logo</span>}
            {can && (
              <>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  aria-label="Upload firm logo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError(null);
                    void readLogo(file).then((logo) => set({ logo }), (err) => setError(message(err)));
                  }}
                />
                {b.logo && (
                  <button className="link danger" onClick={() => set({ logo: undefined })}>
                    Remove logo
                  </button>
                )}
              </>
            )}
          </div>
        </Field>
        <Field label="Typeface">
          <select disabled={!can} value={b.font ?? 'serif'} onChange={(e) => set({ font: e.target.value as 'serif' | 'sans' })}>
            <option value="serif">Classic (serif)</option>
            <option value="sans">Modern (sans serif)</option>
          </select>
        </Field>
      </div>
      <div className="grid2">
        <div className="stack" style={{ gap: 6 }}>
          {tick('watermark', 'Firm logo as a faint watermark on the cover page')}
          {tick('logoOnReport', 'Firm logo at the top of the auditor’s report and management letter')}
          {tick('cover', 'Print a cover page')}
          {tick('contents', 'Print a contents page')}
        </div>
        <Field label="Footer on every page" hint="For example your firm’s name, address and telephone. Two lines at most.">
          <textarea disabled={!can} rows={2} maxLength={240} value={b.footer ?? ''} onChange={(e) => set({ footer: e.target.value })} />
        </Field>
      </div>
      <ErrorNote error={error} />
      {saved && <div className="banner info">Saved. Open any file’s Financial statements step to see it.</div>}
      {can ? (
        <div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await repo.setBranding(b);
                await onChanged();
                setSaved(true);
              })
            }
          >
            Save branding
          </button>
        </div>
      ) : (
        <span className="small muted">Only a partner or manager can change this.</span>
      )}
    </section>
  );
}

/** Whether audit file numbers are typed by hand or given automatically. Partners only. */
function FileNumbering({ ws, onChanged }: { ws: Workspace; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState(ws.firm.fileNumbering.mode);
  const [pattern, setPattern] = useState(ws.firm.fileNumbering.pattern || 'AF/{YYYY}/{N}');
  const [next, setNext] = useState(String(ws.firm.nextFileNo));
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';
  const example = pattern.replace('{YYYY}', '2025').replace('{YY}', '25').replace('{N}', String(Number(next) || 1).padStart(3, '0'));
  return (
    <section className="card stack" aria-label="Audit file numbers">
      <h3>Audit file numbers</h3>
      <div className="grid3">
        <Field label="Numbering">
          <select disabled={!partner} value={mode} onChange={(e) => { setSaved(false); setMode(e.target.value as 'manual' | 'auto'); }}>
            <option value="manual">Manual: typed for each engagement</option>
            <option value="auto">Automatic: from a pattern</option>
          </select>
        </Field>
        {mode === 'auto' && (
          <>
            <Field label="Pattern" hint="{YYYY} year of the year end, {YY} its last two digits, {N} the number.">
              <input type="text" disabled={!partner} value={pattern} maxLength={40} onChange={(e) => { setSaved(false); setPattern(e.target.value); }} />
            </Field>
            <Field label="Next number" hint={`The next file will be ${example}.`}>
              <input type="number" min={1} disabled={!partner} value={next} onChange={(e) => { setSaved(false); setNext(e.target.value); }} />
            </Field>
          </>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        A number can always be typed or changed on the engagement itself until it is signed. Numbers are unique within the firm.
      </p>
      <ErrorNote error={error} />
      {saved && <div className="banner info">Saved.</div>}
      {partner ? (
        <div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await repo.setFileNumbering(mode, pattern, Number(next) || 1);
                await onChanged();
                setSaved(true);
              })
            }
          >
            Save numbering
          </button>
        </div>
      ) : (
        <span className="small muted">Only a partner can change this.</span>
      )}
    </section>
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
      {ws.me.role === 'partner' && <TwoFactorSetting />}
      <BrandingSetting ws={ws} onChanged={onSaved} />
      <FileNumbering ws={ws} onChanged={onSaved} />
      <AssistSetting ws={ws} onChanged={onSaved} />
      <Team ws={ws} onChanged={onSaved} />
    </div>
  );
}

export function Dashboard({ ws }: { ws: Workspace }) {
  const nav = useNavigate();
  const { data, error, reload } = useLoad(
    async () => ({ clients: await repo.listClients(), engagements: await repo.listEngagements() }),
    [],
  );
  const [client, setClient] = useState({ name: '', rcNumber: '' });
  const [eng, setEng] = useState({ clientId: '', type: 'audit' as EngagementType, yearEnd: '', notPie: false, fileNo: '' });
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
                  <th>File no.</th>
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
                    <td className="small">{e.fileNo || '–'}</td>
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
                fileNo: eng.fileNo,
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
          <Field
            label="Audit file number"
            hint={ws.firm.fileNumbering.mode === 'auto' ? `Leave blank to number it automatically (${ws.firm.fileNumbering.pattern}).` : 'Optional. A partner can switch on automatic numbering in Firm details.'}
          >
            <input type="text" maxLength={60} value={eng.fileNo} onChange={(e) => setEng({ ...eng, fileNo: e.target.value })} />
          </Field>
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
