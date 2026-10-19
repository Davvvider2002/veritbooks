import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdminPartners } from './partners/AdminPartners';
import { Link } from 'react-router-dom';
import { JURISDICTIONS, jurisdictionOf, type CountryCode } from './content/jurisdictions';
import { SecondFactor } from './mfa';
import { repo } from './data';
import type { AdminCountry, AdminData, AdminFirm, User } from './data/repo';
import { FOUNDING_PLACES, daysLeft, priceText } from './engine/billing';
import { longDate } from './engine/report';
import { ErrorNote, Field, message, useAction } from './ui';

const day = (iso: string | null | undefined) => (iso ? longDate(iso.slice(0, 10)) : '–');
const STATE: Record<AdminFirm['state'], { label: string; tag: string }> = {
  trial: { label: 'Trial', tag: 'warn' },
  active: { label: 'Paid', tag: 'ok' },
  expired: { label: 'Lapsed', tag: 'bad' },
  suspended: { label: 'Suspended', tag: 'bad' },
};
const TABS = ['Overview', 'Firms', 'Sign-ups', 'Payments', 'Partners', 'Prices', 'Settings', 'Log'] as const;
type Tab = (typeof TABS)[number];
type Act = (action: string, args: Record<string, unknown>) => void;
/** The currency a firm is charged in, from its country. */
const currencyOfFirm = (d: AdminData, f: Pick<AdminFirm, 'country'>) => d.countries?.find((c) => c.code === (f.country ?? 'NG'))?.currency ?? 'NGN';
/** Amounts in several currencies, each in its own: "₦480,000 · GH₵1,500". */
const amounts = (xs: { currency: string; kobo: number }[]) => (xs.length ? xs.map((x) => priceText(x.kobo, x.currency)).join(' · ') : priceText(0, 'NGN'));

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
        <Stat
          label="Received this month"
          value={amounts((d.revenue ?? []).filter((r) => r.month_kobo).map((r) => ({ currency: r.currency, kobo: r.month_kobo ?? 0 })))}
          note={`${amounts((d.revenue ?? []).map((r) => ({ currency: r.currency, kobo: r.total_kobo })))} in total. Tax inside: ${amounts((d.revenue ?? []).filter((r) => r.vat_kobo).map((r) => ({ currency: r.currency, kobo: r.vat_kobo })))}`}
        />
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
  const [country, setCountry] = useState<string>(f.country ?? 'NG');
  const go = (action: string, args: Record<string, unknown> = {}) => act(action, { firm: f.id, ...args });
  return (
    <div className="stack admin-detail">
      <div className="grid2">
        <div>
          <div className="small muted">Firm</div>
          <div>{f.name}</div>
          <div className="small">{JURISDICTIONS[(f.country ?? 'NG') as CountryCode]?.name ?? f.country}. {f.frc_number || `No ${jurisdictionOf(f.country).licenceShort} yet`}</div>
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
            <input type="number" min={0.01} step="any" aria-label={`Amount received in ${currencyOfFirm(d, f)}`} placeholder={`Amount, ${currencyOfFirm(d, f)}`} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 130 }} />
            <input type="text" aria-label="Payment reference" placeholder="Bank reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            <button disabled={busy || !amount || !reference.trim()} onClick={() => go('record_payment', { plan, amount_naira: Number(amount), reference })}>
              Record for {paid.find((p) => p.code === plan)?.name}
            </button>
          </div>
          <span className="small muted">For a bank transfer. Enter what was received in {currencyOfFirm(d, f)}, tax included. Adds a year of the plan chosen on the left and issues a receipt.</span>
        </fieldset>
        <fieldset className="stack">
          <legend>Country</legend>
          <div className="row">
            <select aria-label="Move to country" value={country} onChange={(e) => setCountry(e.target.value)}>
              {(d.countries ?? []).map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>
              ))}
            </select>
            <button disabled={busy || country === (f.country ?? 'NG')} onClick={() => go('set_country', { country })}>
              Move firm
            </button>
          </div>
          <span className="small muted">Changes the law its reports cite, its licence label, and the currency of its next payment. Past receipts keep their currency. A founding firm’s held prices move to the new country’s list.</span>
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
        <td className="num">{priceText(f.paid_kobo, currencyOfFirm(d, f))}</td>
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
          {rows.length} shown, {amounts(['NGN', 'GHS', 'USD'].map((c) => ({ currency: c, kobo: rows.filter((p) => p.status === 'paid' && (p.currency ?? 'NGN') === c).reduce((t, p) => t + p.amount_kobo, 0) })).filter((x) => x.kobo))} received. The latest 300 are listed.
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
                <td className="num">
                  {priceText(p.amount_kobo, p.currency ?? 'NGN')}
                  {p.quoted_currency && p.quoted_kobo != null && <div className="small muted">{priceText(p.quoted_kobo, p.quoted_currency)} at {p.fx_rate}</div>}
                </td>
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

