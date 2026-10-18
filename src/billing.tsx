import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { repo } from './data';
import type { Billing, Checkout, PaymentRecord, PlanOffer, Workspace } from './data/repo';
import { FOUNDING_PLACES, PRICE_HOLD_YEARS, TRIAL_DAYS, daysLeft, priceText, vatOn } from './engine/billing';
import { longDate } from './engine/report';
import type { EngagementType } from './engine/types';
import { ErrorNote, useAction } from './ui';

/** A naira amount. Firms elsewhere see their own currency through priceText. */
export const naira = (kobo: number) => priceText(kobo, 'NGN');
const CURRENCY_WORD: Record<string, string> = { NGN: 'naira', GHS: 'cedis', USD: 'US dollars', ZAR: 'rand' };
const day = (iso: string | null) => (iso ? longDate(iso.slice(0, 10)) : '');
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** What a payment was for, in words. */
export function paidFor(p: Pick<PaymentRecord, 'kind' | 'plan' | 'engagementType' | 'withGroup' | 'founding'>, planName: (code: string) => string): string {
  if (p.kind === 'plan') return `${planName(p.plan ?? '')} plan, one year${p.founding ? ' (founding firm price)' : ''}`;
  if (p.kind === 'group') return 'Group consolidation for one engagement';
  return `One ${p.engagementType} engagement${p.withGroup ? ' with group consolidation' : ''}`;
}

/** One line, shown on every page, while the firm is in its trial, has lapsed or is suspended. */
export function PlanStrip({ billing }: { billing: Billing }) {
  if (billing.state === 'suspended')
    return (
      <div className="plan-strip bad no-print">
        This account is suspended{billing.suspendedReason ? `: ${billing.suspendedReason}` : ''}. Your files can be read and nothing can be changed.
        {billing.seller.supportEmail ? ` Write to ${billing.seller.supportEmail}.` : ' Please contact VeritBooks support.'}
      </div>
    );
  if (billing.state === 'active') {
    const left = daysLeft(billing.paidUntil, new Date());
    if (left > 30) return null;
    return (
      <div className="plan-strip no-print">
        Your {billing.planName} plan ends in {days(left)}. <Link to="/billing">Renew</Link>
      </div>
    );
  }
  if (billing.state === 'trial')
    return (
      <div className="plan-strip no-print">
        Free trial: {days(daysLeft(billing.trialEndsAt, new Date()))} left. Everything works except signing. <Link to="/billing">Choose a plan</Link>
      </div>
    );
  return (
    <div className="plan-strip bad no-print">
      Your {billing.paidUntil ? 'plan' : 'free trial'} has ended. Your work is safe and you can read and print all of it, but nothing can be changed. <Link to="/billing">Choose a plan</Link>
    </div>
  );
}

