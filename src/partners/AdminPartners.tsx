import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { COUNTRY_CODES, JURISDICTIONS } from '../content/jurisdictions';
import { repo } from '../data';
import { priceText } from '../engine/billing';
import {
  commissionState,
  FIRM_STATE,
  monthlyReport,
  PARTNER_CURRENCIES,
  referralLink,
  toCsv,
  type AdminPartner,
  type AdminPartners as Data,
  type Balance,
} from '../engine/partners';
import { longDate } from '../engine/report';
import { ErrorNote, Field, message, useAction } from '../ui';

const money = (minor: number, currency: string) => priceText(minor, currency);
const day = (iso: string | null | undefined) => (iso ? longDate(iso.slice(0, 10)) : '');
const shown = (p: { company: string; name: string }) => p.company || p.name;
const SECTIONS = ['Overview', 'Applications', 'Partners', 'Payouts', 'Commissions', 'Reports', 'Resources', 'Settings'] as const;
type Section = (typeof SECTIONS)[number];
type Act = (action: string, args: Record<string, unknown>, done?: string) => Promise<boolean>;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="stat">{value}</div>
      <div className="small muted">{label}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

/** Sums balances across partners, by currency. */
function totals(list: Record<string, Balance>[]): Record<string, Balance> {
  const out: Record<string, Balance> = {};
  for (const b of list)
    for (const [c, v] of Object.entries(b)) {
      const t = (out[c] ??= { review: 0, held: 0, available: 0, requested: 0, paid: 0 });
      for (const k of Object.keys(t) as (keyof Balance)[]) t[k] += v[k];
    }
  return out;
}
const byCurrency = (b: Record<string, Balance>, k: keyof Balance) =>
  Object.entries(b)
    .filter(([, v]) => v[k] > 0)
    .map(([c, v]) => money(v[k], c))
    .join(', ') || '–';

