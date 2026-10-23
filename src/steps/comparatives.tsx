import { useMemo, useState } from 'react';
import { currencyOf } from '../content/jurisdictions';
import { multiYearWorkbook } from '../engine/etbSheets';
import { cur, fmt2 } from '../engine/money';
import { multiYear, type MultiRow } from '../engine/multiYear';
import { longDate } from '../engine/report';
import { yearsHeld } from '../engine/yearsOf';
import { downloadWorkbook } from '../excel';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

function YearsTable({ label, years, rows }: { label: string; years: number[]; rows: MultiRow[] }) {
  return (
    <div className="grid-view" style={{ maxHeight: 'none' }}>
      <table className="data" aria-label={label}>
        <thead>
          <tr>
            <th className="freeze edge" style={{ minWidth: 280 }} />
            {years.map((y) => (
              <th key={y} className="num">
                {y}
                <div className="small muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{cur()}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.style === 'heading' ? 'group' : r.style === 'subtotal' || r.style === 'total' ? 'sub' : undefined}>
              <td className="freeze edge" style={{ paddingLeft: r.style === 'line' ? 20 : undefined }}>{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className="num">
                  {r.style === 'heading' || v === null ? '' : v === 0 ? '–' : fmt2(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The financial position, results and cash flows over several years: the current year with two
 * comparative years by default, or every year held, up to five. A cash flow needs the year before
 * it, so four years give three years of cash flows.
 */
export function ComparativesStep(ctx: Ctx) {
  const { eng, client, ws, lines, adjustments } = ctx;
  const held = yearsHeld(lines);
  const [span, setSpan] = useState(3);
  const shown = Math.min(span, held);
  const npo = eng.planning.entity === 'npo';
  const m = useMemo(() => multiYear(lines, adjustments, eng.yearEnd, shown, npo), [lines, adjustments, eng.yearEnd, shown, npo]);
  const { busy, error, run } = useAction();
  const year = Number(eng.yearEnd.slice(0, 4));

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Comparatives over several years</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );
  return (
    <div className="stack">
      <div>
        <h2>Comparatives over several years</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          The statement of financial position and the income statement for {year} with up to four earlier years, and a cash flow for each year that has the year before it. {year} includes the journals posted; earlier years are as imported. The financial statements themselves show {year} and {year - 1}, with the cash flow for both when {year - 2} is held.
        </p>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="tag">{held} year{held === 1 ? '' : 's'} imported ({year - held + 1} to {year})</span>
        <label className="row small">
          Years shown
          <select aria-label="Years shown" value={span} onChange={(e) => setSpan(Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={2}>{year} and one comparative year</option>
            <option value={3}>{year} and two comparative years</option>
            <option value={5}>Every year imported, up to five</option>
          </select>
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(() =>
              downloadWorkbook(
                multiYearWorkbook(
                  { client: client.name, yearEndText: longDate(eng.yearEnd), currency: currencyOf(eng.currency).name, preparedBy: ws.me.fullName || 'The audit team', preparedOn: longDate(new Date().toISOString().slice(0, 10)) },
                  m,
                ),
                `${client.name} comparatives ${m.years.at(-1)} to ${year}`,
              ),
            )
          }
        >
          Download Excel
        </button>
      </div>
      <ErrorNote error={error} />
      {held < 4 && (
        <div className="banner info">
          {held < 2
            ? `Import ${year - 1} to see comparatives and a cash flow.`
            : `Three years of cash flows need four years of balances. Import ${Array.from({ length: 4 - held }, (_, i) => year - held - i).join(' and ')} on the Trial balance step to complete them.`}
        </div>
      )}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Statement of financial position</h3>
        <YearsTable label="Statement of financial position over several years" years={m.years} rows={m.position} />
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>{npo ? 'Statement of income and expenditure' : 'Statement of profit or loss'}</h3>
        <YearsTable label={npo ? 'Statement of income and expenditure over several years' : 'Statement of profit or loss over several years'} years={m.years} rows={m.income} />
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Statement of cash flows</h3>
        {m.cashFlowYears.length ? (
          <YearsTable label="Statement of cash flows over several years" years={m.cashFlowYears} rows={m.cashFlow} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>A cash flow needs the year before it. Import {year - 1}.</p>
        )}
      </div>
    </div>
  );
}