function PlanCard({ p, billing, partner, busy, blocked, onChoose }: { p: PlanOffer; billing: Billing; partner: boolean; busy: boolean; blocked: boolean; onChoose: () => void }) {
  const current = billing.state === 'active' && billing.plan === p.code;
  const naira = (k: number) => priceText(k, billing.currency);
  const label = { new: `Choose ${p.name}`, renew: 'Renew for a year', upgrade: `Move up to ${p.name}`, switch: `Move to ${p.name}`, later: `Move to ${p.name}` }[p.mode];
  return (
    <section className="card stack" aria-label={`${p.name} plan`}>
      <div className="between">
        <h3>{p.name}</h3>
        {current && <span className="tag ok">Your plan</span>}
      </div>
      <div>
        <div className="price">{naira(p.amountKobo)}</div>
        <div className="small muted">
          {p.founding ? (
            <>
              for your first year, instead of <s>{naira(p.listKobo)}</s>
            </>
          ) : p.mode === 'upgrade' ? (
            <>
              today, for a new year starting now. {naira(p.creditKobo)} has been taken off for the unused part of your {billing.planName} plan. The full price is {naira(p.amountKobo + p.creditKobo)}.
            </>
          ) : p.amountKobo < p.listKobo ? (
            <>a year, held at your founding price. The price today is {naira(p.listKobo)}.</>
          ) : (
            'a year'
          )}
        </div>
      </div>
      {billing.vatPercent > 0 && (
        <div className="small">
          Plus {billing.taxLabel} at {billing.vatPercent}%: {naira(vatOn(p.amountKobo, billing.vatPercent))}. You pay <strong>{naira(p.amountKobo + vatOn(p.amountKobo, billing.vatPercent))}</strong>.
        </div>
      )}
      <Converted b={billing} net={p.amountKobo} />
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>{p.maxUsers === null ? 'Any number of users' : `Up to ${p.maxUsers} users`}</li>
        <li>{p.maxEngagements} new engagements a year</li>
        <li>Audit, review and compilation files, signed and locked</li>
        <li>Group consolidation, client requests, quality management and AI assistance</li>
      </ul>
      {p.mode === 'later' && <div className="small muted">You can move to a smaller plan in the last 30 days of your paid year.</div>}
      {p.mode === 'switch' && <div className="small muted">A year is added after your current one ends. The smaller limits apply from today.</div>}
      {partner && p.mode !== 'later' && (
        <div>
          <button className={current ? '' : 'primary'} disabled={busy || blocked} onClick={onChoose}>
            {label}
          </button>
        </div>
      )}
    </section>
  );
}

/** What a price is collected as, when the country pays in another currency. */
export function converted(b: Pick<Billing, 'currency' | 'chargeCurrency' | 'chargeRate' | 'vatPercent'>, net: number): number | null {
  if (b.chargeCurrency === b.currency) return null;
  const vat = vatOn(net, b.vatPercent);
  return Math.round(net * b.chargeRate) + Math.round(vat * b.chargeRate);
}

function Converted({ b, net }: { b: Billing; net: number }) {
  const amount = converted(b, net);
  if (amount === null) return null;
  return (
    <div className="small">
      Collected in {b.chargeCurrency}: <strong>{priceText(amount, b.chargeCurrency)}</strong>, at {priceText(100, b.currency)} = {b.chargeRate} {b.chargeCurrency}.
    </div>
  );
}

/** A receipt that prints on its own page. */
function Receipt({ p, ws, onClose }: { p: PaymentRecord; ws: Workspace; onClose: () => void }) {
  const b = ws.billing;
  // A converted payment is shown in the firm's own currency, then as collected.
  const q = p.quotedCurrency && p.quotedKobo != null ? { cur: p.quotedCurrency, total: p.quotedKobo, vat: p.quotedVatKobo ?? 0 } : { cur: p.currency, total: p.amountKobo, vat: p.vatKobo };
  const naira = (k: number) => priceText(k, q.cur);
  const planName = (code: string) => b.plans.find((x) => x.code === code)?.name ?? code;
  return (
    <div className="page stack">
      <div className="row no-print">
        <button onClick={onClose}>Back to billing</button>
        <button className="primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <section className="card stack receipt" aria-label="Receipt">
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{b.seller.name || 'VeritBooks'}</h2>
            {b.seller.address && <div className="small">{b.seller.address}</div>}
            {b.seller.taxId && <div className="small">{b.seller.taxId}</div>}
            {b.seller.supportEmail && <div className="small">{b.seller.supportEmail}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: 0 }}>Receipt</h2>
            <div>No. {p.receiptNo ?? '–'}</div>
            <div className="small">{day(p.paidAt)}</div>
          </div>
        </div>
        <div>
          <div className="small muted">Received from</div>
          <div>{ws.firm.name}</div>
          {ws.firm.address && <div className="small">{ws.firm.address}</div>}
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {paidFor(p, planName)}
                {p.coversUntil ? `, to ${day(p.coversUntil)}` : ''}
              </td>
              <td className="num">{naira(q.total - q.vat + p.creditKobo)}</td>
            </tr>
            {p.creditKobo > 0 && (
              <tr>
                <td>Less credit for the unused part of the previous plan</td>
                <td className="num">({naira(p.creditKobo).replace(/^[^\d]+/, '')})</td>
              </tr>
            )}
            {q.vat > 0 && (
              <>
                <tr>
                  <td>Amount before {b.taxLabel}</td>
                  <td className="num">{naira(q.total - q.vat)}</td>
                </tr>
                <tr>
                  <td>{b.taxLabel} at {Math.round((q.vat / (q.total - q.vat)) * 1000) / 10}%</td>
                  <td className="num">{naira(q.vat)}</td>
                </tr>
              </>
            )}
            {p.quotedCurrency && (
              <tr>
                <td>Total in {p.quotedCurrency}</td>
                <td className="num">{naira(q.total)}</td>
              </tr>
            )}
            <tr>
              <td>
                <strong>Amount paid{p.quotedCurrency ? `, in ${p.currency} at ${p.fxRate} ${p.currency} to 1 ${p.quotedCurrency}` : ''}</strong>
              </td>
              <td className="num">
                <strong>{priceText(p.amountKobo, p.currency)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="small muted">
          Paid {p.source === 'manual' ? 'directly to VeritBooks' : 'through Flutterwave'}. Reference {p.reference}.{q.vat > 0 ? '' : ` No ${b.taxLabel} was charged on this payment.`}
        </div>
      </section>
    </div>
  );
}

