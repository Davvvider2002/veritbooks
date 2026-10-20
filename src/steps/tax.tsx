import { useMemo, useState } from 'react';
import { repo } from '../data';
import { fmt, fmt2, parseAmount, cur } from '../engine/money';
import { longDate } from '../engine/report';
import {
  companyRate,
  computeTax,
  deferredTax,
  provisionalTax,
  sbcTable,
  startingWorking,
  taxCharge,
  taxJournals,
  type DeferredRow,
  type ProvisionalPayment,
  type TaxItem,
  type TaxWorking,
} from '../engine/tax';
import { ITEM } from '../engine/chart';
import type { TbLine } from '../engine/types';
import { keepLine } from '../engine/yearsOf';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';

const str = (k: number | undefined | null) => (k === undefined || k === null ? '' : (k / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const num = (s: string) => parseAmount(s) ?? 0;
const opt = (s: string) => (s.trim() === '' ? undefined : (parseAmount(s) ?? undefined));
const numOr = (s: string, d: number) => (s.trim() === '' || Number.isNaN(Number(s)) ? d : Number(s));

type PayForm = { estimate: string; paid: string; date: string };
const payForm = (p?: ProvisionalPayment): PayForm => ({ estimate: str(p?.estimate), paid: str(p?.paid), date: p?.date ?? '' });
const payOf = (p: PayForm): ProvisionalPayment | undefined => {
  const out: ProvisionalPayment = { estimate: opt(p.estimate), paid: opt(p.paid), date: p.date || undefined };
  return out.estimate === undefined && out.paid === undefined && !out.date ? undefined : out;
};

function initial(w: TaxWorking) {
  const p = w.provisional ?? {};
  return {
    mode: w.mode,
    rate: String(w.rate),
    deferredRate: w.deferredRate === undefined ? '' : String(w.deferredRate),
    loss: str(w.lossBroughtForward),
    items: w.items.map((i) => ({ label: i.label, amount: str(i.amount), kind: i.kind })),
    deferred: w.deferred.map((r) => ({ label: r.label, kind: r.kind, carrying: str(r.carrying), taxBase: str(r.taxBase), source: r.source })),
    recogniseLoss: w.recogniseLoss,
    basicTaxable: str(p.basicTaxable),
    basicYearEnd: p.basicYearEnd ?? '',
    first: payForm(p.first),
    second: payForm(p.second),
    third: payForm(p.third),
    interestRate: p.interestRate === undefined ? '' : String(p.interestRate),
    interestTo: p.interestTo ?? '',
    accounts: w.accounts ?? {},
  };
}
type Form = ReturnType<typeof initial>;

function toWorking(f: Form): TaxWorking {
  return {
    mode: f.mode,
    rate: numOr(f.rate, 0),
    deferredRate: f.deferredRate.trim() === '' ? undefined : numOr(f.deferredRate, 0),
    lossBroughtForward: Math.max(0, num(f.loss)),
    items: f.items.filter((i) => i.label.trim()).map((i): TaxItem => ({ label: i.label.trim(), amount: Math.abs(num(i.amount)), kind: i.kind })),
    deferred: f.deferred
      .filter((r) => r.label.trim())
      .map((r): DeferredRow => ({ label: r.label.trim(), kind: r.kind, carrying: r.source ? 0 : num(r.carrying), taxBase: num(r.taxBase), source: r.source })),
    recogniseLoss: f.recogniseLoss,
    provisional: {
      basicTaxable: opt(f.basicTaxable),
      basicYearEnd: f.basicYearEnd || undefined,
      first: payOf(f.first),
      second: payOf(f.second),
      third: payOf(f.third),
      interestRate: f.interestRate.trim() === '' ? undefined : numOr(f.interestRate, 0),
      interestTo: f.interestTo || undefined,
    },
    accounts: f.accounts,
  };
}

const firstMapped = (lines: TbLine[], ...codes: string[]) => {
  for (const c of codes) {
    const l = lines.find((x) => x.mapCode === c);
    if (l) return l.id;
  }
  return undefined;
};

/** The next free reference: TAX1, then TAX1-2 if TAX1 is already used in this file. */
const freeRef = (ref: string, used: string[]) => {
  if (!used.includes(ref)) return ref;
  let n = 2;
  while (used.includes(`${ref}-${n}`)) n++;
  return `${ref}-${n}`;
};

export function TaxStep({ eng, lines, adjustments, statements: st, locked, reload }: Ctx) {
  const saved = eng.disclosures.tax;
  const [f, setF] = useState<Form>(() => initial(saved ?? startingWorking(eng.yearEnd, st.cur)));
  const [posted, setPosted] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const set = (patch: Partial<Form>) => {
    setDone(null);
    setF({ ...f, ...patch });
  };

  const w = useMemo(() => toWorking(f), [f]);
  const comp = useMemo(() => computeTax(st.cur, w, eng.yearEnd), [st.cur, w, eng.yearEnd]);
  const dt = useMemo(() => deferredTax(st.cur, st.prior, w, comp), [st, w, comp]);
  const charge = taxCharge(st.cur, comp, dt);
  const prov = useMemo(() => provisionalTax(comp, w.provisional ?? {}, eng.yearEnd), [comp, w, eng.yearEnd]);

  const accounts = {
    expense: f.accounts.expense ?? firstMapped(lines, 'income_tax_expense'),
    payable: f.accounts.payable ?? firstMapped(lines, 'current_tax_payable'),
    deferred: f.accounts.deferred ?? (dt.closing < 0 ? firstMapped(lines, 'deferred_tax_asset', 'deferred_tax_liability') : firstMapped(lines, 'deferred_tax_liability', 'deferred_tax_asset')),
  };
  const journals = taxJournals(charge, dt, accounts);
  // Accounts a journal needs that the trial balance does not have. They can be added with a nil balance.
  const missing = [
    !accounts.expense && (charge.currentAdjustment !== 0 || dt.adjustment !== 0) && { code: 'TAX-EXP', name: 'Income tax expense', mapCode: 'income_tax_expense' },
    !accounts.payable && charge.currentAdjustment !== 0 && { code: 'TAX-CUR', name: 'Current tax payable', mapCode: 'current_tax_payable' },
    !accounts.deferred && dt.adjustment !== 0 && { code: 'TAX-DEF', name: 'Deferred tax', mapCode: dt.closing < 0 ? 'deferred_tax_asset' : 'deferred_tax_liability' },
  ].filter((x): x is { code: string; name: string; mapCode: string } => !!x);
  const table = sbcTable(eng.yearEnd);
  const usedRefs = adjustments.map((a) => a.ref);
  const name = (id: string) => {
    const l = lines.find((x) => x.id === id);
    return l ? `${l.code} ${l.name}` : 'Unknown account';
  };

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Income tax</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const save = () =>
    run(async () => {
      const working = { ...w, accounts };
      // The tax note reconciles at the same rate unless the preparer has set one there.
      const taxRate = eng.disclosures.taxRate ?? (w.mode === 'flat' ? w.rate : undefined);
      await repo.updateEngagement(eng.id, { disclosures: { ...eng.disclosures, tax: working, taxRate } });
      setDone('Saved.');
      reload();
    });

  const amountInput = (label: string, value: string, onChange: (v: string) => void) => (
    <input type="text" inputMode="decimal" className="num" aria-label={label} disabled={locked} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  const itemRows = (kind: 'add' | 'deduct') =>
    f.items.map((it, i) =>
      it.kind !== kind ? null : (
        <tr key={i}>
          <td>
            <input type="text" aria-label={`${kind === 'add' ? 'Addition' : 'Deduction'} ${i + 1}`} placeholder={kind === 'add' ? 'Item added back' : 'Allowance or exempt income'} disabled={locked} value={it.label} onChange={(e) => set({ items: f.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
          </td>
          <td>{amountInput(`Amount of ${kind === 'add' ? 'addition' : 'deduction'} ${i + 1}`, it.amount, (v) => set({ items: f.items.map((x, j) => (j === i ? { ...x, amount: v } : x)) }))}</td>
          <td>{!locked && <button className="link danger" onClick={() => set({ items: f.items.filter((_, j) => j !== i) })}>Remove</button>}</td>
        </tr>
      ),
    );
  const accountSelect = (label: string, key: 'expense' | 'payable' | 'deferred', codes: string[]) => (
    <Field label={label}>
      <select disabled={locked} value={accounts[key] ?? ''} onChange={(e) => set({ accounts: { ...f.accounts, [key]: e.target.value || undefined } })}>
        <option value="">Choose an account</option>
        {[...lines]
          .sort((a, b) => Number(codes.includes(b.mapCode ?? '')) - Number(codes.includes(a.mapCode ?? '')))
          .map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} {l.name}
              {l.mapCode && codes.includes(l.mapCode) ? ` (${ITEM.get(l.mapCode)?.label})` : ''}
            </option>
          ))}
      </select>
    </Field>
  );
  const payRow = (key: 'first' | 'second' | 'third', i: number) => {
    const p = prov.payments[i];
    const v = f[key];
    const put = (patch: Partial<PayForm>) => set({ [key]: { ...v, ...patch } } as Partial<Form>);
    return (
      <tr key={key}>
        <td style={{ minWidth: 170 }}>
          {p.label}
          <div className="small muted">Due {longDate(p.due)}</div>
        </td>
        <td style={{ minWidth: 160 }}>{key === 'third' ? <span className="small muted">Not needed</span> : amountInput(`${p.label} estimate of taxable income`, v.estimate, (x) => put({ estimate: x }))}</td>
        <td className="num">{fmt(p.required, { zero: '0' })}</td>
        <td style={{ minWidth: 150 }}>{amountInput(`${p.label} amount paid`, v.paid, (x) => put({ paid: x }))}</td>
        <td style={{ minWidth: 160 }}>
          <input type="date" aria-label={`${p.label} date paid`} disabled={locked} value={v.date} onChange={(e) => put({ date: e.target.value })} />
        </td>
        <td className="num" style={{ minWidth: 120 }}>
          {p.latePenalty > 0 ? <span style={{ color: 'var(--bad)' }}>{fmt(p.latePenalty)}</span> : '–'}
          {p.late && <div className="small muted">Paid late</div>}
        </td>
      </tr>
    );
  };

  return (
    <div className="stack">
      <div>
        <h2>Income tax</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          The company’s income tax for the year of assessment ended {longDate(eng.yearEnd)}: taxable income and current tax, deferred tax, the journals that post them, and provisional tax. Rates follow SARS’s published tables. Check them, and every adjustment, against the Income Tax Act for the year before the return is filed.
        </p>
      </div>

      <div className="card stack">
        <h3>Rate</h3>
        <div className="grid3">
          <Field label="Rate applied">
            <select disabled={locked} value={f.mode} onChange={(e) => set({ mode: e.target.value as Form['mode'] })}>
              <option value="flat">Company rate</option>
              <option value="sbc">Small business corporation (section 12E)</option>
            </select>
          </Field>
          <Field label="Company tax rate, %" hint={`SARS: ${companyRate(eng.yearEnd)}% for this year end.`}>
            <input type="number" min="0" max="100" step="0.5" disabled={locked} value={f.rate} onChange={(e) => set({ rate: e.target.value })} />
          </Field>
          <Field label="Deferred tax rate, %" hint="The rate expected when the differences reverse. Blank uses the company rate.">
            <input type="number" min="0" max="100" step="0.5" disabled={locked} value={f.deferredRate} placeholder={f.rate} onChange={(e) => set({ deferredRate: e.target.value })} />
          </Field>
        </div>
        {f.mode === 'sbc' &&
          (table ? (
            <div className="small">
              <strong>SBC table for {table.label}:</strong>{' '}
              {table.bands
                .map(([from, base, rate], i) => (i === 0 ? `nil up to R${table.bands[1][0].toLocaleString('en-ZA')}` : `${base ? `R${base.toLocaleString('en-ZA')} + ` : ''}${rate}% above R${from.toLocaleString('en-ZA')}`))
                .join('; ')}
              . The company must meet every condition of section 12E, including gross income of R20 million or less and shareholders who are all natural persons.
            </div>
          ) : (
            <div className="banner warn">No SBC table is held for a year ending {longDate(eng.yearEnd)}, so the company rate entered above is applied. Check the table SARS published for the year.</div>
          ))}
      </div>

      <div className="card stack">
        <h3>Tax computation</h3>
        <table className="data">
          <tbody>
            <tr>
              <td><strong>Profit before tax per the financial statements</strong></td>
              <td className="num" style={{ width: 180 }}><strong>{fmt(comp.pbt, { zero: '0' })}</strong></td>
              <td style={{ width: 70 }}></td>
            </tr>
            <tr className="heading"><td colSpan={3}>Add: expenses not deductible, and income taxable but not in profit</td></tr>
            {itemRows('add')}
            <tr className="heading"><td colSpan={3}>Less: allowances, deductions and exempt income</td></tr>
            {itemRows('deduct')}
            <tr>
              <td>{comp.beforeLoss >= 0 ? 'Taxable income before assessed loss' : 'Assessed loss for the year'}</td>
              <td className="num">{fmt(comp.beforeLoss, { zero: '0' })}</td>
              <td></td>
            </tr>
            <tr>
              <td>Assessed loss brought forward</td>
              <td>{amountInput('Assessed loss brought forward', f.loss, (v) => set({ loss: v }))}</td>
              <td></td>
            </tr>
            {comp.lossUsed > 0 && (
              <tr>
                <td>
                  Assessed loss set off
                  {comp.lossCap !== null && comp.lossUsed === comp.lossCap && <div className="small muted">Limited to the greater of R1 million and 80% of taxable income, section 20(1)(a).</div>}
                </td>
                <td className="num">({fmt(comp.lossUsed)})</td>
                <td></td>
              </tr>
            )}
            <tr>
              <td><strong>Taxable income</strong></td>
              <td className="num"><strong>{fmt(comp.taxable, { zero: '0' })}</strong></td>
              <td></td>
            </tr>
            <tr>
              <td>Assessed loss carried forward</td>
              <td className="num">{fmt(comp.lossCarriedForward, { zero: '0' })}</td>
              <td></td>
            </tr>
            <tr>
              <td>
                <strong>Current tax</strong>{' '}
                <span className="small muted">{comp.mode === 'sbc' && comp.table ? 'on the SBC table' : `at ${comp.rate}%`}</span>
              </td>
              <td className="num"><strong>{fmt2(comp.currentTax)}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        {!locked && (
          <div className="row">
            <button onClick={() => set({ items: [...f.items, { label: '', amount: '', kind: 'add' }] })}>Add an item added back</button>
            <button onClick={() => set({ items: [...f.items, { label: '', amount: '', kind: 'deduct' }] })}>Add an allowance or deduction</button>
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          Usual additions: depreciation, donations above the section 18A limit, fines and penalties, provisions not yet paid, and expenses of a capital nature. Usual deductions: wear-and-tear and other capital allowances (sections 11(e), 12C, 13), provisions paid in the year, and exempt local dividends (section 10(1)(k)).
        </p>
      </div>

      <div className="card stack">
        <h3>Deferred tax</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Section 29 of the IFRS for SMEs Accounting Standard. Enter the tax base of each asset and liability whose carrying amount differs from it. Lines marked as following the statements take their carrying amount from the statement of financial position.
        </p>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th className="num">Carrying amount {cur()}</th>
                <th className="num">Tax base {cur()}</th>
                <th className="num">Temporary difference</th>
                <th className="num">Deferred tax at {dt.rate}%</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {f.deferred.map((r, i) => {
                // Rows without a name are left out of the schedule, so count only the named ones.
                const line = r.label.trim() ? dt.lines[f.deferred.slice(0, i).filter((y) => y.label.trim()).length] : undefined;
                const put = (patch: Partial<Form['deferred'][number]>) => set({ deferred: f.deferred.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <tr key={i}>
                    <td style={{ minWidth: 220 }}><input type="text" aria-label={`Deferred tax item ${i + 1}`} disabled={locked} value={r.label} onChange={(e) => put({ label: e.target.value })} /></td>
                    <td style={{ minWidth: 120 }}>
                      <select aria-label={`Type of deferred tax item ${i + 1}`} disabled={locked} value={r.kind} onChange={(e) => put({ kind: e.target.value as 'asset' | 'liability' })}>
                        <option value="asset">Asset</option>
                        <option value="liability">Liability</option>
                      </select>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      {r.source ? (
                        <div className="num">
                          {fmt(st.cur.v[r.source] ?? 0, { zero: '0' })}
                          <div className="small muted">From the statements</div>
                        </div>
                      ) : (
                        amountInput(`Carrying amount of deferred tax item ${i + 1}`, r.carrying, (v) => put({ carrying: v }))
                      )}
                    </td>
                    <td style={{ minWidth: 150 }}>{amountInput(`Tax base of deferred tax item ${i + 1}`, r.taxBase, (v) => put({ taxBase: v }))}</td>
                    <td className="num">{line ? fmt(line.difference, { zero: '0' }) : ''}</td>
                    <td className="num">{line ? fmt(line.deferred, { zero: '0' }) : ''}</td>
                    <td>{!locked && <button className="link danger" onClick={() => set({ deferred: f.deferred.filter((_, j) => j !== i) })}>Remove</button>}</td>
                  </tr>
                );
              })}
              {dt.lines
                .filter((l) => l.computed)
                .map((l) => (
                  <tr key={l.label}>
                    <td>{l.label}</td>
                    <td>Asset</td>
                    <td className="num">–</td>
                    <td className="num">{fmt(l.taxBase)}</td>
                    <td className="num">{fmt(l.difference)}</td>
                    <td className="num">{fmt(l.deferred)}</td>
                    <td></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div>
            <button onClick={() => set({ deferred: [...f.deferred, { label: '', kind: 'asset', carrying: '', taxBase: '', source: undefined }] })}>Add a deferred tax item</button>
          </div>
        )}
        <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" disabled={locked || comp.lossCarriedForward === 0} checked={f.recogniseLoss} onChange={(e) => set({ recogniseLoss: e.target.checked })} />
          <span>
            Recognise a deferred tax asset on the assessed loss carried forward{comp.lossCarriedForward > 0 ? ` (${cur()}${fmt(comp.lossCarriedForward)})` : ''}. Only where it is probable that future taxable profit will be available to use it.
          </span>
        </label>
        <table className="data" style={{ maxWidth: 520 }}>
          <tbody>
            <tr><td>Net deferred tax required at year end</td><td className="num">{fmt(dt.closing, { zero: '0' })}</td></tr>
            <tr><td>At the start of the year</td><td className="num">{fmt(dt.opening, { zero: '0' })}</td></tr>
            <tr><td><strong>{dt.movement >= 0 ? 'Charge' : 'Credit'} to profit or loss</strong></td><td className="num"><strong>{fmt(Math.abs(dt.movement), { zero: '0' })}</strong></td></tr>
            <tr><td>Net deferred tax in the accounts now</td><td className="num">{fmt(dt.booked, { zero: '0' })}</td></tr>
          </tbody>
        </table>
        <p className="small muted" style={{ margin: 0 }}>Positive figures are a liability, negative figures an asset. Deferred tax assets and liabilities are offset only where the company has a legally enforceable right to do so.</p>
      </div>

      <div className="card stack">
        <h3>Tax charge and journals</h3>
        <table className="data" style={{ maxWidth: 520 }}>
          <tbody>
            <tr><td>Current tax</td><td className="num">{fmt(charge.current, { zero: '0' })}</td></tr>
            <tr><td>Deferred tax</td><td className="num">{fmt(charge.deferred, { zero: '0' })}</td></tr>
            <tr><td><strong>Income tax expense required</strong></td><td className="num"><strong>{fmt(charge.total, { zero: '0' })}</strong></td></tr>
            <tr><td>Income tax expense in the accounts now</td><td className="num">{fmt(charge.booked, { zero: '0' })}</td></tr>
          </tbody>
        </table>
        <div className="grid3">
          {accountSelect('Income tax expense account', 'expense', ['income_tax_expense'])}
          {accountSelect('Current tax payable account', 'payable', ['current_tax_payable'])}
          {accountSelect('Deferred tax account', 'deferred', ['deferred_tax_liability', 'deferred_tax_asset'])}
        </div>
        {!locked && missing.length > 0 && (
          <div className="banner warn">
            The trial balance has no {missing.map((m) => m.name.toLowerCase()).join(' or ')} account, so {missing.length === 1 ? 'that journal' : 'those journals'} cannot be shown yet. Choose an account above, or{' '}
            <button
              className="link"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const used = new Set(lines.map((l) => l.code));
                  const added = missing.filter((m) => !used.has(m.code)).map((m) => ({ code: m.code, name: m.name, balance: 0, prior: st.hasPrior ? 0 : null, prior2: null, prior3: null, prior4: null, mapCode: m.mapCode, nature: null }));
                  await repo.replaceLines(eng.id, [...lines.map(keepLine), ...added]);
                  setDone(`Added ${added.map((a) => `${a.code} ${a.name}`).join(' and ')} to the trial balance with a nil balance.`);
                  reload();
                })
              }
            >
              add {missing.length === 1 ? 'it' : 'them'} to the trial balance
            </button>{' '}
            with a nil balance.
          </div>
        )}
        {journals.length === 0 ? (
          <div className="banner info">
            {charge.currentAdjustment === 0 && dt.adjustment === 0
              ? 'The accounts already carry the tax this computation requires. No journal is needed.'
              : 'Choose the accounts above to see the journals.'}
          </div>
        ) : (
          <>
            {journals.map((j) => (
              <div key={j.ref}>
                <strong>{freeRef(j.ref, usedRefs)}</strong> {j.description}
                <table className="data">
                  <tbody>
                    {j.lines.map((l, i) => (
                      <tr key={i}>
                        <td>{name(l.lineId)}</td>
                        <td className="num" style={{ width: 160 }}>{l.amount > 0 ? fmt2(l.amount) : ''}</td>
                        <td className="num" style={{ width: 160 }}>{l.amount < 0 ? fmt2(-l.amount) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {!locked && (
              <div className="row">
                <select aria-label="Treatment of the tax journals" value={posted ? 'posted' : 'proposed'} onChange={(e) => setPosted(e.target.value === 'posted')} style={{ width: 'auto' }}>
                  <option value="posted">Posted by the client</option>
                  <option value="proposed">Proposed, not booked</option>
                </select>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const used = [...usedRefs];
                      for (const j of journals) {
                        const ref = freeRef(j.ref, used);
                        used.push(ref);
                        await repo.addAdjustment(eng.id, { ref, description: j.description, posted, lines: j.lines });
                      }
                      await repo.updateEngagement(eng.id, { disclosures: { ...eng.disclosures, tax: { ...w, accounts } } });
                      setDone(`${journals.length === 1 ? 'The journal was' : 'The journals were'} added to the Journals step.`);
                      reload();
                    })
                  }
                >
                  Add {journals.length === 1 ? 'this journal' : 'these journals'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card stack">
        <h3>Provisional tax (IRP6)</h3>
        <p className="small muted" style={{ margin: 0 }}>
          The first payment is half the tax on the estimate, due six months into the year. The second brings the total to the tax on the year’s estimate, due on the last day of the year. A third, voluntary payment after year end stops interest running.
        </p>
        <div className="grid3">
          <Field label={`Basic amount: taxable income last assessed, ${cur()}`}>
            <input type="text" inputMode="decimal" className="num" disabled={locked} value={f.basicTaxable} onChange={(e) => set({ basicTaxable: e.target.value })} />
          </Field>
          <Field label="Year end of that assessment">
            <input type="date" disabled={locked} value={f.basicYearEnd} onChange={(e) => set({ basicYearEnd: e.target.value })} />
          </Field>
          <div className="small" style={{ alignSelf: 'end' }}>
            {prov.basic !== null && (
              <>
                Basic amount {cur()}
                {fmt(prov.basic, { zero: '0' })}
                {prov.basicUplift > 0 && <div className="muted">Increased by {prov.basicUplift}%, as the assessment is more than 18 months old.</div>}
              </>
            )}
          </div>
        </div>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Payment</th>
                <th className="num">Estimated taxable income {cur()}</th>
                <th className="num">Due {cur()}</th>
                <th className="num">Paid {cur()}</th>
                <th>Date paid</th>
                <th className="num">10% late penalty</th>
              </tr>
            </thead>
            <tbody>
              {payRow('first', 0)}
              {payRow('second', 1)}
              {payRow('third', 2)}
            </tbody>
          </table>
        </div>
        <table className="data" style={{ maxWidth: 520 }}>
          <tbody>
            <tr><td>Normal tax on assessment</td><td className="num">{fmt(comp.currentTax, { zero: '0' })}</td></tr>
            <tr><td>Provisional tax paid</td><td className="num">{fmt(prov.totalPaid, { zero: '0' })}</td></tr>
            <tr><td><strong>{prov.balance >= 0 ? 'Owed to SARS' : 'Refund due from SARS'}</strong></td><td className="num"><strong>{fmt(Math.abs(prov.balance), { zero: '0' })}</strong></td></tr>
          </tbody>
        </table>
        {prov.test && (
          <div className={`banner ${prov.test.estimate === null ? 'warn' : prov.test.passed ? 'info' : 'bad'}`}>
            <strong>Underestimation penalty, paragraph 20.</strong> {prov.test.reason}{' '}
            {prov.test.estimate === null
              ? 'Enter the second period estimate to test it.'
              : prov.test.passed
                ? 'The estimate passes the test. No penalty.'
                : `The estimate of ${cur()}${fmt(prov.test.estimate, { zero: '0' })} falls short of ${cur()}${fmt(prov.test.required)}. The penalty is 20% of the tax on the difference: ${cur()}${fmt2(prov.test.penalty)}, unless SARS remits it.`}
          </div>
        )}
        <div className="grid3">
          <Field label="Prescribed interest rate, % a year" hint="Interest under section 89quat. Not assumed: enter the rate in force.">
            <input type="number" min="0" max="50" step="0.25" disabled={locked} value={f.interestRate} onChange={(e) => set({ interestRate: e.target.value })} />
          </Field>
          <Field label="Interest runs to" hint="The date of assessment, or of payment.">
            <input type="date" disabled={locked} value={f.interestTo} onChange={(e) => set({ interestTo: e.target.value })} />
          </Field>
          <div className="small" style={{ alignSelf: 'end' }}>
            {prov.interest && (
              <>
                Interest {cur()}
                {fmt2(prov.interest.amount)} for {prov.interest.days} days from {longDate(prov.interest.from)}.
              </>
            )}
          </div>
        </div>
      </div>

      <ErrorNote error={error} />
      {done && <div className="banner info">{done}</div>}
      {!locked && (
        <div>
          <button className="primary" disabled={busy} onClick={() => void save()}>
            Save tax working
          </button>
        </div>
      )}
    </div>
  );
}
