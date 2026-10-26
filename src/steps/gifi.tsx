import { useMemo, useState } from 'react';
import { repo } from '../data';
import { GIFI_CODES, gifiCsv, gifiDescription, gifiSchedules, suggestGifi } from '../engine/gifi';
import { adjustedBalances } from '../engine/statements';
import { policiesFor, policyApplies } from '../content/notes';
import { aspeBasis } from '../content/aspe';
import { basisNote, statuteOf } from '../content/canada';
import { currencyOf } from '../content/jurisdictions';
import { fmt, cur } from '../engine/money';
import { longDate } from '../engine/report';
import { ITEM } from '../engine/chart';
import type { TbLine } from '../engine/types';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

function download(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The notes as plain text, as the CRA takes them with an electronic T2: no tables, no graphs. */
function notesText(ctx: Ctx): string {
  const { eng, client, statements: st, gaap } = ctx;
  const r = eng.report;
  const npo = gaap === 'asnpo';
  const out: string[] = [`${client.name}`, `Notes to the financial statements for the year ended ${longDate(eng.yearEnd)}`, ''];
  const statute = statuteOf(eng.planning.statute);
  const special = eng.type === 'compilation' && (r.compilationBasis ?? 'cash-accruals') !== 'aspe';
  const nature = `${client.name} ${npo ? `is a not-for-profit organization${statute?.name ? ` incorporated under ${statute.name}` : ''}` : `is incorporated under ${statute?.name || '[statute]'}`}. ${r.principalActivity ? `Its principal activity is ${r.principalActivity}.` : ''}`;
  if (special) {
    out.push('1. Basis of accounting', basisNote(r.compilationBasis, client.name, r.basisAccruals ?? '', r.basisOther ?? '', npo), '', '2. Nature of operations', nature, '');
  } else {
    out.push('1. Nature of operations', nature, '', '2. Significant accounting policies', ...aspeBasis({ npo, currency: currencyOf(eng.currency).name }));
    for (const [code, p] of Object.entries(policiesFor(gaap, eng.planning))) if (policyApplies(code, st)) out.push(`${p.title}. ${eng.disclosures.policies?.[code]?.text || p.text}`);
    out.push('');
  }
  const money = (v: number | null) => (v === null ? '' : (v / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  for (const n of st.noteBreakdowns) {
    out.push(`${n.number}. ${n.title}`);
    for (const row of n.rows) out.push(`${row.name}: ${money(row.cur)}${row.prior !== null ? ` (prior year ${money(row.prior)})` : ''}`);
    out.push(`Total: ${money(n.cur)}${n.prior !== null ? ` (prior year ${money(n.prior)})` : ''}`, '');
  }
  return out.join('\n');
}

export function GifiStep(ctx: Ctx) {
  const { eng, lines, adjustments, statements, locked, reload } = ctx;
  const result = useMemo(() => gifiSchedules(lines, adjustments, statements), [lines, adjustments, statements]);
  const { busy, error, run } = useAction();
  const [onlyUncoded, setOnlyUncoded] = useState(false);
  const bal = useMemo(() => adjustedBalances(lines, adjustments, 'current'), [lines, adjustments]);
  const year = eng.yearEnd.slice(0, 4);
  const priorYear = statements.hasPrior ? String(Number(year) - 1) : null;
  const suggestions = result.uncoded.map((l) => ({ lineId: l.id, gifi: suggestGifi(l) })).filter((x): x is { lineId: string; gifi: string } => !!x.gifi);
  const set = (l: TbLine, code: string) => {
    const v = code.trim();
    if (v === (l.gifi ?? '')) return;
    if (v && !/^\d{4}$/.test(v)) return;
    void run(async () => {
      await repo.setGifi(eng.id, [{ lineId: l.id, gifi: v || null }]);
      reload();
    });
  };
  const shown = lines.filter((l) => !onlyUncoded || !l.gifi);
  // Schedule 141: who prepared the statements and how far they were involved.
  const involvement = { audit: 'Audit: the accountant expressed an audit opinion', review: 'Review engagement: the accountant expressed a review conclusion', compilation: 'Compilation engagement (CSRS 4200)' }[eng.type];
  const reservation = eng.type !== 'compilation' && ((eng.report.opinion ?? 'unmodified') !== 'unmodified' || !!eng.report.emphasis?.trim() || !!eng.report.goingConcern?.trim());

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>GIFI and T2 schedules</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  return (
    <div className="stack">
      <div>
        <h2>GIFI and T2 schedules</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          A corporation files its balance sheet and income statement with the T2 return as GIFI codes (Schedules 100 and 125), with the notes as plain text and Schedule 141 on the accountant’s involvement. Give each account a code here. VeritBooks works out the totals the CRA requires, checks them against the statements, and exports them for your tax software.
        </p>
      </div>

      {result.uncoded.length > 0 ? (
        <div className="banner warn">
          {result.uncoded.length} account(s) with a balance have no GIFI code.{' '}
          {suggestions.length > 0 && !locked && (
            <button className="link" disabled={busy} onClick={() => void run(async () => { await repo.setGifi(eng.id, suggestions); reload(); })}>
              Apply the suggested code to {suggestions.length} account(s)
            </button>
          )}
        </div>
      ) : (
        <div className="banner info">Every account with a balance has a GIFI code.</div>
      )}
      {result.disagreements.length > 0 && result.uncoded.length === 0 && (
        <div className="banner bad" aria-label="GIFI totals that differ">
          The GIFI totals differ from the statements:{' '}
          {result.disagreements.map((d) => `${d.label} (${d.code}) ${fmt(d.gifi)} against ${fmt(d.statements)}`).join('; ')}. A bank overdraft coded 2600 moves from cash to liabilities, which is expected. Otherwise, check the codes.
        </div>
      )}
      <ErrorNote error={error} />

      <div className="card stack" aria-label="Accounts and their GIFI codes">
        <div className="between">
          <h3 style={{ margin: 0 }}>Accounts</h3>
          <label className="row small">
            <input type="checkbox" checked={onlyUncoded} onChange={(e) => setOnlyUncoded(e.target.checked)} /> Only accounts without a code
          </label>
        </div>
        <datalist id="gifi-codes">
          {GIFI_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.description}</option>
          ))}
        </datalist>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Statement line</th>
                <th className="num">Balance<br />{cur()}</th>
                <th>GIFI</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const suggested = !l.gifi ? suggestGifi(l) : null;
                return (
                  <tr key={l.id}>
                    <td>{l.code}</td>
                    <td>{l.name}</td>
                    <td className="small">{l.mapCode ? ITEM.get(l.mapCode)?.label : '–'}</td>
                    <td className="num">{fmt(bal.get(l.id) ?? 0)}</td>
                    <td>
                      <input
                        type="text"
                        inputMode="numeric"
                        list="gifi-codes"
                        aria-label={`GIFI code for ${l.code} ${l.name}`}
                        disabled={locked || busy}
                        defaultValue={l.gifi ?? ''}
                        placeholder={suggested ?? ''}
                        maxLength={4}
                        style={{ width: 80 }}
                        onBlur={(e) => set(l, e.target.value)}
                      />
                    </td>
                    <td className="small">{l.gifi ? gifiDescription(l.gifi) || <span className="muted">Not in the common list. Check it in the GIFI guide.</span> : suggested ? <span className="muted">Suggested: {gifiDescription(suggested)}</span> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack" aria-label="GIFI schedules">
        <div className="between">
          <h3 style={{ margin: 0 }}>Schedules 100 and 125</h3>
          <div className="row">
            <button disabled={result.uncoded.length > 0} onClick={() => download(`GIFI ${ctx.client.name} ${year}.csv`, gifiCsv(result, year, priorYear))}>
              Download GIFI (CSV)
            </button>
            <button onClick={() => download(`Notes ${ctx.client.name} ${year}.txt`, notesText(ctx), 'text/plain;charset=utf-8')}>Download notes as plain text</button>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Assets are shown as debits, so accumulated amortization and allowances are negative. Liabilities, equity and revenue are positive. Confirm the import layout your tax software expects before the first filing.
        </p>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>GIFI</th>
                <th>Description</th>
                <th className="num">{year}<br />{cur()}</th>
                {priorYear && <th className="num">{priorYear}<br />{cur()}</th>}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.code} className={r.total ? 'subtotal' : ''}>
                  <td>{r.code}</td>
                  <td>{r.total ? <strong>{r.description}</strong> : r.description}</td>
                  <td className="num">{fmt(r.cur)}</td>
                  {priorYear && <td className="num">{r.prior === null ? '' : fmt(r.prior)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack" aria-label="Schedule 141">
        <h3 style={{ margin: 0 }}>Schedule 141: notes checklist</h3>
        <p className="small muted" style={{ margin: 0 }}>The answers this file supports. Enter them in the T2 as your tax software asks.</p>
        <ul className="small" style={{ margin: 0 }}>
          <li>The person primarily involved with the financial statements is identified, and holds a professional accounting designation: {ctx.ws.firm.name}, {ctx.jur.code === 'CA' ? 'CPA' : ''}.</li>
          <li>Whether that person is connected with the corporation: confirm in the T2. VeritBooks does not record it.</li>
          <li>Type of involvement: {involvement}.</li>
          {eng.type !== 'compilation' && <li>A reservation was expressed: {reservation ? 'yes. The report is modified or carries an added paragraph.' : 'no.'}</li>}
          <li>Notes to the financial statements are prepared: yes. Send them as plain text with the electronic return.</li>
          <li>Attach the {eng.type === 'compilation' ? 'compilation engagement report' : eng.type === 'review' ? 'review engagement report' : 'auditor’s report'} with Schedule 141.</li>
        </ul>
      </div>
    </div>
  );
}
