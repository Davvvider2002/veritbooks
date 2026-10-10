import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { repo } from './data';
import type { Billing, PlanOffer, Workspace } from './data/repo';
import { FOUNDING_PLACES, PRICE_HOLD_YEARS, TRIAL_DAYS, daysLeft } from './engine/billing';
import { longDate } from './engine/report';
import { ErrorNote, useAction } from './ui';

const naira = (kobo: number) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
const day = (iso: string | null) => (iso ? longDate(iso.slice(0, 10)) : '');
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** One line, shown on every page, while the firm is in its trial or has lapsed. */
export function PlanStrip({ billing }: { billing: Billing }) {
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

function PlanCard({ p, billing, partner, busy, onChoose }: { p: PlanOffer; billing: Billing; partner: boolean; busy: boolean; onChoose: () => void }) {
  const current = billing.state === 'active' && billing.plan === p.code;
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
          ) : p.amountKobo < p.listKobo ? (
            <>a year, held at your founding price. The price today is {naira(p.listKobo)}.</>
          ) : (
            'a year'
          )}
        </div>
      </div>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>{p.maxUsers === null ? 'Any number of users' : `Up to ${p.maxUsers} users`}</li>
        <li>{p.maxEngagements} new engagements a year</li>
        <li>Audit, review and compilation files, signed and locked</li>
        <li>Group consolidation, client requests, quality management and AI assistance</li>
      </ul>
      {partner && (
        <div>
          <button className={current ? '' : 'primary'} disabled={busy} onClick={onChoose}>
            {current ? 'Renew for a year' : billing.state === 'active' ? `Move to ${p.name}` : `Choose ${p.name}`}
          </button>
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
  const [params] = useSearchParams();
  const nav = useNavigate();
  const checked = useRef(false);

  // Flutterwave sends the partner back here with the result in the address. The result is
  // never taken at its word: the billing function asks Flutterwave before anything changes.
  useEffect(() => {
    const status = params.get('status');
    if (!status || checked.current) return;
    checked.current = true;
    const id = params.get('transaction_id');
    nav('/billing', { replace: true });
    if (!id || (status !== 'successful' && status !== 'completed')) {
      setNotice('The payment was not completed, and nothing was charged to your plan. You can try again below.');
      return;
    }
    void run(async () => {
      setNotice(await repo.confirmPayment(id));
      await onChanged();
    });
  }, []);

  const choose = (p: PlanOffer) =>
    void run(async () => {
      setNotice(null);
      const r = await repo.startCheckout(p.code);
      if (r.link) {
        window.location.assign(r.link);
        return;
      }
      setNotice(r.message ?? null);
      await onChanged();
    });

  const founding = b.plans.some((p) => p.founding);
  return (
    <div className="page stack">
      <h1>Billing</h1>
      <section className="card stack" aria-label="Your plan">
        <div className="between">
          <h3>{b.state === 'active' ? `${b.planName} plan` : 'Free trial'}</h3>
          <span className={`tag ${b.state === 'active' ? 'ok' : b.state === 'trial' ? 'warn' : 'bad'}`}>
            {b.state === 'active' ? 'Active' : b.state === 'trial' ? `${days(daysLeft(b.trialEndsAt, new Date()))} left` : 'Ended'}
          </span>
        </div>
        {b.state === 'trial' && (
          <p style={{ margin: 0 }}>
            Your {TRIAL_DAYS} day trial runs until {day(b.trialEndsAt)}. You can use every feature with up to {b.maxEngagements} engagements and {b.maxUsers} users. Signing a file needs a paid plan. If the trial ends before you choose one, your work stays exactly as it is and becomes read-only.
          </p>
        )}
        {b.state === 'expired' && (
          <p style={{ margin: 0 }}>
            {b.paidUntil ? `Your plan ended on ${day(b.paidUntil)}.` : `Your trial ended on ${day(b.trialEndsAt)}.`} Nothing has been deleted. You can open, read and print every file. Choose a plan and work carries on from where it stopped.
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
          </div>
        )}
      </section>

      {founding && (
        <div className="banner warn" role="note" aria-label="Founding firm offer">
          <strong>Founding firm offer.</strong> The first {FOUNDING_PLACES} firms to join pay 40% less for their first year, and today's prices are held for {PRICE_HOLD_YEARS} years. {b.foundingLeft} of {FOUNDING_PLACES} places are left. In return we ask for your honest feedback and, if you are happy, a reference.
        </div>
      )}
      {notice && <div className="banner info">{notice}</div>}
      <ErrorNote error={error} />
      <div className="grid3">
        {b.plans.map((p) => (
          <PlanCard key={p.code} p={p} billing={b} partner={partner} busy={busy} onChoose={() => choose(p)} />
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {partner ? 'Payment is taken in naira by Flutterwave, by card, bank transfer or USSD. VeritBooks never sees or stores your card details.' : 'Only a partner can choose or change the plan.'} A plan runs for one year from the day it is paid. Renewing early adds a year to the end of the current one.
      </p>

      {b.payments.length > 0 && (
        <section className="card stack" aria-label="Payments">
          <h3>Payments</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Covers until</th>
                <th>Reference</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {b.payments.map((p) => (
                <tr key={p.id}>
                  <td>{day(p.paidAt)}</td>
                  <td>
                    {b.plans.find((x) => x.code === p.plan)?.name ?? p.plan}
                    {p.founding ? ' (founding price)' : ''}
                  </td>
                  <td>{day(p.coversUntil)}</td>
                  <td className="small muted">{p.reference}</td>
                  <td className="num">{naira(p.amountKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
