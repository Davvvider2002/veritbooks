import { useMemo, useState } from 'react';
import { repo } from '../data';
import { disclosureGaps, ppeSchedule, STANDARD_NOTES, taxReconciliation, type PpeRow } from '../engine/disclosures';
import { fmt, fmt2, parseAmount, cur } from '../engine/money';
import type { Disclosures, EarlierYear } from '../engine/types';
import { ErrorNote, Field, useAction } from '../ui';
import type { Ctx } from '../workspace';
import { currencyOf } from '../content/jurisdictions';

const str = (k: number | undefined | null) => (k === undefined || k === null ? '' : String(k / 100));
const num = (s: string) => parseAmount(s) ?? 0;

type YearForm = Record<keyof EarlierYear, string>;
const YEAR_ROWS: [keyof EarlierYear, string][] = [
  ['revenue', 'Revenue'],
  ['pbt', 'Profit before tax'],
  ['tax', 'Income tax expense'],
  ['nca', 'Non-current assets'],
  ['ca', 'Current assets'],
  ['liabilities', 'Total liabilities'],
  ['capital', 'Share capital and premium'],
  ['reserves', 'Reserves'],
];
const NOTE_FIELDS = [
  ['goingConcern', 'Going concern'],
  ['subsequentEvents', 'Events after the reporting date'],
  ['contingencies', 'Contingent liabilities'],
  ['commitments', 'Capital commitments'],
] as const;

function initial(d: Disclosures, yearEnd: string, hasPrior: boolean) {
  const first = Number(yearEnd.slice(0, 4)) - (hasPrior ? 2 : 1);
  return {
    directors: d.directors ?? '',
    secretary: d.secretary ?? '',
    registeredOffice: d.registeredOffice ?? '',
    disposals: Object.fromEntries(Object.entries(d.ppeDisposals ?? {}).map(([k, v]) => [k, str(v)])) as Record<string, string>,
    taxRate: d.taxRate === undefined ? '' : String(d.taxRate),
    taxItems: (d.taxItems ?? []).map((i) => ({ label: i.label, amount: str(i.amount) })),
    noRelatedParties: !!d.noRelatedParties,
    relatedParties: (d.relatedParties ?? []).map((r) => ({ ...r, amount: str(r.amount), balance: str(r.balance) })),
    directorsRemuneration: str(d.directorsRemuneration),
    employees: d.employees === undefined ? '' : String(d.employees),
    goingConcern: d.goingConcern ?? '',
    subsequentEvents: d.subsequentEvents ?? '',
    contingencies: d.contingencies ?? '',
    commitments: d.commitments ?? '',
    earlier: [0, 1, 2].map((i): YearForm => {
      const e = d.earlierYears?.[i];
      const blank = { year: String(first - i), revenue: '', pbt: '', tax: '', nca: '', ca: '', liabilities: '', capital: '', reserves: '' };
      return e ? { ...blank, ...Object.fromEntries(YEAR_ROWS.map(([k]) => [k, str(e[k] as number)])), year: e.year } : blank;
    }),
  };
}
type Form = ReturnType<typeof initial>;

function toDisclosures(f: Form): Disclosures {
  const disposals: Record<string, number> = {};
  for (const [code, v] of Object.entries(f.disposals)) if (num(v) > 0) disposals[code] = num(v);
  return {
    directors: f.directors,
    secretary: f.secretary.trim(),
    registeredOffice: f.registeredOffice.trim(),
    ppeDisposals: disposals,
    taxRate: f.taxRate.trim() === '' || Number.isNaN(Number(f.taxRate)) ? undefined : Number(f.taxRate),
    taxItems: f.taxItems.filter((i) => i.label.trim()).map((i) => ({ label: i.label.trim(), amount: num(i.amount) })),
    noRelatedParties: f.noRelatedParties,
    relatedParties: f.relatedParties
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), relationship: r.relationship.trim(), nature: r.nature.trim(), amount: num(r.amount), balance: num(r.balance) })),
    directorsRemuneration: f.directorsRemuneration.trim() === '' ? undefined : num(f.directorsRemuneration),
    employees: f.employees.trim() === '' || Number.isNaN(Number(f.employees)) ? undefined : Math.round(Number(f.employees)),
    goingConcern: f.goingConcern.trim(),
    subsequentEvents: f.subsequentEvents.trim(),
    contingencies: f.contingencies.trim(),
    commitments: f.commitments.trim(),
    // A year counts once any figure is entered for it.
    earlierYears: f.earlier
      .filter((e) => YEAR_ROWS.some(([k]) => e[k].trim() !== ''))
      .map((e) => ({ year: e.year.trim(), ...Object.fromEntries(YEAR_ROWS.map(([k]) => [k, num(e[k])])) }) as EarlierYear),
  };
}

