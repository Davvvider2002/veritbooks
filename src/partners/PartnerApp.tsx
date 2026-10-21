import { MOBILE_HINT, normaliseMobile, showMobile } from '../engine/phone';
import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { JURISDICTIONS, COUNTRY_CODES } from '../content/jurisdictions';
import { partnerTerms } from '../content/partnerTerms';
import { repo } from '../data';
import type { User } from '../data/repo';
import { priceText } from '../engine/billing';
import {
  commissionState,
  FIRM_STATE,
  referralLink,
  shareMessages,
  type PartnerMe,
  type PartnerProgramme,
  type PayoutDetails,
  termsText,
} from '../engine/partners';
import { longDate } from '../engine/report';
import { ErrorNote, Field, message, useAction } from '../ui';

/** The site the partner's links point at: this one, so links made on a preview point at the preview. */
const SITE = typeof window !== 'undefined' ? window.location.origin + '/' : 'https://veritbooks.com/';
const money = (minor: number, currency: string) => priceText(minor, currency);
const day = (iso: string | null | undefined) => (iso ? longDate(iso.slice(0, 10)) : '');
/** Marks this browser as signing up to be a partner, so the account opens here, not at firm set-up. */
export const PARTNER_INTENT = 'veritbooks.partnerIntent';

function Copy({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
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

/* ------------------------------------------------------------------------------------------------
 * Signed out: what the programme offers, and a way in
 * ---------------------------------------------------------------------------------------------- */

function TermsList({ p }: { p: PartnerProgramme }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {partnerTerms(p).map((t) => (
        <p key={t.heading} style={{ margin: 0 }}>
          <strong>{t.heading}.</strong> {t.text}
        </p>
      ))}
    </div>
  );
}

function ProgrammePage({ p, onSignedIn }: { p: PartnerProgramme | null; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  return (
    <div className="page stack" style={{ maxWidth: 980 }}>
      <div>
        <h1>The VeritBooks partner programme</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 700 }}>
          For accounting bodies, trainers, consultants, software resellers and community leaders who work with audit and accounting firms in Nigeria, Ghana, Sierra Leone, Liberia, The Gambia and South Africa.
        </p>
      </div>
      {p && (
        <div className="grid3">
          <Stat label="of what each referred firm pays, excluding VAT" value={`${p.percent}%`} note={p.months === null ? 'For as long as the firm pays' : Number(p.later_percent ?? 0) > 0 ? `For ${p.months} months, then ${Number(p.later_percent)}% ${p.later_months == null ? 'for as long as the firm pays' : `for ${p.later_months} more months`}` : `For ${p.months} months`} />
          <Stat label="days a click is remembered" value={p.cookie_days} note="Or the firm types your code" />
          <Stat label="days before a commission can be paid" value={p.hold_days} note="Then paid out on request" />
        </div>
      )}
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <h3>How it works</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }} className="stack">
            <li>Apply below. We review every application, usually within two working days.</li>
            <li>Share your personal link or referral code with firms, through webinars, newsletters, WhatsApp groups or training.</li>
            <li>Watch clicks, sign-ups and paying firms in your portal, tagged by campaign.</li>
            <li>Earn on every payment those firms make, and ask for a payout once your balance clears.</li>
          </ol>
          {p && !p.open && <div className="banner warn">The programme is not taking new applications at the moment.</div>}
        </div>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            void run(async () => {
              try {
                localStorage.setItem(PARTNER_INTENT, '1');
              } catch {
                // Storage unavailable: the account still opens here after sign-in.
              }
              if (mode === 'in') await repo.signIn(email, password);
              else if (await repo.signUp(email, password, mobile)) {
                setNotice('Check your email to confirm the account, then sign in here to apply.');
                setMode('in');
                return;
              }
              onSignedIn();
            });
          }}
        >
          <h3>{mode === 'up' ? 'Create a partner account' : 'Partner sign-in'}</h3>
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {mode === 'up' && (
            <Field label="Mobile phone number" hint={MOBILE_HINT}>
              <input type="tel" required autoComplete="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
          )}
          <ErrorNote error={error} />
          {notice && <div className="banner info">{notice}</div>}
          <button className="primary" disabled={busy}>
            {mode === 'up' ? 'Create account' : 'Sign in'}
          </button>
          <p className="small" style={{ margin: 0 }}>
            {mode === 'up' ? 'Already a partner? ' : 'New to the programme? '}
            <button type="button" className="link" onClick={() => setMode(mode === 'up' ? 'in' : 'up')}>
              {mode === 'up' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </div>
      {p && (
        <details className="card">
          <summary>
            <strong>Programme terms</strong> <span className="small muted">version {p.terms_version}</span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <TermsList p={p} />
          </div>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Applying
 * ---------------------------------------------------------------------------------------------- */

function ApplyForm({ p, invited, user, onDone }: { p: PartnerProgramme; invited: { name: string; company: string } | null; user: User; onDone: () => void }) {
  const [f, setF] = useState({ name: invited?.name ?? '', company: invited?.company ?? '', phone: showMobile(user.mobile), country: 'NG', website: '', promotion: '', accept_terms: false });
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="page stack" style={{ maxWidth: 760 }}>
      <div>
        <h1>{invited ? 'Your partner account is ready' : 'Apply to become a partner'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {invited
            ? 'VeritBooks has set you up as a partner. Confirm your details and accept the terms to open your portal.'
            : `Signed in as ${user.email}. Tell us how you work with accounting firms, and we will review your application.`}
        </p>
      </div>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const m = normaliseMobile(f.phone);
            if (!m.ok) throw new Error(m.message);
            if (!user.mobile) await repo.setMyMobile(m.value);
            await repo.partnerApply({ ...f, phone: m.value });
            onDone();
          });
        }}
      >
        <div className="grid2">
          <Field label="Your full name">
            <input type="text" required value={f.name} onChange={set('name')} disabled={!!invited} />
          </Field>
          <Field label="Company or organisation" hint="Leave blank if you promote in your own name.">
            <input type="text" value={f.company} onChange={set('company')} disabled={!!invited} />
          </Field>
          <Field label="Mobile or WhatsApp number" hint={MOBILE_HINT}>
            <input type="tel" required autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
          </Field>
          {!invited && (
            <Field label="Country you mainly work in">
              <select value={f.country} onChange={set('country')}>
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>{JURISDICTIONS[c].name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Website or social profile">
            <input type="text" value={f.website} onChange={set('website')} placeholder="https://" />
          </Field>
        </div>
        <Field label="How will you promote VeritBooks?" hint="Your audience, its size, and the channels you use: webinars, newsletters, training, WhatsApp groups, events.">
          <textarea rows={4} value={f.promotion} onChange={set('promotion')} />
        </Field>
        <details>
          <summary>Read the partner terms (version {p.terms_version})</summary>
          <div style={{ marginTop: 10 }}>
            <TermsList p={p} />
          </div>
        </details>
        <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={f.accept_terms} onChange={(e) => setF({ ...f, accept_terms: e.target.checked })} />
          <span>I have read and accept the partner terms.</span>
        </label>
        <ErrorNote error={error} />
        <div>
          <button className="primary" disabled={busy}>
            {invited ? 'Accept and open my portal' : 'Send application'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The portal
 * ---------------------------------------------------------------------------------------------- */

type Me = Exclude<PartnerMe, { invited: true }>;
const TABS = ['Overview', 'Links and tools', 'Referrals', 'Earnings', 'Payouts', 'Resources', 'Profile'] as const;
type Tab = (typeof TABS)[number];

function Overview({ me, go }: { me: Me; go: (t: Tab) => void }) {
  const p = me.partner;
  const link = referralLink(p.code, { base: SITE });
  // A firm that has paid for anything, a plan or a single engagement, counts as paying, as on the platform owner's console.
  const paying = me.referrals.filter((r) => r.state === 'active' || Object.keys(r.earned).length > 0).length;
  const max = Math.max(1, ...me.clicks.days.map((d) => d.clicks));
  return (
    <div className="stack">
      <div className="card stack">
        <div className="between">
          <h3>Your link and code</h3>
          <button className="link" onClick={() => go('Links and tools')}>Campaign links, QR code and messages</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input type="text" readOnly value={link} aria-label="Your referral link" style={{ flex: '1 1 320px' }} onFocus={(e) => e.target.select()} />
          <Copy text={link} label="Copy link" />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span>
            Referral code <strong style={{ fontSize: 18, letterSpacing: 1 }}>{p.code}</strong>
          </span>
          <Copy text={p.code} label="Copy code" />
        </div>
      </div>
      <div className="grid3">
        <Stat label="clicks in the last 30 days" value={me.clicks.last30} note={`${me.clicks.total} in all`} />
        <Stat label="firms referred" value={me.referrals.length} />
        <Stat label="paying firms" value={paying} note={me.referrals.length ? `${Math.round((paying / me.referrals.length) * 100)}% of referrals` : undefined} />
      </div>
      <div className="card stack">
        <h3>Earnings</h3>
        {Object.keys(me.balances).length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nothing earned yet. Commission appears here when a firm you referred makes a payment.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Currency</th>
                <th className="num">Awaiting review</th>
                <th className="num">Held</th>
                <th className="num">Available</th>
                <th className="num">In a payout</th>
                <th className="num">Paid</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(me.balances).map(([c, b]) => (
                <tr key={c}>
                  <td>{c}</td>
                  <td className="num">{money(b.review, c)}</td>
                  <td className="num">{money(b.held, c)}</td>
                  <td className="num"><strong>{money(b.available, c)}</strong></td>
                  <td className="num">{money(b.requested, c)}</td>
                  <td className="num">{money(b.paid, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card stack">
        <h3>Clicks, last 30 days</h3>
        {me.clicks.days.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No clicks yet. Share your link to get started.</p>
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 90 }} role="img" aria-label={`Clicks by day: ${me.clicks.days.map((d) => `${d.day} ${d.clicks}`).join(', ')}`}>
            {me.clicks.days.map((d) => (
              <div key={d.day} title={`${day(d.day)}: ${d.clicks}`} style={{ width: 14, height: `${(d.clicks / max) * 80 + 4}px`, background: 'var(--accent, #1f5d4c)', borderRadius: 2 }} />
            ))}
          </div>
        )}
        {me.clicks.campaigns.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            By campaign: {me.clicks.campaigns.map((c) => `${c.campaign || 'untagged'} ${c.clicks}`).join(', ')}.
          </p>
        )}
      </div>
      <p className="small muted">
        Your terms, counted from each referral and on payments net of VAT: {termsText(p)}. Commissions are held {me.programme.hold_days} days.
      </p>
    </div>
  );
}

function Tools({ me }: { me: Me }) {
  const p = me.partner;
  const [campaign, setCampaign] = useState('');
  const [country, setCountry] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const link = referralLink(p.code, { campaign, country, base: SITE });
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(link, { width: 480, margin: 2 }).then((u) => live && setQr(u), () => live && setQr(null));
    return () => {
      live = false;
    };
  }, [link]);
  const msgs = shareMessages({ name: p.name, code: p.code }, (c) => referralLink(p.code, { campaign: c, country, base: SITE }));
  return (
    <div className="stack">
      <div className="card stack">
        <h3>Link builder</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Tag each link with the campaign it is for, such as a webinar or a newsletter, and your portal shows which one brings firms in. Choosing a country opens the site on that country’s prices.
        </p>
        <div className="grid2">
          <Field label="Campaign tag" hint="Letters, numbers and dashes, such as saipa-webinar-nov.">
            <input type="text" value={campaign} maxLength={40} onChange={(e) => setCampaign(e.target.value)} />
          </Field>
          <Field label="Open on the prices for">
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">The visitor’s choice</option>
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>{JURISDICTIONS[c].name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input type="text" readOnly value={link} aria-label="Campaign link" style={{ flex: '1 1 320px' }} onFocus={(e) => e.target.select()} />
          <Copy text={link} label="Copy link" />
        </div>
        {qr && (
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <img src={qr} alt="QR code for this link" width={160} height={160} style={{ border: '1px solid var(--line, #ddd)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="small">For slides, flyers and event banners.</span>
              <a href={qr} download={`veritbooks-${p.code}${campaign ? '-' + campaign : ''}.png`}>Download QR code</a>
            </div>
          </div>
        )}
      </div>
      <div className="card stack">
        <h3>Ready-made messages</h3>
        <p className="small muted" style={{ margin: 0 }}>Each carries your link, tagged for its channel. Edit them freely, and say you earn a commission when you recommend VeritBooks.</p>
        {msgs.map((m) => (
          <div key={m.channel} className="stack" style={{ gap: 6 }}>
            <div className="between">
              <strong>{m.channel}</strong>
              <Copy text={m.subject ? `${m.subject}\n\n${m.text}` : m.text} />
            </div>
            {m.subject && <div className="small">Subject: {m.subject}</div>}
            <textarea readOnly rows={m.channel === 'Email' ? 12 : 3} value={m.text} aria-label={`${m.channel} message`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Referrals({ me }: { me: Me }) {
  if (me.referrals.length === 0) return <div className="card muted">No firms yet. A firm appears here as soon as it sets up through your link or code.</div>;
  return (
    <div className="card">
      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>Firm</th>
              <th>Country</th>
              <th>Referred</th>
              <th>Campaign</th>
              <th>Status</th>
              <th className="num">You have earned</th>
            </tr>
          </thead>
          <tbody>
            {me.referrals.map((r) => (
              <tr key={r.firm_id}>
                <td>{r.firm}</td>
                <td>{JURISDICTIONS[r.country as keyof typeof JURISDICTIONS]?.name ?? r.country}</td>
                <td>{day(r.referred_at)}</td>
                <td>{r.campaign || <span className="muted">none</span>}</td>
                <td>
                  <span className={`tag ${r.state === 'active' ? 'ok' : r.state === 'trial' ? '' : 'warn'}`}>{FIRM_STATE[r.state] ?? r.state}</span>
                  {r.review && <span className="tag warn" style={{ marginLeft: 6 }}>Under review</span>}
                </td>
                <td className="num">{Object.entries(r.earned).map(([c, v]) => money(v, c)).join(', ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Only each firm’s name and status are shared with partners. Nothing of their clients or files is.</p>
    </div>
  );
}

const KIND: Record<string, string> = { plan: 'Plan', engagement: 'Single engagement', group: 'Group add-on' };

function Earnings({ me }: { me: Me }) {
  if (me.commissions.length === 0) return <div className="card muted">No commission yet. It is earned when a firm you referred pays.</div>;
  return (
    <div className="card">
      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Firm</th>
              <th>For</th>
              <th className="num">Paid, excl. VAT</th>
              <th className="num">Rate</th>
              <th className="num">Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {me.commissions.map((c) => (
              <tr key={c.id}>
                <td>{day(c.created_at)}</td>
                <td>{c.firm}</td>
                <td>{KIND[c.kind] ?? c.kind}</td>
                <td className="num">{money(c.base_kobo, c.currency)}</td>
                <td className="num">{Number(c.percent)}%{c.period === 'later' && <div className="small muted">later years</div>}</td>
                <td className="num">{money(c.amount_kobo, c.currency)}</td>
                <td>
                  {commissionState(c)}
                  {c.status === 'pending' && new Date(c.available_at) > new Date() && <div className="small muted">Available {day(c.available_at)}</div>}
                  {c.status === 'void' && c.void_reason && <div className="small muted">{c.void_reason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payouts({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const d = me.partner.payout_details;
  const hasDetails = !!(d.account_number || d.mobile_number);
  const currencies = Object.entries(me.balances).filter(([, b]) => b.available + b.held + b.review + b.requested > 0);
  return (
    <div className="stack">
      {!hasDetails && <div className="banner warn">Add your bank or mobile money details under Profile before asking for a payout.</div>}
      {currencies.length === 0 && <div className="card muted">No balance to pay out yet.</div>}
      {currencies.map(([c, b]) => {
        const min = me.programme.min_payout[c] ?? 0;
        const why = b.available <= 0 ? 'Nothing has cleared the hold yet.' : b.available < min ? `The least that can be paid out is ${money(min, c)}.` : !hasDetails ? 'Add payout details first.' : null;
        return (
          <div key={c} className="card between" style={{ alignItems: 'center' }}>
            <div>
              <div className="stat">{money(b.available, c)}</div>
              <div className="small muted">
                available in {c}. {money(b.held, c)} still held{b.requested ? `, ${money(b.requested, c)} in a payout` : ''}.
              </div>
            </div>
            <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
              <button
                className="primary"
                disabled={busy || !!why}
                onClick={() =>
                  void run(async () => {
                    setDone(null);
                    await repo.partnerRequestPayout(c);
                    setDone(`Payout of ${money(b.available, c)} requested. You will see the transfer reference here once it is paid.`);
                    await reload();
                  })
                }
              >
                Request payout
              </button>
              {why && <span className="small muted">{why}</span>}
            </div>
          </div>
        );
      })}
      <ErrorNote error={error} />
      {done && <div className="banner info">{done}</div>}
      {me.payouts.length > 0 && (
        <div className="card">
          <h3>Payout history</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Requested</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Paid</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {me.payouts.map((o) => (
                <tr key={o.id}>
                  <td>{day(o.requested_at)}</td>
                  <td className="num">{money(o.amount_kobo, o.currency)}</td>
                  <td>
                    <span className={`tag ${o.status === 'paid' ? 'ok' : o.status === 'rejected' ? 'bad' : 'warn'}`}>{o.status === 'requested' ? 'Being processed' : o.status === 'paid' ? 'Paid' : 'Not paid'}</span>
                    {o.status === 'rejected' && o.note && <div className="small muted">{o.note}</div>}
                  </td>
                  <td>{o.status === 'paid' ? day(o.decided_at) : ''}</td>
                  <td>{o.reference}{o.method ? <div className="small muted">{o.method}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Resources({ me }: { me: Me }) {
  return (
    <div className="stack">
      {me.assets.length === 0 && <div className="card muted">Marketing resources from VeritBooks will appear here.</div>}
      {me.assets.map((a) => (
        <div key={a.id} className="card stack" style={{ gap: 8 }}>
          <div className="between">
            <strong>{a.title}</strong>
            {a.kind === 'copy' ? <Copy text={a.body.replace(/\{link\}/g, referralLink(me.partner.code, { base: SITE })).replace(/\{code\}/g, me.partner.code)} /> : <a href={a.url} target="_blank" rel="noreferrer">Open</a>}
          </div>
          {a.body && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.body.replace(/\{link\}/g, referralLink(me.partner.code, { base: SITE })).replace(/\{code\}/g, me.partner.code)}</p>}
        </div>
      ))}
      <div className="card small">
        <strong>Using the VeritBooks name.</strong> Describe VeritBooks as it is: engagement software for audit, review and compilation work under the IFRS for SMEs. Do not say it replaces the auditor’s judgment, and do not promise prices or discounts that are not on veritbooks.com.
      </div>
    </div>
  );
}

function Profile({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const p = me.partner;
  const [f, setF] = useState({ company: p.company, phone: p.phone, website: p.website, promotion: p.promotion });
  const [d, setD] = useState<PayoutDetails>({ method: 'bank', ...p.payout_details });
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const setDet = (k: keyof PayoutDetails) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          setDone(null);
          await repo.partnerUpdate({ ...f, payout_details: d });
          setDone('Saved.');
          await reload();
        });
      }}
    >
      <div className="card stack">
        <h3>Your details</h3>
        <div className="grid2">
          <Field label="Name">
            <input type="text" value={p.name} disabled />
          </Field>
          <Field label="Email">
            <input type="text" value={p.email} disabled />
          </Field>
          <Field label="Company or organisation">
            <input type="text" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </Field>
          <Field label="Phone or WhatsApp number">
            <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Website or social profile">
            <input type="text" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          </Field>
          <Field label="Referral code" hint="Set by VeritBooks. Ask us if you would like a different one.">
            <input type="text" value={p.code} disabled />
          </Field>
        </div>
        <Field label="How you promote VeritBooks">
          <textarea rows={3} value={f.promotion} onChange={(e) => setF({ ...f, promotion: e.target.value })} />
        </Field>
      </div>
      <div className="card stack">
        <h3>Payout details</h3>
        <p className="small muted" style={{ margin: 0 }}>Payouts go to this account. Each payout keeps a copy of the details as they stood when you asked for it.</p>
        <Field label="Paid by">
          <select value={d.method ?? 'bank'} onChange={(e) => setD({ ...d, method: e.target.value as PayoutDetails['method'] })}>
            <option value="bank">Bank transfer</option>
            <option value="mobile">Mobile money</option>
          </select>
        </Field>
        {d.method === 'mobile' ? (
          <div className="grid2">
            <Field label="Mobile money provider">
              <input type="text" value={d.bank ?? ''} onChange={setDet('bank')} placeholder="MTN MoMo, Airtel Money" />
            </Field>
            <Field label="Mobile money number">
              <input type="tel" value={d.mobile_number ?? ''} onChange={setDet('mobile_number')} />
            </Field>
            <Field label="Name on the account">
              <input type="text" value={d.account_name ?? ''} onChange={setDet('account_name')} />
            </Field>
          </div>
        ) : (
          <div className="grid2">
            <Field label="Bank">
              <input type="text" value={d.bank ?? ''} onChange={setDet('bank')} />
            </Field>
            <Field label="Account name">
              <input type="text" value={d.account_name ?? ''} onChange={setDet('account_name')} />
            </Field>
            <Field label="Account number">
              <input type="text" inputMode="numeric" value={d.account_number ?? ''} onChange={setDet('account_number')} />
            </Field>
            <Field label="Branch or sort code" hint="Branch code in South Africa. Leave blank if not used.">
              <input type="text" value={d.branch_code ?? ''} onChange={setDet('branch_code')} />
            </Field>
            <Field label="SWIFT code" hint="For payment in US dollars.">
              <input type="text" value={d.swift ?? ''} onChange={setDet('swift')} />
            </Field>
          </div>
        )}
        <Field label="Tax number" hint="Optional. Printed on your payout records.">
          <input type="text" value={d.tax_number ?? ''} onChange={setDet('tax_number')} style={{ maxWidth: 320 }} />
        </Field>
      </div>
      <ErrorNote error={error} />
      {done && <div className="banner info">{done}</div>}
      <div>
        <button className="primary" disabled={busy}>Save</button>
      </div>
      <details className="card">
        <summary>
          Partner terms <span className="small muted">accepted {day(p.terms_accepted_at)}, version {p.terms_version}</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <TermsList p={{ ...me.programme, percent: p.commission_percent, months: p.commission_months, later_percent: p.later_percent ?? 0, later_months: p.later_months ?? null }} />
        </div>
      </details>
    </form>
  );
}

function Portal({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const p = me.partner;
  if (p.status === 'pending')
    return (
      <div className="page stack" style={{ maxWidth: 760 }}>
        <h1>Application received</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>
            Thank you, {p.name}. We review every application, usually within two working days, and you will see your link and tools here as soon as yours is approved.
          </p>
          <p className="small muted" style={{ margin: 0 }}>Your referral code will be {p.code}.</p>
        </div>
      </div>
    );
  if (p.status === 'rejected')
    return (
      <div className="page stack" style={{ maxWidth: 760 }}>
        <h1>Partner programme</h1>
        <div className="card">Thank you for applying. We are not able to take your application forward at this time.</div>
      </div>
    );
  return (
    <div className="page wide stack">
      <div className="between">
        <div>
          <h1>Partner portal</h1>
          <div className="muted">{p.company || p.name} · code {p.code}</div>
        </div>
        {p.status === 'suspended' && <span className="tag bad">Suspended</span>}
      </div>
      {p.status === 'suspended' && (
        <div className="banner bad">Your partner account is suspended. Your link does not count new visits or referrals, and payouts are paused. Please contact VeritBooks.</div>
      )}
      <nav className="tabs" aria-label="Partner sections">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Overview' && <Overview me={me} go={setTab} />}
      {tab === 'Links and tools' && <Tools me={me} />}
      {tab === 'Referrals' && <Referrals me={me} />}
      {tab === 'Earnings' && <Earnings me={me} />}
      {tab === 'Payouts' && <Payouts me={me} reload={reload} />}
      {tab === 'Resources' && <Resources me={me} />}
      {tab === 'Profile' && <Profile me={me} reload={reload} />}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The app at /partners
 * ---------------------------------------------------------------------------------------------- */

export function PartnerApp() {
  const [state, setState] = useState<
    { s: 'loading' } | { s: 'out' } | { s: 'apply'; user: User; invited: { name: string; company: string } | null } | { s: 'in'; user: User; me: Me } | { s: 'error'; error: string }
  >({ s: 'loading' });
  const [programme, setProgramme] = useState<PartnerProgramme | null>(null);

  const load = async () => {
    try {
      setProgramme(await repo.partnerProgramme().catch(() => null));
      const user = await repo.currentUser();
      if (!user) return setState({ s: 'out' });
      const me = await repo.partnerMe();
      if (!me) return setState({ s: 'apply', user, invited: null });
      try {
        localStorage.removeItem(PARTNER_INTENT);
      } catch {
        // Nothing to clear.
      }
      if ('invited' in me && me.invited) return setState({ s: 'apply', user, invited: { name: me.name, company: me.company } });
      setState({ s: 'in', user, me: me as Me });
    } catch (e) {
      setState({ s: 'error', error: message(e) });
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      {repo.mode === 'demo' && <div className="demo-strip">Demo mode. Data is kept in this browser only.</div>}
      <header className="topbar">
        <a href="/" className="brand">
          <img src="/landing/logo-mark.png" alt="" />
          Verit<span>Books</span> <em style={{ fontStyle: 'normal', fontWeight: 400, marginLeft: 6 }}>Partners</em>
        </a>
        <div className="spacer" />
        {(state.s === 'in' || state.s === 'apply') && (
          <>
            <span className="small muted">{state.user.email}</span>
            <button
              onClick={() => {
                void repo.signOut().then(() => setState({ s: 'out' }));
              }}
            >
              Sign out
            </button>
          </>
        )}
      </header>
      {state.s === 'loading' && <div className="page muted">Loading…</div>}
      {state.s === 'error' && (
        <div className="page">
          <div className="banner bad">Could not load the partner portal: {state.error}</div>
        </div>
      )}
      {state.s === 'out' && <ProgrammePage p={programme} onSignedIn={() => void load()} />}
      {state.s === 'apply' && programme && <ApplyForm p={programme} invited={state.invited} user={state.user} onDone={() => void load()} />}
      {state.s === 'in' && <Portal me={state.me} reload={load} />}
    </>
  );
}