function Overview({ d, go }: { d: Data; go: (s: Section) => void }) {
  const active = d.partners.filter((p) => p.status === 'active');
  const pending = d.partners.filter((p) => p.status === 'pending');
  const all = totals(d.partners.map((p) => p.balances));
  const waiting = d.payouts.filter((o) => o.status === 'requested');
  const review = d.commissions.filter((c) => c.status === 'review');
  const top = [...d.partners].filter((p) => p.referred > 0).sort((a, b) => b.paying - a.paying || b.referred - a.referred).slice(0, 8);
  return (
    <div className="stack">
      {(pending.length > 0 || waiting.length > 0 || review.length > 0) && (
        <div className="banner warn">
          Waiting for you:{' '}
          {[
            pending.length && <button key="a" className="link" onClick={() => go('Applications')}>{pending.length} application{pending.length === 1 ? '' : 's'}</button>,
            waiting.length && <button key="p" className="link" onClick={() => go('Payouts')}>{waiting.length} payout request{waiting.length === 1 ? '' : 's'}</button>,
            review.length && <button key="r" className="link" onClick={() => go('Commissions')}>{review.length} commission{review.length === 1 ? '' : 's'} to review</button>,
          ]
            .filter(Boolean)
            .flatMap((x, i) => (i ? [', ', x] : [x]))}
          .
        </div>
      )}
      <div className="grid3">
        <Stat label="active partners" value={active.length} note={`${d.partners.length} in all`} />
        <Stat label="clicks in the last 30 days" value={d.partners.reduce((a, p) => a + p.clicks30, 0)} />
        <Stat label="firms referred" value={d.referrals.length} note={`${d.partners.reduce((a, p) => a + p.paying, 0)} paying`} />
      </div>
      <div className="card stack">
        <h3>Commission</h3>
        <table className="data">
          <tbody>
            <tr><td>Awaiting review</td><td className="num">{byCurrency(all, 'review')}</td></tr>
            <tr><td>Held, not yet payable</td><td className="num">{byCurrency(all, 'held')}</td></tr>
            <tr><td>Available to partners</td><td className="num">{byCurrency(all, 'available')}</td></tr>
            <tr><td>Requested, to pay</td><td className="num"><strong>{byCurrency(all, 'requested')}</strong></td></tr>
            <tr><td>Paid to date</td><td className="num">{byCurrency(all, 'paid')}</td></tr>
          </tbody>
        </table>
      </div>
      {top.length > 0 && (
        <div className="card">
          <h3>Leading partners</h3>
          <table className="data">
            <thead>
              <tr><th>Partner</th><th>Code</th><th className="num">Clicks, 30 days</th><th className="num">Referred</th><th className="num">Paying</th><th className="num">Earned</th></tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.id}>
                  <td>{shown(p)}</td>
                  <td>{p.code}</td>
                  <td className="num">{p.clicks30}</td>
                  <td className="num">{p.referred}</td>
                  <td className="num">{p.paying}</td>
                  <td className="num">{Object.entries(p.balances).map(([c, b]) => money(b.held + b.available + b.requested + b.paid + b.review, c)).join(', ') || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Applications({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const pending = d.partners.filter((p) => p.status === 'pending');
  const [rate, setRate] = useState<Record<string, string>>({});
  if (pending.length === 0) return <div className="card muted">No applications waiting.</div>;
  return (
    <div className="stack">
      {pending.map((p) => (
        <div key={p.id} className="card stack" aria-label={`Application from ${p.name}`}>
          <div className="between">
            <div>
              <strong>{p.name}</strong>
              {p.company && <span className="muted"> · {p.company}</span>}
              <div className="small muted">
                {p.email} · {p.phone || 'no phone'} · {JURISDICTIONS[p.country as keyof typeof JURISDICTIONS]?.name ?? p.country} · applied {day(p.created_at)}
              </div>
            </div>
            <span className="tag warn">Pending</span>
          </div>
          {p.website && <div className="small">Website: {p.website}</div>}
          <div>
            <div className="small muted">How they will promote VeritBooks</div>
            <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{p.promotion || <span className="muted">Not given.</span>}</p>
          </div>
          <div className="small muted">Terms version {p.terms_version} accepted {day(p.terms_accepted_at)}. Code on approval: {p.code}.</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ width: 160 }}>
              <Field label="Commission, %">
                <input type="number" min="0" max="100" step="0.5" value={rate[p.id] ?? String(p.commission_percent)} onChange={(e) => setRate({ ...rate, [p.id]: e.target.value })} />
              </Field>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (rate[p.id] !== undefined && Number(rate[p.id]) !== Number(p.commission_percent) && !(await act('update', { id: p.id, percent: Number(rate[p.id]) }))) return;
                await act('status', { id: p.id, status: 'active' }, `${p.name} approved. Their link is live.`);
              }}
            >
              Approve
            </button>
            <button disabled={busy} onClick={() => void act('status', { id: p.id, status: 'rejected' }, `${p.name}'s application declined.`)}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddPartner({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const blank = { email: '', name: '', company: '', country: 'NG', code: '', percent: String(d.settings.default_percent), months: d.settings.default_months === null ? '' : String(d.settings.default_months) };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <details className="card">
      <summary><strong>Add a partner</strong> <span className="small muted">for an agreement made outside the application form</span></summary>
      <form
        className="stack"
        style={{ marginTop: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('create', { ...f, code: f.code || undefined, percent: Number(f.percent), months: f.months }, `${f.name} added. They take the account up by signing in at /partners with ${f.email}.`)) setF(blank);
        }}
      >
        <div className="grid3">
          <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Name"><input type="text" required value={f.name} onChange={set('name')} /></Field>
          <Field label="Company"><input type="text" value={f.company} onChange={set('company')} /></Field>
          <Field label="Country">
            <select value={f.country} onChange={set('country')}>
              {COUNTRY_CODES.map((c) => <option key={c} value={c}>{JURISDICTIONS[c].name}</option>)}
            </select>
          </Field>
          <Field label="Code" hint="Blank makes one from the name."><input type="text" value={f.code} maxLength={20} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Commission, %"><input type="number" min="0" max="100" step="0.5" value={f.percent} onChange={set('percent')} /></Field>
          <Field label="For months" hint="Blank: for as long as the firm pays."><input type="number" min="1" max="120" value={f.months} onChange={set('months')} /></Field>
        </div>
        <div><button className="primary" disabled={busy}>Add partner</button></div>
      </form>
    </details>
  );
}

function PartnerDetail({ p, d, act, busy }: { p: AdminPartner; d: Data; act: Act; busy: boolean }) {
  const [f, setF] = useState({ name: p.name, company: p.company, phone: p.phone, country: p.country, code: p.code, percent: String(p.commission_percent), months: p.commission_months === null ? '' : String(p.commission_months), admin_notes: p.admin_notes });
  useEffect(() => {
    setF({ name: p.name, company: p.company, phone: p.phone, country: p.country, code: p.code, percent: String(p.commission_percent), months: p.commission_months === null ? '' : String(p.commission_months), admin_notes: p.admin_notes });
  }, [p]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const refs = d.referrals.filter((r) => r.partner_id === p.id);
  const pd = p.payout_details;
  return (
    <div className="stack" style={{ padding: '8px 0 16px' }}>
      <div className="row">
        <span className={`tag ${p.status === 'active' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}`}>{p.status}</span>
        <span className="small muted">
          {p.email} · {p.has_account ? 'signed up' : 'has not taken the account up yet'} · joined {day(p.created_at)}
          {p.terms_accepted_at ? ` · terms ${p.terms_version} accepted ${day(p.terms_accepted_at)}` : ' · terms not yet accepted'}
        </span>
      </div>
      <div className="small">
        Link: <code>{referralLink(p.code)}</code>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void act('update', { id: p.id, ...f, percent: Number(f.percent) }, 'Partner saved.');
        }}
      >
        <div className="grid3">
          <Field label="Name"><input type="text" value={f.name} onChange={set('name')} /></Field>
          <Field label="Company"><input type="text" value={f.company} onChange={set('company')} /></Field>
          <Field label="Phone"><input type="text" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Country">
            <select value={f.country} onChange={set('country')}>
              {COUNTRY_CODES.map((c) => <option key={c} value={c}>{JURISDICTIONS[c].name}</option>)}
            </select>
          </Field>
          <Field label="Code" hint="Changing it stops the old link working."><input type="text" value={f.code} maxLength={20} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Commission, %" hint="Applies to payments from now on."><input type="number" min="0" max="100" step="0.5" value={f.percent} onChange={set('percent')} /></Field>
          <Field label="For months" hint="Blank: for as long as the firm pays."><input type="number" min="1" max="120" value={f.months} onChange={set('months')} /></Field>
        </div>
        <Field label="Notes for VeritBooks only"><textarea rows={2} value={f.admin_notes} onChange={set('admin_notes')} /></Field>
        <div className="row">
          <button className="primary" disabled={busy}>Save</button>
          {p.status !== 'active' && <button type="button" disabled={busy} onClick={() => void act('status', { id: p.id, status: 'active' }, 'Partner activated.')}>Activate</button>}
          {p.status === 'active' && <button type="button" className="danger" disabled={busy} onClick={() => void act('status', { id: p.id, status: 'suspended' }, 'Partner suspended. Their link stops counting and they earn nothing new.')}>Suspend</button>}
        </div>
      </form>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Payout details</h4>
          {pd.account_number || pd.mobile_number ? (
            <div className="small">
              {pd.method === 'mobile' ? 'Mobile money' : 'Bank transfer'}: {pd.bank} · {pd.account_name} · {pd.account_number || pd.mobile_number}
              {pd.branch_code ? ` · branch ${pd.branch_code}` : ''}
              {pd.swift ? ` · SWIFT ${pd.swift}` : ''}
              {pd.tax_number ? ` · tax no. ${pd.tax_number}` : ''}
            </div>
          ) : (
            <div className="small muted">Not entered yet.</div>
          )}
        </div>
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Balances</h4>
          {Object.keys(p.balances).length === 0 && <div className="small muted">Nothing earned yet.</div>}
          {Object.entries(p.balances).map(([c, b]) => (
            <div key={c} className="row small" style={{ gap: 8 }}>
              <span>
                {c}: {money(b.available, c)} available, {money(b.held, c)} held, {money(b.requested, c)} requested, {money(b.paid, c)} paid
              </span>
              {b.available > 0 && p.status === 'active' && (
                <button className="link" disabled={busy} onClick={() => void act('payout_create', { id: p.id, currency: c }, `Payout of ${money(b.available, c)} created. Pay it under Payouts.`)}>
                  Pay out now
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {refs.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Firms referred</h4>
          <table className="data">
            <tbody>
              {refs.map((r) => (
                <tr key={r.firm_id}>
                  <td>{r.firm}</td>
                  <td>{day(r.referred_at)}</td>
                  <td>{r.campaign}</td>
                  <td>{FIRM_STATE[r.state] ?? r.state}{r.review && <div className="small muted">Held: {r.review}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Partners({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = d.partners.filter(
    (p) => (!status || p.status === status) && (!q || `${p.name} ${p.company} ${p.email} ${p.code}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="stack">
      <AddPartner d={d} act={act} busy={busy} />
      <div className="row">
        <input type="search" placeholder="Search name, company, email or code" aria-label="Search partners" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 260px' }} />
        <select aria-label="Partner status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Every status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Declined</option>
        </select>
      </div>
      <div className="card">
        {list.length === 0 ? (
          <div className="muted">No partners match.</div>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr><th>Partner</th><th>Code</th><th>Status</th><th className="num">Rate</th><th className="num">Clicks, 30 days</th><th className="num">Referred</th><th className="num">Paying</th><th className="num">Available</th><th /></tr>
              </thead>
              <tbody>
                {list.map((p) => [
                  <tr key={p.id}>
                    <td>{shown(p)}{p.company && <div className="small muted">{p.name}</div>}</td>
                    <td>{p.code}</td>
                    <td><span className={`tag ${p.status === 'active' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}`}>{p.status}</span></td>
                    <td className="num">{Number(p.commission_percent)}%{p.commission_months ? ` · ${p.commission_months} mo` : ''}</td>
                    <td className="num">{p.clicks30}</td>
                    <td className="num">{p.referred}</td>
                    <td className="num">{p.paying}</td>
                    <td className="num">{byCurrency(p.balances, 'available')}</td>
                    <td><button className="link" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Close' : 'Open'}</button></td>
                  </tr>,
                  open === p.id && (
                    <tr key={p.id + '-d'}>
                      <td colSpan={9}><PartnerDetail p={p} d={d} act={act} busy={busy} /></td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PayoutRow({ o, p, act, busy }: { o: Data['payouts'][number]; p: AdminPartner | undefined; act: Act; busy: boolean }) {
  const [ref, setRef] = useState('');
  const [method, setMethod] = useState(o.payout_details?.method === 'mobile' ? 'Mobile money' : 'Bank transfer');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const pd = o.payout_details ?? {};
  return (
    <div className="card stack" aria-label={`Payout to ${p ? shown(p) : 'partner'}`}>
      <div className="between">
        <div>
          <strong>{money(o.amount_kobo, o.currency)}</strong> to {p ? shown(p) : 'a removed partner'}
          <div className="small muted">Requested {day(o.requested_at)}{o.requested_by === 'admin' ? ' by VeritBooks' : ''}</div>
        </div>
        <span className="tag warn">To pay</span>
      </div>
      <div className="small">
        {pd.method === 'mobile' ? 'Mobile money' : 'Bank'}: {pd.bank} · {pd.account_name} · {pd.account_number || pd.mobile_number}
        {pd.branch_code ? ` · branch ${pd.branch_code}` : ''}
        {pd.swift ? ` · SWIFT ${pd.swift}` : ''}
      </div>
      <div className="grid3">
        <Field label="Transfer reference"><input type="text" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Paid by"><input type="text" value={method} onChange={(e) => setMethod(e.target.value)} /></Field>
        <Field label="Date paid"><input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <button className="primary" disabled={busy} onClick={() => void act('payout_paid', { id: o.id, reference: ref, method, paid_at: paidAt }, 'Payout marked as paid. The partner sees the reference.')}>
          Mark as paid
        </button>
        <div style={{ flex: '1 1 240px' }}>
          <Field label="Or, the reason for not paying"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <button disabled={busy} onClick={() => void act('payout_reject', { id: o.id, note }, 'Payout returned. The commissions are back in the partner’s balance.')}>
          Do not pay
        </button>
      </div>
    </div>
  );
}

function Payouts({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const by = new Map(d.partners.map((p) => [p.id, p]));
  const open = d.payouts.filter((o) => o.status === 'requested');
  const done = d.payouts.filter((o) => o.status !== 'requested');
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Pay each request by transfer from your bank or Flutterwave, then record the reference here. The partner sees it in their portal.
      </p>
      {open.length === 0 && <div className="card muted">No payouts waiting.</div>}
      {open.map((o) => <PayoutRow key={o.id} o={o} p={by.get(o.partner_id ?? '')} act={act} busy={busy} />)}
      {done.length > 0 && (
        <div className="card">
          <h3>History</h3>
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>Requested</th><th>Partner</th><th className="num">Amount</th><th>Status</th><th>Decided</th><th>Reference or reason</th></tr></thead>
              <tbody>
                {done.map((o) => (
                  <tr key={o.id}>
                    <td>{day(o.requested_at)}</td>
                    <td>{by.get(o.partner_id ?? '') ? shown(by.get(o.partner_id ?? '')!) : ''}</td>
                    <td className="num">{money(o.amount_kobo, o.currency)}</td>
                    <td><span className={`tag ${o.status === 'paid' ? 'ok' : 'bad'}`}>{o.status === 'paid' ? 'Paid' : 'Not paid'}</span></td>
                    <td>{day(o.decided_at)}</td>
                    <td>{o.status === 'paid' ? `${o.reference} · ${o.method}` : o.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Commissions({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const [filter, setFilter] = useState<string>('review');
  const [reason, setReason] = useState<Record<string, string>>({});
  const by = new Map(d.partners.map((p) => [p.id, p]));
  const now = new Date();
  const list = d.commissions.filter((c) => !filter || (filter === 'available' ? c.status === 'pending' && new Date(c.available_at) <= now : filter === 'held' ? c.status === 'pending' && new Date(c.available_at) > now : c.status === filter));
  const [assign, setAssign] = useState<Record<string, string>>({});
  return (
    <div className="stack">
      <div className="row">
        <select aria-label="Commission status" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="review">Awaiting review</option>
          <option value="held">Held</option>
          <option value="available">Available</option>
          <option value="requested">In a payout</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
          <option value="">All</option>
        </select>
        <span className="small muted">Void a commission when the payment behind it is refunded or reversed. Only one not yet in a payout can be voided.</span>
      </div>
      <div className="card">
        {list.length === 0 ? (
          <div className="muted">None.</div>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>Date</th><th>Partner</th><th>Firm</th><th className="num">Paid, excl. VAT</th><th className="num">Commission</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{day(c.created_at)}</td>
                    <td>{by.get(c.partner_id ?? '') ? shown(by.get(c.partner_id ?? '')!) : ''}</td>
                    <td>{c.firm}{c.status === 'review' && <div className="small muted">{d.referrals.find((r) => r.firm_id === c.firm_id)?.review}</div>}</td>
                    <td className="num">{money(c.base_kobo, c.currency)}</td>
                    <td className="num">{money(c.amount_kobo, c.currency)} <span className="small muted">({Number(c.percent)}%)</span></td>
                    <td>{commissionState(c)}{c.status === 'void' && <div className="small muted">{c.void_reason}</div>}</td>
                    <td>
                      {(c.status === 'review' || c.status === 'pending') && (
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          {c.status === 'review' && <button className="link" disabled={busy} onClick={() => void act('commission_approve', { id: c.id }, 'Referral cleared. The commission joins the normal hold.')}>Approve</button>}
                          <input type="text" aria-label={`Reason to void the commission on ${c.firm}`} placeholder="Reason" value={reason[c.id] ?? ''} onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} style={{ width: 120 }} />
                          <button className="link danger" disabled={busy} onClick={() => void act('commission_void', { id: c.id, reason: reason[c.id] ?? '' }, 'Commission voided.')}>Void</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <h3>Referred firms</h3>
        <p className="small muted" style={{ marginTop: 0 }}>Move a firm to another partner, or remove the credit, to settle a dispute. Commissions already earned stay where they are.</p>
        {d.referrals.length === 0 ? (
          <div className="muted">No firms referred yet.</div>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>Firm</th><th>Partner</th><th>Referred</th><th>Status</th><th>Credit to</th></tr></thead>
              <tbody>
                {d.referrals.map((r) => (
                  <tr key={r.firm_id}>
                    <td>{r.firm}</td>
                    <td>{by.get(r.partner_id) ? shown(by.get(r.partner_id)!) : ''}</td>
                    <td>{day(r.referred_at)}{r.campaign && <div className="small muted">{r.campaign}</div>}</td>
                    <td>{FIRM_STATE[r.state] ?? r.state}{r.review && <div className="small muted">Held: {r.review}</div>}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <select aria-label={`Partner credited with ${r.firm}`} value={assign[r.firm_id] ?? r.partner_id} onChange={(e) => setAssign({ ...assign, [r.firm_id]: e.target.value })} style={{ width: 'auto' }}>
                          <option value="">No partner</option>
                          {d.partners.map((p) => <option key={p.id} value={p.id}>{shown(p)} ({p.code})</option>)}
                        </select>
                        {(assign[r.firm_id] ?? r.partner_id) !== r.partner_id && (
                          <button className="link" disabled={busy} onClick={() => void act('assign_referral', { firm: r.firm_id, partner: assign[r.firm_id] }, 'Referral moved.')}>Save</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Reports({ d }: { d: Data }) {
  const rows = useMemo(() => monthlyReport(d), [d]);
  const by = new Map(d.partners.map((p) => [p.id, p]));
  const major = (minor: number) => (minor / 100).toFixed(2);
  const stamp = new Date().toISOString().slice(0, 10);
  const files: [string, () => string][] = [
    ['Monthly report', () => toCsv([['Month', 'Partner', 'Code', 'Currency', 'Clicks', 'Firms referred', 'Sales excl. VAT', 'Commission earned', 'Paid out'], ...rows.map((r) => [r.month, r.partner, r.code, r.currency, r.clicks, r.referrals, major(r.sales), major(r.commission), major(r.paid)])])],
    ['Partners', () => toCsv([['Name', 'Company', 'Email', 'Phone', 'Country', 'Code', 'Status', 'Rate %', 'Months', 'Clicks', 'Referred', 'Paying', 'Joined', 'Approved'], ...d.partners.map((p) => [p.name, p.company, p.email, p.phone, p.country, p.code, p.status, Number(p.commission_percent), p.commission_months ?? 'lifetime', p.clicks, p.referred, p.paying, p.created_at.slice(0, 10), p.approved_at?.slice(0, 10) ?? ''])])],
    ['Commissions', () => toCsv([['Date', 'Partner', 'Code', 'Firm', 'Currency', 'Paid excl. VAT', 'Rate %', 'Commission', 'Status', 'Available from', 'Payout', 'Void reason'], ...d.commissions.map((c) => { const p = by.get(c.partner_id ?? ''); return [c.created_at.slice(0, 10), p ? shown(p) : '', p?.code ?? '', c.firm, c.currency, major(c.base_kobo), Number(c.percent), major(c.amount_kobo), commissionState(c), c.available_at.slice(0, 10), c.payout_id ?? '', c.void_reason]; })])],
    ['Payouts', () => toCsv([['Requested', 'Partner', 'Code', 'Currency', 'Amount', 'Status', 'Decided', 'Reference', 'Method', 'Note', 'Bank', 'Account name', 'Account or mobile number', 'Branch code', 'Tax number'], ...d.payouts.map((o) => { const p = by.get(o.partner_id ?? ''); const pd = o.payout_details ?? {}; return [o.requested_at.slice(0, 10), p ? shown(p) : '', p?.code ?? '', o.currency, major(o.amount_kobo), o.status, o.decided_at?.slice(0, 10) ?? '', o.reference, o.method, o.note, pd.bank, pd.account_name, pd.account_number || pd.mobile_number, pd.branch_code, pd.tax_number]; })])],
  ];
  return (
    <div className="stack">
      <div className="card stack">
        <h3>Download</h3>
        <div className="row">
          {files.map(([name, make]) => (
            <button key={name} onClick={() => download(`veritbooks-partners-${name.toLowerCase().replace(/ /g, '-')}-${stamp}.csv`, make())}>
              {name} (CSV)
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Amounts are in each currency’s main unit. The payouts file holds partners’ bank details: keep it safe.</p>
      </div>
      <div className="card">
        <h3>By month</h3>
        {rows.length === 0 ? (
          <div className="muted">Nothing to report yet.</div>
        ) : (
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th>Month</th><th>Partner</th><th>Currency</th><th className="num">Clicks</th><th className="num">Referred</th><th className="num">Sales, excl. VAT</th><th className="num">Commission</th><th className="num">Paid out</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.month}${r.partnerId}${r.currency}`}>
                    <td>{r.month}</td>
                    <td>{r.partner}</td>
                    <td>{r.currency || '–'}</td>
                    <td className="num">{r.clicks || ''}</td>
                    <td className="num">{r.referrals || ''}</td>
                    <td className="num">{r.sales ? money(r.sales, r.currency) : ''}</td>
                    <td className="num">{r.commission ? money(r.commission, r.currency) : ''}</td>
                    <td className="num">{r.paid ? money(r.paid, r.currency) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Resources({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const [f, setF] = useState({ title: '', kind: 'copy', body: '', url: '' });
  return (
    <div className="stack">
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act('asset_add', f, 'Resource added. Active partners see it now.')) setF({ title: '', kind: 'copy', body: '', url: '' });
        }}
      >
        <h3>Add a resource</h3>
        <div className="grid2">
          <Field label="Title"><input type="text" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Kind">
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="copy">Text to copy: a post, an email, a webinar script</option>
              <option value="link">Link: a brochure, logo pack or video</option>
            </select>
          </Field>
        </div>
        {f.kind === 'link' && <Field label="Link"><input type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>}
        <Field label={f.kind === 'link' ? 'Description' : 'Text'} hint="{link} and {code} are replaced with each partner’s own link and code.">
          <textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Field>
        <div><button className="primary" disabled={busy}>Add resource</button></div>
      </form>
      {d.assets.map((a) => (
        <div key={a.id} className="card stack" style={{ gap: 6 }}>
          <div className="between">
            <strong>{a.title}</strong>
            <button className="link danger" disabled={busy} onClick={() => void act('asset_delete', { id: a.id }, 'Resource removed.')}>Remove</button>
          </div>
          {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="small">{a.url}</a>}
          {a.body && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.body}</p>}
        </div>
      ))}
    </div>
  );
}

function Settings({ d, act, busy }: { d: Data; act: Act; busy: boolean }) {
  const s = d.settings;
  const [f, setF] = useState({
    open: s.open,
    default_percent: String(s.default_percent),
    default_months: s.default_months === null ? '' : String(s.default_months),
    hold_days: String(s.hold_days),
    cookie_days: String(s.cookie_days),
    terms_version: s.terms_version,
    min: Object.fromEntries(PARTNER_CURRENCIES.map((c) => [c, String((s.min_payout[c] ?? 0) / 100)])),
  });
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(
          'settings',
          {
            open: f.open,
            default_percent: Number(f.default_percent),
            default_months: f.default_months,
            hold_days: Number(f.hold_days),
            cookie_days: Number(f.cookie_days),
            terms_version: f.terms_version,
            min_payout: Object.fromEntries(Object.entries(f.min).map(([c, v]) => [c, Math.round(Number(v) * 100)])),
          },
          'Programme settings saved.',
        );
      }}
    >
      <h3>Programme settings</h3>
      <label className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} />
        <span>Take new applications</span>
      </label>
      <div className="grid3">
        <Field label="Default commission, %" hint="For new partners. Each partner’s own rate is set on their record."><input type="number" min="0" max="100" step="0.5" value={f.default_percent} onChange={(e) => setF({ ...f, default_percent: e.target.value })} /></Field>
        <Field label="Default commission period, months" hint="Blank: for as long as the firm pays."><input type="number" min="1" max="120" value={f.default_months} onChange={(e) => setF({ ...f, default_months: e.target.value })} /></Field>
        <Field label="Hold, days" hint="Before a commission can be paid. Longer than your refund window."><input type="number" min="0" max="365" value={f.hold_days} onChange={(e) => setF({ ...f, hold_days: e.target.value })} /></Field>
        <Field label="Link remembered for, days"><input type="number" min="1" max="365" value={f.cookie_days} onChange={(e) => setF({ ...f, cookie_days: e.target.value })} /></Field>
        <Field label="Terms version" hint="Change it when the terms change."><input type="text" value={f.terms_version} onChange={(e) => setF({ ...f, terms_version: e.target.value })} /></Field>
      </div>
      <h4 style={{ margin: 0 }}>Least a partner can be paid at once</h4>
      <div className="grid3">
        {PARTNER_CURRENCIES.map((c) => (
          <Field key={c} label={c}>
            <input type="number" min="0" step="1" value={f.min[c]} onChange={(e) => setF({ ...f, min: { ...f.min, [c]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>A change to the hold applies to commissions earned from now on. A change to the rate or period applies to payments from now on.</p>
      <div><button className="primary" disabled={busy}>Save settings</button></div>
    </form>
  );
}

/** The platform owner's view of the partner programme, inside the admin console. */
export function AdminPartners() {
  const [d, setD] = useState<Data | null>(null);
  const [section, setSection] = useState<Section>('Overview');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const load = async () => {
    try {
      setD(await repo.adminPartners());
      setLoadError(null);
    } catch (e) {
      setLoadError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const act: Act = async (action, args, msg) => {
    let ok = false;
    setDone(null);
    await run(async () => {
      await repo.adminPartnerAct(action, args);
      ok = true;
      setDone(msg ?? 'Saved.');
      await load();
    });
    return ok;
  };
  const waiting = d ? { Applications: d.partners.filter((p) => p.status === 'pending').length, Payouts: d.payouts.filter((o) => o.status === 'requested').length, Commissions: d.commissions.filter((c) => c.status === 'review').length } : {};
  return (
    <div className="stack">
      <nav className="tabs" aria-label="Partner programme sections">
        {SECTIONS.map((s) => (
          <button key={s} className={s === section ? 'on' : ''} aria-current={s === section ? 'page' : undefined} onClick={() => { setSection(s); setDone(null); }}>
            {s}
            {(waiting as Record<string, number>)[s] ? ` (${(waiting as Record<string, number>)[s]})` : ''}
          </button>
        ))}
      </nav>
      <ErrorNote error={error ?? loadError} />
      {done && !error && <div className="banner info">{done}</div>}
      {!d && !loadError && <div className="muted">Loading…</div>}
      {d && section === 'Overview' && <Overview d={d} go={setSection} />}
      {d && section === 'Applications' && <Applications d={d} act={act} busy={busy} />}
      {d && section === 'Partners' && <Partners d={d} act={act} busy={busy} />}
      {d && section === 'Payouts' && <Payouts d={d} act={act} busy={busy} />}
      {d && section === 'Commissions' && <Commissions d={d} act={act} busy={busy} />}
      {d && section === 'Reports' && <Reports d={d} />}
      {d && section === 'Resources' && <Resources d={d} act={act} busy={busy} />}
      {d && section === 'Settings' && <Settings d={d} act={act} busy={busy} />}
    </div>
  );
}