export function DisclosuresStep({ eng, lines, adjustments, statements: st, locked, reload }: Ctx) {
  const [f, setF] = useState<Form>(() => initial(eng.disclosures, eng.yearEnd, st.hasPrior));
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const set = (patch: Partial<Form>) => {
    setSaved(false);
    setF({ ...f, ...patch });
  };
  const d = useMemo(() => toDisclosures(f), [f]);
  const ppe = ppeSchedule(lines, adjustments, st.cur, d.ppeDisposals);
  const tax = taxReconciliation(st.cur, d);
  const gaps = disclosureGaps(d, st, lines, adjustments, eng.yearEnd);

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Disclosures</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const ppeRow = (r: PpeRow, increaseLabel: string) => (
    <tr key={r.code}>
      <td>{r.code} {r.name}</td>
      <td className="num">{fmt(r.opening)}</td>
      <td className="num" style={r.increase < 0 ? { color: 'var(--bad)' } : undefined} title={increaseLabel}>{fmt(r.increase)}</td>
      <td style={{ width: 150 }}>
        <input
          type="text"
          inputMode="decimal"
          className="num"
          aria-label={`Disposals, ${r.name}`}
          disabled={locked}
          value={f.disposals[r.code] ?? ''}
          onChange={(e) => set({ disposals: { ...f.disposals, [r.code]: e.target.value } })}
        />
      </td>
      <td className="num">{fmt(r.closing)}</td>
    </tr>
  );

  return (
    <div className="stack">
      <div>
        <h2>Disclosures</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          The trial balance cannot supply everything the financial statements must say. Complete each section here and it flows into the notes and the directors’ pages. Amounts are in {currencyOf(eng.currency).name}.
        </p>
      </div>
      {gaps.length === 0 ? (
        <div className="banner info">Every disclosure has what it needs.</div>
      ) : (
        <div className="banner warn">
          <strong>{gaps.length} item(s) still open.</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack">
        <h3>Directors and company information</h3>
        <div className="grid2">
          <Field label="Directors who served in the year" hint="One name per line.">
            <textarea disabled={locked} value={f.directors} onChange={(e) => set({ directors: e.target.value })} />
          </Field>
          <div className="stack">
            <Field label="Company secretary">
              <input type="text" disabled={locked} value={f.secretary} onChange={(e) => set({ secretary: e.target.value })} />
            </Field>
            <Field label="Registered office">
              <input type="text" disabled={locked} value={f.registeredOffice} onChange={(e) => set({ registeredOffice: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="grid2">
          <Field label={`Directors’ remuneration for the year, ${cur()}`} hint="Enter 0 if none was paid.">
            <input type="text" inputMode="decimal" disabled={locked} value={f.directorsRemuneration} onChange={(e) => set({ directorsRemuneration: e.target.value })} />
          </Field>
          <Field label="Average number of employees" hint={`Staff costs in the accounts: ${cur()}${fmt(st.cur.staff, { zero: '0' })}, from the staff tags in the mapping.`}>
            <input type="number" min="0" step="1" disabled={locked} value={f.employees} onChange={(e) => set({ employees: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="card stack">
        <h3>Property, plant and equipment</h3>
        {!ppe ? (
          <p className="muted" style={{ margin: 0 }}>
            {st.hasPrior ? 'No accounts are mapped to property, plant and equipment.' : 'The movement schedule needs the prior year trial balance.'}
          </p>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              Opening and closing balances come from the two trial balances. Enter the cost of assets disposed of, and the depreciation eliminated on them. Additions and the charge for the year are whatever then explains the movement.
            </p>
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Cost</th>
                    <th className="num">Opening</th>
                    <th className="num">Additions</th>
                    <th className="num">Disposals</th>
                    <th className="num">Closing</th>
                  </tr>
                </thead>
                <tbody>{ppe.cost.map((r) => ppeRow(r, 'Additions'))}</tbody>
                <thead>
                  <tr>
                    <th>Accumulated depreciation</th>
                    <th className="num">Opening</th>
                    <th className="num">Charge</th>
                    <th className="num">On disposals</th>
                    <th className="num">Closing</th>
                  </tr>
                </thead>
                <tbody>{ppe.depreciation.map((r) => ppeRow(r, 'Charge for the year'))}</tbody>
              </table>
            </div>
            <div className={`banner ${ppe.chargeDifference === 0 ? 'info' : 'bad'}`}>
              Charge per this schedule {cur()}{fmt(ppe.totalDepreciation.increase, { zero: '0' })}. Depreciation in profit or loss {cur()}{fmt(st.cur.depreciation, { zero: '0' })}.{' '}
              {ppe.chargeDifference === 0
                ? 'They agree.'
                : `They differ by ${cur()}${fmt(Math.abs(ppe.chargeDifference))}. Check the disposals, and that every depreciation account is tagged as depreciation in the mapping.`}
            </div>
          </>
        )}
      </div>

      <div className="card stack">
        <h3>Tax reconciliation</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Enter the income tax rate that applies to this company. The software does not assume one. Then list what reconciles tax at that rate to the charge: disallowed expenses, capital allowances, education tax or development levy, prior year adjustments.
        </p>
        <div style={{ maxWidth: 220 }}>
          <Field label="Applicable tax rate, %">
            <input type="number" min="0" max="100" step="0.5" disabled={locked} value={f.taxRate} onChange={(e) => set({ taxRate: e.target.value })} />
          </Field>
        </div>
        <table className="data">
          <tbody>
            <tr><td>Profit before tax</td><td className="num" style={{ width: 180 }}>{fmt(st.cur.pbt, { zero: '0' })}</td><td style={{ width: 70 }}></td></tr>
            {tax && <tr><td>Tax at {tax.rate}%</td><td className="num">{fmt(tax.atRate, { zero: '0' })}</td><td></td></tr>}
            {f.taxItems.map((it, i) => (
              <tr key={i}>
                <td>
                  <input type="text" aria-label={`Reconciling item ${i + 1}`} placeholder="Reconciling item" disabled={locked} value={it.label} onChange={(e) => set({ taxItems: f.taxItems.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                </td>
                <td>
                  <input type="text" inputMode="decimal" className="num" aria-label={`Amount of reconciling item ${i + 1}`} placeholder="Use a minus for a reduction" disabled={locked} value={it.amount} onChange={(e) => set({ taxItems: f.taxItems.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
                </td>
                <td>{!locked && <button className="link danger" onClick={() => set({ taxItems: f.taxItems.filter((_, j) => j !== i) })}>Remove</button>}</td>
              </tr>
            ))}
            {tax && (
              <>
                <tr><td><strong>Tax charge as reconciled</strong></td><td className="num"><strong>{fmt(tax.explained, { zero: '0' })}</strong></td><td></td></tr>
                <tr><td>Tax charge per the accounts</td><td className="num">{fmt(tax.charge, { zero: '0' })}</td><td></td></tr>
                <tr><td><strong>Unexplained difference</strong></td><td className="num" style={tax.difference ? { color: 'var(--bad)' } : undefined}><strong>{fmt2(tax.difference)}</strong></td><td></td></tr>
              </>
            )}
          </tbody>
        </table>
        {!locked && (
          <div>
            <button onClick={() => set({ taxItems: [...f.taxItems, { label: '', amount: tax && tax.difference ? String(tax.difference / 100) : '' }] })}>Add reconciling item</button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Related parties</h3>
        <label className="row">
          <input type="checkbox" disabled={locked || f.relatedParties.some((r) => r.name.trim())} checked={f.noRelatedParties} onChange={(e) => set({ noRelatedParties: e.target.checked })} />
          <span>There were no related party transactions to disclose, other than directors’ remuneration.</span>
        </label>
        {f.relatedParties.length > 0 && (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Nature of transactions</th>
                  <th className="num">Value in the year</th>
                  <th className="num">Balance at year end</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {f.relatedParties.map((r, i) => {
                  const edit = (patch: Partial<(typeof f.relatedParties)[number]>) => set({ relatedParties: f.relatedParties.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <tr key={i}>
                      <td><input type="text" aria-label={`Related party ${i + 1} name`} disabled={locked} value={r.name} onChange={(e) => edit({ name: e.target.value })} /></td>
                      <td><input type="text" aria-label={`Related party ${i + 1} relationship`} disabled={locked} value={r.relationship} onChange={(e) => edit({ relationship: e.target.value })} /></td>
                      <td><input type="text" aria-label={`Related party ${i + 1} nature`} disabled={locked} value={r.nature} onChange={(e) => edit({ nature: e.target.value })} /></td>
                      <td><input type="text" inputMode="decimal" className="num" aria-label={`Related party ${i + 1} value`} disabled={locked} value={r.amount} onChange={(e) => edit({ amount: e.target.value })} /></td>
                      <td><input type="text" inputMode="decimal" className="num" aria-label={`Related party ${i + 1} balance`} disabled={locked} value={r.balance} onChange={(e) => edit({ balance: e.target.value })} /></td>
                      <td>{!locked && <button className="link danger" onClick={() => set({ relatedParties: f.relatedParties.filter((_, j) => j !== i) })}>Remove</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!locked && (
          <div>
            <button onClick={() => set({ noRelatedParties: false, relatedParties: [...f.relatedParties, { name: '', relationship: '', nature: '', amount: '', balance: '' }] })}>Add a related party</button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Other notes</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Write each note, or start from the standard wording where nothing needs reporting. Use the standard wording only after you have confirmed it is true for this company.
        </p>
        {NOTE_FIELDS.map(([key, label]) => (
          <div key={key}>
            <Field label={label}>
              <textarea disabled={locked} value={f[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)} />
            </Field>
            {!locked && !f[key].trim() && (
              <button className="link small" onClick={() => set({ [key]: STANDARD_NOTES[key] } as Partial<Form>)}>Use the standard wording</button>
            )}
          </div>
        ))}
      </div>

      <div className="card stack">
        <h3>Financial summary: earlier years</h3>
        <p className="small muted" style={{ margin: 0 }}>
          The file holds {st.hasPrior ? 'two years' : 'one year'}. Enter the earlier years from the signed financial statements to complete the five-year summary. Enter liabilities and tax as positive figures.
        </p>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                {f.earlier.map((e, i) => (
                  <th key={i} style={{ width: 170 }}>
                    <input type="text" aria-label={`Earlier year ${i + 1}`} disabled={locked} value={e.year} onChange={(ev) => set({ earlier: f.earlier.map((x, j) => (j === i ? { ...x, year: ev.target.value } : x)) })} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YEAR_ROWS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {f.earlier.map((e, i) => (
                    <td key={i}>
                      <input type="text" inputMode="decimal" className="num" aria-label={`${label}, ${e.year}`} disabled={locked} value={e[key]} onChange={(ev) => set({ earlier: f.earlier.map((x, j) => (j === i ? { ...x, [key]: ev.target.value } : x)) })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ErrorNote error={error} />
      {saved && <div className="banner info">Saved.</div>}
      {!locked && (
        <div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                // The checklist is kept in the same record and is edited on its own step.
                await repo.updateEngagement(eng.id, { disclosures: { ...d, checklist: eng.disclosures.checklist, policies: eng.disclosures.policies } });
                setSaved(true);
                reload();
              })
            }
          >
            Save disclosures
          </button>
        </div>
      )}
    </div>
  );
}
