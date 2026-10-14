import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { naira } from './billing';
import { repo } from './data';
import type { AdminData, AdminFirm, User } from './data/repo';
import { FOUNDING_PLACES, daysLeft } from './engine/billing';
import { longDate } from './engine/report';
import { ErrorNote, Field, message, useAction } from './ui';

const day = (iso: string | null | undefined) => (iso ? longDate(iso.slice(0, 10)) : '–');
const STATE: Record<AdminFirm['state'], { label: string; tag: string }> = {
  trial: { label: 'Trial', tag: 'warn' },
  active: { label: 'Paid', tag: 'ok' },
  expired: { label: 'Lapsed', tag: 'bad' },
  suspended: { label: 'Suspended', tag: 'bad' },
};
const TABS = ['Overview', 'Firms', 'Sign-ups', 'Payments', 'Prices', 'Settings', 'Log'] as const;
type Tab = (typeof TABS)[number];
type Act = (action: string, args: Record<string, unknown>) => void;

/** The platform owner's sign-in. Separate from the firm sign-in, and it lets in admins only. */
function AdminLogin({ refused, onSignedIn }: { refused: string | null; onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  return (
    <div className="narrow stack">
      <div>
        <h1>Admin sign in</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          For the people who run VeritBooks. Firms sign in on the <Link to="/">home page</Link>.
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await repo.signIn(email, password);
            onSignedIn();
          });
        }}
      >
        <Field label="Admin email">
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorNote error={error ?? refused} />
        <button className="primary" disabled={busy}>
          Sign in to admin
        </button>
      </form>
      <p className="small">
        <Link to="/forgot">Forgot your password?</Link>
      </p>
      {repo.mode === 'demo' && <p className="small muted">Demo mode: sign in as admin@veritbooks.demo with any password of 8 characters or more.</p>}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="card stat">
      <div className="small muted">{label}</div>
      <div className="price">{value}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

function Overview({ d, open }: { d: AdminData; open: (firm: string) => void }) {
  const count = (s: AdminFirm['state']) => d.firms.filter((f) => f.state === s).length;
  const since = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const now = new Date();
  const ending = d.firms.filter((f) => f.state === 'trial' && daysLeft(f.trial_ends_at, now) <= 3);
  const renewing = d.firms.filter((f) => f.state === 'active' && daysLeft(f.paid_until, now) <= 30);
  const noFirm = d.users.filter((u) => !u.firm && !u.admin);
  return (
    <div className="stack">
      <div className="grid4">
        <Stat label="Firms" value={d.firms.length} note={`${d.firms.filter((f) => f.created_at >= since(7)).length} new in the last 7 days`} />
        <Stat label="On a paid plan" value={count('active')} note={`${count('trial')} in trial, ${count('expired')} lapsed`} />
        <Stat label="Received this month" value={naira(d.revenue_month_kobo)} note={`${naira(d.revenue_kobo)} in total. VAT inside: ${naira(d.vat_month_kobo)} this month, ${naira(d.vat_kobo)} in total`} />
        <Stat label="Founding places" value={`${d.founding_taken} of ${FOUNDING_PLACES}`} note={`${FOUNDING_PLACES - d.founding_taken} left`} />
      </div>
      <section className="card stack" aria-label="Needs attention">
        <h3>Needs attention</h3>
        {ending.length + renewing.length + noFirm.length + count('suspended') === 0 && <span className="muted">Nothing just now.</span>}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {ending.map((f) => (
            <li key={f.id}>
              <button className="link" onClick={() => open(f.id)}>{f.name}</button>: trial ends {day(f.trial_ends_at)}.
            </li>
          ))}
          {renewing.map((f) => (
            <li key={f.id}>
              <button className="link" onClick={() => open(f.id)}>{f.name}</button>: plan ends {day(f.paid_until)}.
            </li>
          ))}
          {d.firms.filter((f) => f.state === 'suspended').map((f) => (
            <li key={f.id}>
              <button className="link" onClick={() => open(f.id)}>{f.name}</button>: suspended{f.suspended_reason ? `, ${f.suspended_reason}` : ''}.
            </li>
          ))}
          {noFirm.length > 0 && <li>{noFirm.length} sign-up{noFirm.length === 1 ? ' has' : 's have'} not set up a firm yet. See Sign-ups.</li>}
        </ul>
      </section>
    </div>
  );
}