function PerEngagement({ b, partner, busy, pay }: { b: Billing; partner: boolean; busy: boolean; pay: (c: Checkout) => void }) {
  const [group, setGroup] = useState(false);
  const naira = (k: number) => priceText(k, b.currency);
  const price = (code: string) => b.engagementPrices.find((x) => x.code === code)?.priceKobo ?? 0;
  const types = b.engagementPrices.filter((x) => x.code !== 'group');
  // Files a plan does not cover: every unpaid one outside a plan, and none inside one.
  const unpaid = b.state === 'active' ? [] : b.openEngagements.filter((e) => !e.payPer);
  const addOn = b.openEngagements.filter((e) => e.payPer && !e.groupAddon);
  return (
    <section className="card stack" aria-label="Pay for one engagement">
      <div>
        <h3>Or pay for one engagement at a time</h3>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          No yearly plan needed. An engagement paid for this way can be worked on and signed whatever happens to your trial or plan. It does not count against a plan's allowance.
        </p>
      </div>
      {b.credits.length > 0 && (
        <div className="banner info">
          Paid for and ready to open: {b.credits.map((c) => `one ${c.type}${c.withGroup ? ' with group consolidation' : ''}`).join(', ')}. Open {b.credits.length === 1 ? 'it' : 'them'} from the home page as usual.
        </div>
      )}
      {unpaid.length > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>Files you have started</th>
              <th>Type</th>
              <th className="num">To finish and sign</th>
              {partner && <th />}
            </tr>
          </thead>
          <tbody>
            {unpaid.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.client}, {day(e.yearEnd)}
                </td>
                <td>{e.type}</td>
                <td className="num">{naira(price(e.type))}</td>
                {partner && (
                  <td style={{ textAlign: 'right' }}>
                    <button disabled={busy} aria-label={`Pay for ${e.client}`} onClick={() => pay({ kind: 'engagement', engagement: e.id })}>
                      Pay for this file
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {addOn.length > 0 && partner && (
        <div className="stack">
          {addOn.map((e) => (
            <div key={e.id} className="between">
              <span className="small">
                {e.client}, {day(e.yearEnd)}: paid for. Group consolidation is an add-on at {naira(price('group'))}.
              </span>
              <button disabled={busy} aria-label={`Add consolidation for ${e.client}`} onClick={() => pay({ kind: 'group', engagement: e.id })}>
                Add consolidation
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid3">
        {types.map((t) => (
          <div key={t.code} className="stack" style={{ gap: 6 }}>
            <div>
              <strong>{t.name}</strong>
              <div className="price" style={{ fontSize: 22 }}>
                {naira(t.priceKobo + (group ? price('group') : 0))}
              </div>
            </div>
            {partner && (
              <div>
                <button disabled={busy} onClick={() => pay({ kind: 'engagement', type: t.code as EngagementType, with_group: group })}>
                  Buy one {t.name.toLowerCase()}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <label className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
        <span>With group consolidation, for a parent with subsidiaries (adds {naira(price('group'))})</span>
      </label>
      {b.vatPercent > 0 && <div className="small muted">These prices are before {b.taxLabel}. {b.taxLabel} at {b.vatPercent}% is added at checkout.</div>}
      {b.chargeCurrency !== b.currency && (
        <div className="small muted">
          Collected in {b.chargeCurrency} at {b.chargeRate} to 1 {b.currency}. One audit, for example, is collected as {priceText(converted(b, price('audit')) ?? 0, b.chargeCurrency)}{b.vatPercent > 0 ? `, ${b.taxLabel} included` : ''}.
        </div>
      )}
    </section>
  );
}

export function BillingPage({ ws, onChanged }: { ws: Workspace; onChanged: () => Promise<void> }) {
  const b = ws.billing;
  const partner = ws.me.role === 'partner';
  const { busy, error, run } = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const checked = useRef(false);

  // What is owed depends on work done since the app loaded, so look again on arrival.
  useEffect(() => {
    void onChanged();
  }, []);

  // Flutterwave sends the partner back here with the result in the address. The result is
  // never taken at its word: the billing function asks Flutterwave before anything changes.
  useEffect(() => {
    const status = params.get('status');
    if (!status || checked.current) return;
    checked.current = true;
    const id = params.get('transaction_id');
    nav('/billing', { replace: true });
    if (!id || (status !== 'successful' && status !== 'completed')) {
      setNotice('The payment was not completed, and nothing was charged. You can try again below.');
      return;
    }
    void run(async () => {
      setNotice(await repo.confirmPayment(id));
      await onChanged();
    });
  }, []);

  const pay = (c: Checkout) =>
    void run(async () => {
      setNotice(null);
      const r = await repo.startCheckout(c);
      if (r.link) {
        window.location.assign(r.link);
        return;
      }
      setNotice(r.message ?? null);
      await onChanged();
    });

  const shown = b.payments.find((p) => p.id === receipt);
  if (shown) return <Receipt p={shown} ws={ws} onClose={() => setReceipt(null)} />;

  const founding = b.plans.some((p) => p.founding);
  const planName = (code: string) => b.plans.find((x) => x.code === code)?.name ?? code;
  const suspended = b.state === 'suspended';
  return (
    <div className="page stack">
      <h1>Billing</h1>
      <section className="card stack" aria-label="Your plan">
        <div className="between">
          <h3>{b.state === 'active' ? `${b.planName} plan` : suspended ? 'Account suspended' : 'Free trial'}</h3>
          <span className={`tag ${b.state === 'active' ? 'ok' : b.state === 'trial' ? 'warn' : 'bad'}`}>
            {b.state === 'active' ? 'Active' : b.state === 'trial' ? `${days(daysLeft(b.trialEndsAt, new Date()))} left` : suspended ? 'Suspended' : 'Ended'}
          </span>
        </div>
        {suspended && (
          <p style={{ margin: 0 }}>
            {b.suspendedReason || 'This account has been suspended.'} Every file can still be opened, read and printed. Nothing can be changed and no payment can be made until the suspension is lifted.
            {b.seller.supportEmail ? ` Write to ${b.seller.supportEmail}.` : ''}
          </p>
        )}
        {b.state === 'trial' && (
          <p style={{ margin: 0 }}>
            Your {TRIAL_DAYS} day trial runs until {day(b.trialEndsAt)}. You can use every feature with up to {b.maxEngagements} engagements and {b.maxUsers} users. Signing a file needs a paid plan, or payment for that one engagement. If the trial ends before you choose, your work stays exactly as it is and becomes read-only.
          </p>
        )}
        {b.state === 'expired' && (
          <p style={{ margin: 0 }}>
            {b.paidUntil ? `Your plan ended on ${day(b.paidUntil)}.` : `Your trial ended on ${day(b.trialEndsAt)}.`} Nothing has been deleted. You can open, read and print every file. Choose a plan, or pay for a single engagement, and work carries on from where it stopped.
          </p>
        )}
        {b.state === 'active' && (
          <p style={{ margin: 0 }}>
            Paid until {day(b.paidUntil)}. {b.engagementsUsed} of {b.maxEngagements} engagements used this year. {b.users} of {b.maxUsers ?? 'any number of'} users.
          </p>
        )}
        {b.foundingNumber !== null && (
          <div className="banner info">
            Founding firm number {b.foundingNumber} of {FOUNDING_PLACES}. Your renewal prices are held until {day(b.priceLockUntil)}.
            {b.foundingAgreedAt && ` The founding commitment, to give feedback and a reference if you are happy, was accepted by ${b.foundingAgreedBy || 'a partner'} on ${day(b.foundingAgreedAt)}.`}
          </div>
        )}
      </section>

      {founding && !suspended && (
        <div className="banner warn stack" role="note" aria-label="Founding firm offer" style={{ gap: 8 }}>
          <div>
            <strong>Founding firm offer.</strong> The first {FOUNDING_PLACES} firms to join pay 40% less for their first year, and today's prices are held for {PRICE_HOLD_YEARS} years. {b.foundingLeft} of {FOUNDING_PLACES} places are left.
          </div>
          {partner && (
            <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
              <span>
                I am a partner of {ws.firm.name}. In return for the founding price, we agree to give VeritBooks honest feedback during our first year and, if we are happy with it, to act as a reference.
              </span>
            </label>
          )}
        </div>
      )}
      {notice && <div className="banner info">{notice}</div>}
      <ErrorNote error={error} />
      {!suspended && (
        <>
          <div className="grid3">
            {b.plans.map((p) => (
              <PlanCard key={p.code} p={p} billing={b} partner={partner} busy={busy} blocked={p.founding && !agreed} onChoose={() => pay({ kind: 'plan', plan: p.code, founding_agreed: p.founding && agreed })} />
            ))}
          </div>
          {founding && partner && !agreed && <p className="small muted" style={{ margin: 0 }}>Tick the founding firm commitment above to choose a plan at the founding price.</p>}
          <PerEngagement b={b} partner={partner} busy={busy} pay={pay} />
          <p className="small muted" style={{ margin: 0 }}>
            {partner
              ? `${b.vatPercent > 0 ? `Prices are shown before ${b.taxLabel}. ` : ''}Payment is taken in ${CURRENCY_WORD[b.chargeCurrency]}${b.chargeCurrency !== b.currency ? `, converted from ${CURRENCY_WORD[b.currency]} at ${b.chargeRate} to 1` : ''} by Flutterwave, by card${b.chargeCurrency === 'NGN' ? ', bank transfer or USSD' : b.chargeCurrency === 'GHS' ? ', mobile money or bank transfer' : b.chargeCurrency === 'ZAR' ? ', bank account or 1Voucher' : ''}. VeritBooks never sees or stores your card details.`
              : 'Only a partner can make a payment.'} A plan runs for one year from the day it is paid. Renewing early adds a year to the end of the current one. Moving to a bigger plan starts a new year today, with credit for what is left of the old one.
          </p>
        </>
      )}

      {b.payments.length > 0 && (
        <section className="card stack" aria-label="Payments">
          <h3>Payments</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>For</th>
                <th>Covers until</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {b.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receiptNo ?? '–'}</td>
                  <td>{day(p.paidAt)}</td>
                  <td>{paidFor(p, planName)}</td>
                  <td>{day(p.coversUntil)}</td>
                  <td className="num">{priceText(p.amountKobo, p.currency)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="link" aria-label={`Receipt ${p.receiptNo}`} onClick={() => setReceipt(p.id)}>
                      Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