/** A price in a country's own currency, saved on its own. */
function PriceCell({ label, minor, onSave, busy }: { label: string; minor: number; currency: string; onSave: (major: number) => void; busy: boolean }) {
  const [v, setV] = useState(String(minor / 100));
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <input type="number" min={0.01} step="any" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 130 }} />
      <button disabled={busy || Number(v) * 100 === minor || !(Number(v) > 0)} aria-label={`Save ${label}`} onClick={() => onSave(Number(v))}>
        Save
      </button>
    </div>
  );
}

function CountryPrices({ c, d, act, busy }: { c: AdminCountry; d: AdminData; act: Act; busy: boolean }) {
  const [tax, setTax] = useState({ vat_percent: c.vat_percent, tax_label: c.tax_label, enabled: c.enabled });
  const [charge, setCharge] = useState({ currency: c.charge_currency ?? c.currency, rate: c.charge_rate ? String(c.charge_rate) : '' });
  const fetchRate = useAction();
  const plans = d.plans.filter((p) => p.code !== 'trial');
  const foreign = charge.currency !== c.currency;
  return (
    <section className="card stack" aria-label={`${c.name} prices`}>
      <div className="between">
        <h3>{c.name}</h3>
        <span className="small muted">
          Charged in {c.currency}. {c.firms} firm{c.firms === 1 ? '' : 's'}.{!c.enabled && ' Closed to new firms.'}
        </span>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Yearly plan</th>
            <th>Price a year, {c.currency}</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.code}>
              <td>{p.name}</td>
              <td>
                <PriceCell key={c.plans[p.code]} label={`${c.name} ${p.name} price`} minor={c.plans[p.code] ?? 0} currency={c.currency} busy={busy} onSave={(price) => act('country_price', { country: c.code, plan: p.code, price })} />
              </td>
            </tr>
          ))}
          {d.engagement_prices.map((p) => (
            <tr key={p.code}>
              <td>{p.code === 'group' ? 'Group consolidation add-on' : `One ${p.name.toLowerCase()}`}</td>
              <td>
                <PriceCell key={c.engagement_prices[p.code]} label={`${c.name} ${p.name} engagement price`} minor={c.engagement_prices[p.code] ?? 0} currency={c.currency} busy={busy} onSave={(price) => act('country_engagement_price', { country: c.code, code: p.code, price })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Tax name">
          <input type="text" aria-label={`${c.name} tax name`} maxLength={30} value={tax.tax_label} onChange={(e) => setTax({ ...tax, tax_label: e.target.value })} style={{ width: 160 }} />
        </Field>
        <Field label="Rate, %">
          <input type="number" aria-label={`${c.name} tax rate`} min={0} max={50} step={0.1} value={tax.vat_percent} onChange={(e) => setTax({ ...tax, vat_percent: Number(e.target.value) })} style={{ width: 100 }} />
        </Field>
        {c.code !== 'NG' && (
          <label className="row small" style={{ gap: 6, paddingBottom: 8 }}>
            <input type="checkbox" checked={tax.enabled} onChange={(e) => setTax({ ...tax, enabled: e.target.checked })} />
            Open to new firms
          </label>
        )}
        <button disabled={busy} aria-label={`Save ${c.name} tax`} onClick={() => act('country_settings', { country: c.code, ...tax })} style={{ marginBottom: 4 }}>
          Save tax
        </button>
      </div>
      <fieldset className="stack" aria-label={`${c.name} collection`}>
        <legend>Payment collection</legend>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Flutterwave collects in">
            <select aria-label={`${c.name} collection currency`} value={charge.currency} onChange={(e) => setCharge({ ...charge, currency: e.target.value as typeof charge.currency })}>
              {[c.currency, ...(['ZAR', 'NGN', 'USD', 'GHS'] as const).filter((x) => x !== c.currency)].map((x) => (
                <option key={x} value={x}>{x === c.currency ? `${x}, the price currency` : `${x}, converted`}</option>
              ))}
            </select>
          </Field>
          {foreign && (
            <Field label={`${charge.currency} for 1 ${c.currency}`}>
              <input type="number" aria-label={`${c.name} exchange rate`} min={0} step="any" value={charge.rate} onChange={(e) => setCharge({ ...charge, rate: e.target.value })} style={{ width: 140 }} />
            </Field>
          )}
          {foreign && (
            <button
              type="button"
              disabled={fetchRate.busy}
              style={{ marginBottom: 4 }}
              onClick={() => void fetchRate.run(async () => setCharge({ ...charge, rate: String(Math.round((await repo.adminFxRate(c.currency, charge.currency)) * 1e6) / 1e6) }))}
            >
              Get Flutterwave’s rate
            </button>
          )}
          <button
            disabled={busy || (foreign && !(Number(charge.rate) > 0))}
            aria-label={`Save ${c.name} collection`}
            style={{ marginBottom: 4 }}
            onClick={() => act('country_charge', { country: c.code, charge_currency: charge.currency, ...(foreign ? { rate: Number(charge.rate) } : {}) })}
          >
            Save collection
          </button>
        </div>
        <ErrorNote error={fetchRate.error} />
        <span className="small muted">
          Firms in {c.name} always see their prices in {c.currency}.{' '}
          {c.charge_currency && c.charge_currency !== c.currency
            ? `Payments are collected in ${c.charge_currency} at ${c.charge_rate} to 1 ${c.currency}, set ${day(c.rate_set_at)}. Update the rate as it moves.`
            : `Payments are collected in ${c.currency}.`}{' '}
          Flutterwave pays out in the currency of your settlement account, converting if it must. Check that the collected currency is enabled on your Flutterwave account.
        </span>
      </fieldset>
      <span className="small muted">
        {c.code === 'NG'
          ? 'Nigerian VAT is 7.5%.'
          : c.code === 'ZA'
          ? 'South African VAT is 15%. Set it once VeritBooks is registered for VAT there; until then nothing is added.'
          : 'Set the rate once VeritBooks is registered for tax here, or once advised none is due. Until then nothing is added.'}{' '}
        The tax is added on top of each price at checkout and shown on the receipt.
      </span>
    </section>
  );
}

function PlanLimits({ p, act, busy }: { p: AdminData['plans'][number]; act: Act; busy: boolean }) {
  const [users, setUsers] = useState(p.max_users === null ? '' : String(p.max_users));
  const [engs, setEngs] = useState(String(p.max_engagements));
  return (
    <tr>
      <td>{p.name}</td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} users`} placeholder="No limit" value={users} onChange={(e) => setUsers(e.target.value)} style={{ width: 110 }} />
      </td>
      <td>
        <input type="number" min={1} aria-label={`${p.name} engagements`} value={engs} onChange={(e) => setEngs(e.target.value)} style={{ width: 110 }} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <button disabled={busy} aria-label={`Save ${p.name} allowances`} onClick={() => act('plan_limits', { plan: p.code, max_users: users, max_engagements: Number(engs) })}>
          Save
        </button>
      </td>
    </tr>
  );
}

function Prices({ d, act, busy }: { d: AdminData; act: Act; busy: boolean }) {
  const [code, setCode] = useState<string>('NG');
  const c = (d.countries ?? []).find((x) => x.code === code);
  return (
    <div className="stack">
      <div className="row" role="tablist" aria-label="Country">
        {(d.countries ?? []).map((x) => (
          <button key={x.code} role="tab" aria-selected={x.code === code} className={x.code === code ? 'primary' : ''} onClick={() => setCode(x.code)}>
            {x.name}
          </button>
        ))}
      </div>
      {c && <CountryPrices key={c.code + JSON.stringify(c)} c={c} d={d} act={act} busy={busy} />}
      <span className="small muted">
        A new price applies to the next payment. Founding firms keep the prices of the day they joined, in their own currency, until their two years are up.
      </span>
      <section className="card stack" aria-label="Plan allowances">
        <h3>Plan allowances, the same in every country</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Users</th>
              <th>Engagements a year</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.plans.filter((p) => p.code !== 'trial').map((p) => (
              <PlanLimits key={p.code + p.max_engagements + p.max_users} p={p} act={act} busy={busy} />
            ))}
          </tbody>
        </table>
        <span className="small muted">Leave users empty for no limit.</span>
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
        <h3>Seller details, printed on every receipt</h3>
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
          <Field label="Support email" hint="Shown to firms on receipts and when an account is suspended.">
            <input type="email" value={s.support_email} onChange={(e) => setS({ ...s, support_email: e.target.value })} />
          </Field>
        </div>
        <div>
          <button className="primary" disabled={busy} onClick={() => { const { vat_percent: _rate, ...seller } = s; act('settings', seller); }}>
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
  country_price: 'Changed a country plan price', country_engagement_price: 'Changed a country engagement price', country_settings: 'Changed a country’s tax', set_country: 'Moved a firm to another country', plan_limits: 'Changed plan allowances',
  settings: 'Changed seller details', country_charge: 'Changed a country’s collection currency', add_admin: 'Added an admin', remove_admin: 'Removed an admin', reset_two_factor: 'Reset an admin’s two-factor',
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
      {who.state === 'second' && <SecondFactor enrolled={who.enrolled} onDone={() => void check()} required />}
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
          {data && tab === 'Partners' && <AdminPartners />}
          {data && tab === 'Prices' && <Prices d={data} act={act} busy={busy} />}
          {data && tab === 'Settings' && <Settings d={data} act={act} busy={busy} />}
          {data && tab === 'Log' && <Log d={data} />}
          <p className="small muted">This console shows firms, people, plans and payments. It does not show any client's trial balance, ledger, evidence or report.</p>
        </div>
      )}
    </>
  );
}