function FirmDetail({ f, d, act, busy }: { f: AdminFirm; d: AdminData; act: Act; busy: boolean }) {
  const [days, setDays] = useState('14');
  const paid = d.plans.filter((p) => p.code !== 'trial');
  const [plan, setPlan] = useState(f.state === 'active' && paid.some((p) => p.code === f.plan) ? f.plan : (paid[0]?.code ?? 'solo'));
  const [until, setUntil] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [credit, setCredit] = useState('audit');
  const [withGroup, setWithGroup] = useState(false);
  const [note, setNote] = useState(f.note);
  const go = (action: string, args: Record<string, unknown> = {}) => act(action, { firm: f.id, ...args });
  return (
    <div className="stack admin-detail">
      <div className="grid2">
        <div>
          <div className="small muted">Firm</div>
          <div>{f.name}</div>
          <div className="small">{f.frc_number || 'No FRC number yet'}</div>
          <div className="small">{f.address}</div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {f.clients} clients, {f.engagements} engagements, {f.signed} signed. {f.credits} paid engagement{f.credits === 1 ? '' : 's'} not yet opened. AI assistance {f.ai_enabled ? 'on' : 'off'}. Last activity {day(f.last_activity)}.
          </div>
          {f.founding_number !== null && (
            <div className="small" style={{ marginTop: 8 }}>
              Founding firm number {f.founding_number}. {f.founding_agreed_at ? `Commitment accepted by ${f.founding_agreed_by || 'a partner'} on ${day(f.founding_agreed_at)}.` : 'Granted by an admin. No commitment recorded.'}
            </div>
          )}
        </div>
        <div>
          <div className="small muted">People</div>
          {f.members.map((m, i) => (
            <div key={i} className="small">
              {m.name || 'No name'} · {m.role} · {m.email ?? 'no email'}
            </div>
          ))}
        </div>
      </div>
      <div className="grid2">
        <fieldset className="stack">
          <legend>Trial</legend>
          <div className="row">
            <input type="number" min={1} max={90} aria-label="Days to add" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 90 }} />
            <button disabled={busy} onClick={() => go('extend_trial', { days: Number(days) })}>
              Extend trial
            </button>
          </div>
          <span className="small muted">Adds days to the trial, or restarts it from today if it has ended.</span>
        </fieldset>
        <fieldset className="stack">
          <legend>Account</legend>
          {f.state === 'suspended' ? (
            <div>
              <button disabled={busy} onClick={() => go('unsuspend')}>
                Lift suspension
              </button>
            </div>
          ) : (
            <div className="row">
              <input type="text" aria-label="Reason for suspension" placeholder="Reason, shown to the firm" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button disabled={busy || !reason.trim()} onClick={() => go('suspend', { reason })}>
                Suspend
              </button>
            </div>
          )}
          <span className="small muted">A suspended firm can read its files and change nothing.</span>
        </fieldset>
        <fieldset className="stack">
          <legend>Plan</legend>
          <div className="row">
            <select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {paid.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="date" aria-label="Paid until" value={until} onChange={(e) => setUntil(e.target.value)} />
            <button disabled={busy || !until} onClick={() => go('set_plan', { plan, until })}>
              Give plan
            </button>
            {f.state === 'active' && (
              <button disabled={busy} onClick={() => go('end_plan')}>
                End plan now
              </button>
            )}
          </div>
          <span className="small muted">Gives a plan without payment, for a pilot or a correction. No receipt is made.</span>
        </fieldset>
        <fieldset className="stack">
          <legend>Record a payment received another way</legend>
          <div className="row">
            <input type="number" min={1} aria-label="Amount received in naira" placeholder="Amount, ₦" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 130 }} />
            <input type="text" aria-label="Payment reference" placeholder="Bank reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            <button disabled={busy || !amount || !reference.trim()} onClick={() => go('record_payment', { plan, amount_naira: Number(amount), reference })}>
              Record for {paid.find((p) => p.code === plan)?.name}
            </button>
          </div>
          <span className="small muted">For a bank transfer. Enter what was received, VAT included. Adds a year of the plan chosen on the left and issues a receipt.</span>
        </fieldset>
        <fieldset className="stack">
          <legend>Engagements and founding offer</legend>
          <div className="row">
            <select aria-label="Engagement type" value={credit} onChange={(e) => setCredit(e.target.value)}>
              <option value="audit">Audit</option>
              <option value="review">Review</option>
              <option value="compilation">Compilation</option>
            </select>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={withGroup} onChange={(e) => setWithGroup(e.target.checked)} /> with consolidation
            </label>
            <button disabled={busy} onClick={() => go('grant_credit', { type: credit, with_group: withGroup })}>
              Grant one engagement
            </button>
          </div>
          <div>
            <button disabled={busy} onClick={() => go('founding', { on: f.founding_number === null })}>
              {f.founding_number === null ? 'Make a founding firm' : 'Remove founding status'}
            </button>
          </div>
        </fieldset>
        <fieldset className="stack">
          <legend>Note, seen only by admins</legend>
          <textarea aria-label="Admin note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <div>
            <button disabled={busy || note === f.note} onClick={() => go('note', { text: note })}>
              Save note
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function Firms({ d, act, busy, openId, setOpenId }: { d: AdminData; act: Act; busy: boolean; openId: string | null; setOpenId: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const rows = d.firms.filter(
    (f) => (state === 'all' || f.state === state) && (!q.trim() || [f.name, ...f.members.map((m) => `${m.name} ${m.email}`)].join(' ').toLowerCase().includes(q.trim().toLowerCase())),
  );
  return (
    <div className="stack">
      <div className="row">
        <input type="search" aria-label="Search firms" placeholder="Search by firm, person or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340 }} />
        <select aria-label="Filter by status" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="all">All firms</option>
          <option value="trial">In trial</option>
          <option value="active">Paid</option>
          <option value="expired">Lapsed</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="small muted">{rows.length} shown</span>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="data admin-table">
          <thead>
            <tr>
              <th>Firm</th>
              <th>Signed up</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Ends</th>
              <th className="num">Users</th>
              <th className="num">Files</th>
              <th className="num">Paid</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <FirmRow key={f.id} f={f} d={d} act={act} busy={busy} open={openId === f.id} toggle={() => setOpenId(openId === f.id ? null : f.id)} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No firms match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FirmRow({ f, d, act, busy, open, toggle }: { f: AdminFirm; d: AdminData; act: Act; busy: boolean; open: boolean; toggle: () => void }) {
  const st = STATE[f.state];
  return (
    <>
      <tr>
        <td>
          {f.name}
          {f.founding_number !== null && <span className="tag" style={{ marginLeft: 8 }}>Founding {f.founding_number}</span>}
          <div className="small muted">{f.members.find((m) => m.role === 'partner')?.email}</div>
        </td>
        <td>{day(f.created_at)}</td>
        <td>
          <span className={`tag ${st.tag}`}>{st.label}</span>
        </td>
        <td>{f.state === 'active' ? (d.plans.find((p) => p.code === f.plan)?.name ?? f.plan) : '–'}</td>
        <td>{f.state === 'active' ? day(f.paid_until) : f.paid_until ? day(f.paid_until) : day(f.trial_ends_at)}</td>
        <td className="num">{f.members.length}</td>
        <td className="num">
          {f.engagements}
          <span className="muted"> / {f.signed} signed</span>
        </td>
        <td className="num">{naira(f.paid_kobo)}</td>
        <td style={{ textAlign: 'right' }}>
          <button aria-label={`Manage ${f.name}`} onClick={toggle}>
            {open ? 'Close' : 'Manage'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} style={{ background: 'var(--bg, #f5f2ea)' }}>
            <FirmDetail f={f} d={d} act={act} busy={busy} />
          </td>
        </tr>
      )}
    </>
  );
}

function Users({ d, act, busy, me, resetMfa }: { d: AdminData; act: Act; busy: boolean; me: User; resetMfa: (id: string) => void }) {
  const [q, setQ] = useState('');
  const rows = d.users.filter((u) => !q.trim() || `${u.email} ${u.name ?? ''} ${u.firm ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="stack">
      <div className="row">
        <input type="search" aria-label="Search sign-ups" placeholder="Search by email, name or firm" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340 }} />
        <span className="small muted">
          {rows.length} of {d.users.length} accounts
        </span>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="data admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Firm</th>
              <th>Role</th>
              <th>Signed up</th>
              <th>Email confirmed</th>
              <th>Last sign in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.email}
                  {u.admin && <span className="tag ok" style={{ marginLeft: 8 }}>Admin</span>}
                </td>
                <td>{u.name || '–'}</td>
                <td>{u.firm ?? <span className="muted">No firm yet</span>}</td>
                <td>{u.role ?? '–'}</td>
                <td>{day(u.created_at)}</td>
                <td>{u.confirmed ? 'Yes' : <span className="tag warn">Not yet</span>}</td>
                <td>{day(u.last_sign_in_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  {u.admin && u.id !== me.id && (
                    <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button disabled={busy} aria-label={`Reset two-factor for ${u.email}`} onClick={() => resetMfa(u.id)}>
                        Reset 2FA
                      </button>
                      <button disabled={busy} aria-label={`Remove admin ${u.email}`} onClick={() => act('remove_admin', { user: u.id })}>
                        Remove admin
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payments({ d }: { d: AdminData }) {
  const [status, setStatus] = useState('paid');
  const rows = d.payments.filter((p) => status === 'all' || p.status === status);
  const what = (p: AdminData['payments'][number]) =>
    p.kind === 'plan' ? `${d.plans.find((x) => x.code === p.plan)?.name ?? p.plan} plan${p.founding ? ', founding' : ''}` : p.kind === 'group' ? 'Consolidation add-on' : `One ${p.engagement_type}${p.with_group ? ' with consolidation' : ''}`;
  return (
    <div className="stack">
      <div className="row">
        <select aria-label="Payment status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="paid">Paid</option>
          <option value="pending">Started, not finished</option>
          <option value="all">All</option>
        </select>
        <span className="small muted">
          {rows.length} shown, {naira(rows.filter((p) => p.status === 'paid').reduce((t, p) => t + p.amount_kobo, 0))} received. The latest 300 are listed.
        </span>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="data admin-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Firm</th>
              <th>For</th>
              <th>How</th>
              <th>Reference</th>
              <th>Status</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.receipt_no ?? '–'}</td>
                <td>{day(p.paid_at ?? p.created_at)}</td>
                <td>{p.firm}</td>
                <td>{what(p)}</td>
                <td>{p.source === 'manual' ? 'Recorded by admin' : 'Flutterwave'}</td>
                <td className="small muted">{p.source === 'manual' ? p.note : (p.provider_id ?? p.tx_ref)}</td>
                <td>
                  <span className={`tag ${p.status === 'paid' ? 'ok' : p.status === 'failed' ? 'bad' : ''}`}>{p.status === 'pending' ? 'not finished' : p.status}</span>
                </td>
                <td className="num">{naira(p.amount_kobo)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanPrice({ p, act, busy }: { p: AdminData['plans'][number]; act: Act; busy: boolean }) {
  const [price, setPrice] = useState(String(p.price_kobo / 100));
  const [users, setUsers] = useState(p.max_users === null ? '' : String(p.max_users));
  const [engs, setEngs] = useState(String(p.max_engagements));
  return (
    <tr>
      <td>{p.name}</td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} price in naira`} value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 140 }} />
      </td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} users`} placeholder="No limit" value={users} onChange={(e) => setUsers(e.target.value)} style={{ width: 110 }} />
      </td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} engagements`} value={engs} onChange={(e) => setEngs(e.target.value)} style={{ width: 110 }} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <button disabled={busy} aria-label={`Save ${p.name}`} onClick={() => act('set_price', { plan: p.code, price_naira: Number(price), max_users: users, max_engagements: Number(engs) })}>
          Save
        </button>
      </td>
    </tr>
  );
}

function EngagementPrice({ p, act, busy }: { p: AdminData['engagement_prices'][number]; act: Act; busy: boolean }) {
  const [price, setPrice] = useState(String(p.price_kobo / 100));
  return (
    <tr>
      <td>{p.code === 'group' ? 'Group consolidation add-on' : `One ${p.name.toLowerCase()}`}</td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} engagement price in naira`} value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 140 }} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <button disabled={busy} aria-label={`Save ${p.name} engagement price`} onClick={() => act('set_engagement_price', { code: p.code, price_naira: Number(price) })}>
          Save
        </button>
      </td>
    </tr>
  );
}

function Prices({ d, act, busy }: { d: AdminData; act: Act; busy: boolean }) {
  return (
    <div className="stack">
      <section className="card stack" aria-label="Yearly plans">
        <h3>Yearly plans</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price a year, ₦</th>
              <th>Users</th>
              <th>Engagements a year</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.plans.filter((p) => p.code !== 'trial').map((p) => (
              <PlanPrice key={p.code + p.price_kobo + p.max_engagements + p.max_users} p={p} act={act} busy={busy} />
            ))}
          </tbody>
        </table>
        <span className="small muted">
          A new price applies to the next payment. Founding firms keep the prices of the day they joined until their two years are up. Leave users empty for no limit.
        </span>
      </section>
      <section className="card stack" aria-label="Single engagements">
        <h3>Single engagements</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th>Price, ₦</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.engagement_prices.map((p) => (
              <EngagementPrice key={p.code + p.price_kobo} p={p} act={act} busy={busy} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Settings({ d, act, busy }: { d: AdminData; act: Act; busy: boolean }) {
  const [s, setS] = useState(d.settings);
  const [email, setEmail] = useState('');
  const admins = d.users.filter((u) => u.admin);
  return (
    <div className="stack">
      <section className="card stack" aria-label="Seller details">
        <h3>Seller details and VAT, printed on every receipt</h3>
        <div className="grid2">
          <Field label="Seller name">
            <input type="text" value={s.seller_name} onChange={(e) => setS({ ...s, seller_name: e.target.value })} />
          </Field>
          <Field label="Tax identification number">
            <input type="text" value={s.tax_id} onChange={(e) => setS({ ...s, tax_id: e.target.value })} />
          </Field>
          <Field label="Address">
            <input type="text" value={s.seller_address} onChange={(e) => setS({ ...s, seller_address: e.target.value })} />
          </Field>
          <Field label="VAT rate, %" hint="Added on top of every price at checkout. Nigerian VAT is 7.5%. Set 0 to charge none.">
            <input type="number" min={0} max={50} step={0.1} value={s.vat_percent} onChange={(e) => setS({ ...s, vat_percent: Number(e.target.value) })} />
          </Field>
          <Field label="Support email" hint="Shown to firms on receipts and when an account is suspended.">
            <input type="email" value={s.support_email} onChange={(e) => setS({ ...s, support_email: e.target.value })} />
          </Field>
        </div>
        <div>
          <button className="primary" disabled={busy} onClick={() => act('settings', s)}>
            Save seller details
          </button>
        </div>
      </section>
      <section className="card stack" aria-label="Admins">
        <h3>Admins</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {admins.map((a) => (
            <li key={a.id}>{a.email}</li>
          ))}
        </ul>
        <div className="row">
          <input type="email" aria-label="New admin email" placeholder="Email of an existing account" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 320 }} />
          <button disabled={busy || !email.trim()} onClick={() => { act('add_admin', { email }); setEmail(''); }}>
            Add admin
          </button>
        </div>
        <span className="small muted">An admin can see every firm, change plans and prices, and suspend accounts. Give this to very few people. Each new admin sets up an authenticator app at their first sign-in. Remove an admin from the Sign-ups tab.</span>
      </section>
    </div>
  );
}

const ACTION: Record<string, string> = {
  extend_trial: 'Extended trial', set_plan: 'Gave a plan', end_plan: 'Ended plan', record_payment: 'Recorded a payment', suspend: 'Suspended', unsuspend: 'Lifted suspension',
  founding: 'Changed founding status', grant_credit: 'Granted an engagement', note: 'Changed note', set_price: 'Changed a plan price', set_engagement_price: 'Changed an engagement price',
  settings: 'Changed seller details', add_admin: 'Added an admin', remove_admin: 'Removed an admin', reset_two_factor: 'Reset an admin’s two-factor',
};

function Log({ d }: { d: AdminData }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="data admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Firm</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {d.log.map((l, i) => (
            <tr key={i}>
              <td>{new Date(l.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td>{l.admin ?? '–'}</td>
              <td>{ACTION[l.action] ?? l.action}</td>
              <td>{l.firm ?? '–'}</td>
              <td className="small muted">{l.action === 'note' ? '' : Object.entries(l.detail ?? {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`).join(', ')}</td>
            </tr>
          ))}
          {d.log.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing yet. Every change made here is recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The second step of the admin sign-in: a code from an authenticator app, set up on first use. */
function SecondFactor({ enrolled, onDone }: { enrolled: boolean; onDone: () => void }) {
  const [setup, setSetup] = useState<{ factorId: string; qr: string | null; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (!enrolled) void run(async () => setSetup(await repo.mfaEnroll()));
  }, []);
  const submit = () =>
    void run(async () => {
      await repo.mfaVerify(setup?.factorId ?? null, code);
      onDone();
    });
  return (
    <div className="narrow stack">
      <div>
        <h1>{enrolled ? 'Enter your code' : 'Set up two-factor authentication'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {enrolled
            ? 'Open your authenticator app and enter the six-digit code shown for VeritBooks.'
            : 'The admin console needs a second step at every sign-in. Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.'}
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!enrolled && (
          <>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>In your authenticator app, add an account.</li>
              <li>Scan this code, or type the key below.</li>
              <li>Enter the six-digit code the app shows.</li>
            </ol>
            {setup?.qr && <img src={setup.qr} alt="QR code to add VeritBooks to an authenticator app" className="mfa-qr" />}
            {setup && (
              <div>
                <div className="small muted">Key</div>
                <code className="mfa-secret" aria-label="Authenticator key">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
              </div>
            )}
            {!setup && !error && <span className="muted">Preparing…</span>}
          </>
        )}
        <Field label="Six-digit code">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <ErrorNote error={error} />
        <button className="primary" disabled={busy || code.length !== 6 || (!enrolled && !setup)}>
          {enrolled ? 'Verify' : 'Turn on and continue'}
        </button>
      </form>
      <p className="small muted">
        {enrolled
          ? 'Lost your phone? Another admin can reset your authenticator from the Sign-ups tab. If you are the only admin, it can be cleared in the Supabase dashboard under Authentication.'
          : 'Keep the key somewhere safe, such as a password manager. Anyone with it can produce your codes.'}
      </p>
    </div>
  );
}

/** The platform owner's console, at /admin. It has its own sign-in and shows no client files. */
export function AdminApp() {
  const [who, setWho] = useState<{ state: 'loading' } | { state: 'out'; refused: string | null } | { state: 'second'; user: User; enrolled: boolean } | { state: 'in'; user: User }>({ state: 'loading' });
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    try {
      setData(await repo.adminOverview());
      setLoadError(null);
    } catch (e) {
      setLoadError(message(e));
    }
  };
  const check = async () => {
    const user = await repo.currentUser();
    if (!user) return setWho({ state: 'out', refused: null });
    const st = await repo.adminStatus();
    if (!st.admin) {
      // Someone who is not an admin learns nothing here, and is not left signed in on this page.
      await repo.signOut();
      return setWho({ state: 'out', refused: 'That account is not a VeritBooks admin.' });
    }
    // The password alone opens nothing. The database checks for the second factor too.
    if (!st.verified) return setWho({ state: 'second', user, enrolled: st.enrolled });
    setWho({ state: 'in', user });
    await load();
  };
  useEffect(() => {
    void check();
  }, []);

  const act: Act = (action, args) =>
    void run(async () => {
      setDone(null);
      await repo.adminAct(action, args);
      setDone(`${ACTION[action] ?? 'Saved'}.`);
      await load();
    });
  const header = useMemo(
    () => (
      <header className="topbar admin-bar">
        <span className="brand">
          Verit<span>Books</span> <em>Admin</em>
        </span>
        <div className="spacer" />
        {(who.state === 'in' || who.state === 'second') && (
          <>
            <span className="small">{who.user.email}</span>
            <button
              onClick={() => {
                void repo.signOut().then(() => {
                  setData(null);
                  setWho({ state: 'out', refused: null });
                });
              }}
            >
              Sign out
            </button>
          </>
        )}
      </header>
    ),
    [who],
  );

  return (
    <>
      {header}
      {who.state === 'loading' && <div className="page muted">Loading…</div>}
      {who.state === 'out' && <AdminLogin refused={who.refused} onSignedIn={() => void check()} />}
      {who.state === 'second' && <SecondFactor enrolled={who.enrolled} onDone={() => void check()} />}
      {who.state === 'in' && (
        <div className="page wide stack">
          <nav className="tabs" aria-label="Admin sections">
            {TABS.map((t) => (
              <button key={t} className={t === tab ? 'on' : ''} aria-current={t === tab ? 'page' : undefined} onClick={() => { setTab(t); setDone(null); }}>
                {t}
              </button>
            ))}
          </nav>
          <ErrorNote error={error ?? loadError} />
          {done && !error && <div className="banner info">{done}</div>}
          {!data && !loadError && <div className="muted">Loading…</div>}
          {data && tab === 'Overview' && <Overview d={data} open={(id) => { setOpenId(id); setTab('Firms'); }} />}
          {data && tab === 'Firms' && <Firms d={data} act={act} busy={busy} openId={openId} setOpenId={setOpenId} />}
          {data && tab === 'Sign-ups' && <Users d={data} act={act} busy={busy} me={who.user} resetMfa={(id) => void run(async () => { setDone(null); await repo.adminResetTwoFactor(id); setDone('Two-factor reset. They set up a new authenticator at their next sign-in.'); await load(); })} />}
          {data && tab === 'Payments' && <Payments d={data} />}
          {data && tab === 'Prices' && <Prices d={data} act={act} busy={busy} />}
          {data && tab === 'Settings' && <Settings d={data} act={act} busy={busy} />}
          {data && tab === 'Log' && <Log d={data} />}
          <p className="small muted">This console shows firms, people, plans and payments. It does not show any client's trial balance, ledger, evidence or report.</p>
        </div>
      )}
    </>
  );
}
