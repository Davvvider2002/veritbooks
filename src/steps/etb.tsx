import { useMemo, useState } from 'react';
import { currencyOf } from '../content/jurisdictions';
import { extendedTrialBalance, leadSchedules, LEADS, UNMAPPED_LEAD, type Etb, type LeadSchedule } from '../engine/etb';
import { etbWorkbook, pctText } from '../engine/etbSheets';
import { cur, fmt2 } from '../engine/money';
import { longDate } from '../engine/report';
import { downloadWorkbook, sendWorkbook } from '../excel';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

const amt = (v: number | null) => (v === null ? '' : v === 0 ? '–' : fmt2(v));

function useWorkbook(ctx: Ctx) {
  const { eng, client, ws, lines, adjustments, statements } = ctx;
  const etb = useMemo(() => extendedTrialBalance(lines, adjustments), [lines, adjustments]);
  const leads = useMemo(() => leadSchedules(etb, statements), [etb, statements]);
  const year = eng.yearEnd.slice(0, 4);
  const book = () =>
    etbWorkbook({
      client: client.name,
      firm: ws.firm.name,
      yearEnd: eng.yearEnd,
      yearEndText: longDate(eng.yearEnd),
      preparedBy: ws.me.fullName || 'The audit team',
      preparedOn: longDate(new Date().toISOString().slice(0, 10)),
      currency: currencyOf(eng.currency).name,
      etb,
      leads,
    });
  const name = `${client.name} ETB and lead schedules ${year}`;
  return { etb, leads, book, name };
}

/** Download the workbook, or send it to the client. */
function ExcelActions({ ctx, what }: { ctx: Ctx; what: string }) {
  const { book, name } = useWorkbook(ctx);
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const subject = `${ctx.client.name}: extended trial balance and lead schedules, year ended ${longDate(ctx.eng.yearEnd)}`;
  const body = `Dear Sir or Madam,\n\nPlease find attached the extended trial balance and lead schedules for ${ctx.client.name} for the year ended ${longDate(ctx.eng.yearEnd)}. They show your trial balance, the audit adjustments we have posted and the final balances in the financial statements.\n\nPlease review the adjustments and let us know if you have any questions.\n\nKind regards,\n${ctx.ws.me.fullName}\n${ctx.ws.firm.name}`;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => void run(async () => { setSent(null); await downloadWorkbook(book(), name); })}>
          Download Excel
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const how = await sendWorkbook(book(), name, subject, body);
              setSent(how === 'shared' ? 'Sent.' : how === 'email' ? 'The workbook was saved and an email to the client was opened. Attach the workbook to it before sending.' : null);
            })
          }
        >
          Send to the client
        </button>
      </div>
      <span className="small muted">
        One workbook holds the {what}: the ETB, a summary of the lead schedules, and a sheet for each one. Totals and final balances are formulas, and headings and account columns are frozen.
      </span>
      <ErrorNote error={error} />
      {sent && <div className="banner info">{sent}</div>}
    </div>
  );
}

function Balance({ etb }: { etb: Etb }) {
  if (etb.balanced) return <span className="tag ok">Draft and final balances total nil; adjustments balance</span>;
  return (
    <span className="tag bad">
      {etb.totals.draft !== 0 ? `The draft trial balance is out by ${fmt2(Math.abs(etb.totals.draft))}. ` : ''}
      {etb.totals.dr !== etb.totals.cr ? 'The adjustments do not balance. ' : ''}
      {etb.totals.final !== 0 ? `The final trial balance is out by ${fmt2(Math.abs(etb.totals.final))}.` : ''}
    </span>
  );
}

export function EtbStep(ctx: Ctx) {
  const { lines } = ctx;
  const { etb } = useWorkbook(ctx);
  const [lead, setLead] = useState('');
  const [onlyAdjusted, setOnlyAdjusted] = useState(false);
  const [q, setQ] = useState('');
  const withPrior = etb.totals.prior !== null;
  const rows = etb.rows.filter(
    (r) => (!lead || r.lead === lead) && (!onlyAdjusted || r.dr || r.cr) && (!q || `${r.code} ${r.name} ${r.line}`.toLowerCase().includes(q.toLowerCase())),
  );
  const filtered = rows.length !== etb.rows.length;
  const sum = (k: 'prior' | 'draft' | 'dr' | 'cr' | 'final') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const refs = [...LEADS, UNMAPPED_LEAD].filter((l) => etb.rows.some((r) => r.lead === l.ref));

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Extended trial balance</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );
  return (
    <div className="stack">
      <div>
        <h2>Extended trial balance</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Every account from the client’s draft trial balance to the final figure in the financial statements: last year’s final balance (this year’s opening balance for assets, liabilities and equity), the draft balance, the audit adjustments posted, and the final balance. Each account carries the lead schedule it belongs to. It updates as journals are posted and accounts mapped.
        </p>
      </div>
      <ExcelActions ctx={ctx} what="extended trial balance and lead schedules" />
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <Balance etb={etb} />
        {etb.unposted.length > 0 && <span className="tag warn">Not posted, so not in the final column: {etb.unposted.join(', ')}</span>}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <input type="search" aria-label="Find an account" placeholder="Find an account" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <select aria-label="Lead schedule" value={lead} onChange={(e) => setLead(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All lead schedules</option>
          {refs.map((l) => (
            <option key={l.ref} value={l.ref}>
              {l.ref} {l.title}
            </option>
          ))}
        </select>
        <label className="row small">
          <input type="checkbox" checked={onlyAdjusted} onChange={(e) => setOnlyAdjusted(e.target.checked)} />
          Only accounts with adjustments
        </label>
      </div>
      <div className="grid-view" style={{ ['--f1' as string]: '84px' }}>
        <table className="data" aria-label="Extended trial balance">
          <thead>
            <tr>
              <th className="freeze f1">Code</th>
              <th className="freeze f2 edge">Account</th>
              <th>Lead</th>
              <th>Statement line</th>
              {withPrior && <th className="num">Prior year final</th>}
              <th className="num">Draft TB</th>
              <th className="num">Adjustments Dr</th>
              <th className="num">Adjustments Cr</th>
              <th>Journals</th>
              <th className="num">Final TB</th>
              {withPrior && <th className="num">Movement</th>}
              {withPrior && <th className="num">Change</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lineId}>
                <td className="freeze f1">{r.code}</td>
                <td className="freeze f2 edge" style={{ minWidth: 200 }}>{r.name}</td>
                <td>{r.lead}</td>
                <td className={r.mapCode ? 'small' : 'small danger'}>{r.line}</td>
                {withPrior && <td className="num">{amt(r.prior)}</td>}
                <td className="num">{amt(r.draft)}</td>
                <td className="num">{r.dr ? fmt2(r.dr) : ''}</td>
                <td className="num">{r.cr ? fmt2(r.cr) : ''}</td>
                <td className="small">{r.refs.join(', ')}</td>
                <td className="num">
                  <strong>{amt(r.final)}</strong>
                </td>
                {withPrior && <td className="num">{amt(r.movement)}</td>}
                {withPrior && <td className="num small muted">{pctText(r.final, r.prior)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="freeze f1">{filtered ? 'Shown' : 'Total'}</td>
              <td className="freeze f2 edge">{filtered ? `${rows.length} of ${etb.rows.length} accounts` : `${etb.rows.length} accounts`}</td>
              <td />
              <td />
              {withPrior && <td className="num">{amt(sum('prior'))}</td>}
              <td className="num">{amt(sum('draft'))}</td>
              <td className="num">{amt(sum('dr'))}</td>
              <td className="num">{amt(sum('cr'))}</td>
              <td />
              <td className="num">{amt(sum('final'))}</td>
              {withPrior && <td className="num">{amt(sum('final') - sum('prior'))}</td>}
              {withPrior && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Amounts in {cur()}. Debit balances are positive; credit balances are in brackets. Adjustments are the journals posted in the Journals step.
      </p>
    </div>
  );
}

function LeadTable({ l, withPrior }: { l: LeadSchedule; withPrior: boolean }) {
  return (
    <div className="grid-view" style={{ ['--f1' as string]: '64px', maxHeight: 'none' }}>
      <table className="data" aria-label={`Lead schedule ${l.ref}`}>
        <thead>
          <tr>
            <th className="freeze f1">Ref</th>
            <th className="freeze f2 edge">Account</th>
            {withPrior && <th className="num">Prior year final</th>}
            <th className="num">Draft TB</th>
            <th className="num">Adjustments Dr</th>
            <th className="num">Adjustments Cr</th>
            <th>Journals</th>
            <th className="num">Final TB</th>
            {withPrior && <th className="num">Movement</th>}
            {withPrior && <th className="num">Change</th>}
          </tr>
        </thead>
        <tbody>
          {l.lines.map((line, li) => (
            <LeadLineRows key={line.code} l={l} line={line} n={li + 1} withPrior={withPrior} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="freeze f1">{l.ref}</td>
            <td className="freeze f2 edge">Total lead schedule {l.ref}</td>
            {withPrior && <td className="num">{amt(l.prior)}</td>}
            <td className="num">{amt(l.draft)}</td>
            <td className="num">{amt(l.dr)}</td>
            <td className="num">{amt(l.cr)}</td>
            <td />
            <td className="num">{amt(l.final)}</td>
            {withPrior && <td className="num">{amt(l.final - (l.prior ?? 0))}</td>}
            {withPrior && <td className="num small">{pctText(l.final, l.prior)}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LeadLineRows({ l, line, n, withPrior }: { l: LeadSchedule; line: LeadSchedule['lines'][number]; n: number; withPrior: boolean }) {
  const span = withPrior ? 10 : 7;
  const agrees = line.final === line.fsFinal && (line.fsPrior === null || line.prior === line.fsPrior);
  return (
    <>
      <tr className="group">
        <td className="freeze f1">
          {l.ref}
          {n}
        </td>
        <td className="freeze f2 edge">
          {line.label}
          {line.note ? <span className="small muted"> · note {line.note}</span> : null}
        </td>
        <td colSpan={span - 2} />
      </tr>
      {line.rows.map((r, i) => (
        <tr key={r.lineId}>
          <td className="freeze f1 small muted">
            {l.ref}
            {n}.{i + 1}
          </td>
          <td className="freeze f2 edge" style={{ minWidth: 220 }}>
            <span className="muted">{r.code}</span> {r.name}
          </td>
          {withPrior && <td className="num">{amt(r.prior)}</td>}
          <td className="num">{amt(r.draft)}</td>
          <td className="num">{r.dr ? fmt2(r.dr) : ''}</td>
          <td className="num">{r.cr ? fmt2(r.cr) : ''}</td>
          <td className="small">{r.refs.join(', ')}</td>
          <td className="num">{amt(r.final)}</td>
          {withPrior && <td className="num">{amt(r.movement)}</td>}
          {withPrior && <td className="num small muted">{pctText(r.final, r.prior)}</td>}
        </tr>
      ))}
      <tr className="sub">
        <td className="freeze f1" />
        <td className="freeze f2 edge">Total {line.label.toLowerCase()}</td>
        {withPrior && <td className="num">{amt(line.prior)}</td>}
        <td className="num">{amt(line.draft)}</td>
        <td className="num">{line.dr ? fmt2(line.dr) : ''}</td>
        <td className="num">{line.cr ? fmt2(line.cr) : ''}</td>
        <td />
        <td className="num">{amt(line.final)}</td>
        {withPrior && <td className="num">{amt(line.final - (line.prior ?? 0))}</td>}
        {withPrior && <td className="num small">{pctText(line.final, line.prior)}</td>}
      </tr>
      {line.code !== 'unmapped' && (
        <tr className="tie">
          <td className="freeze f1" />
          <td className="freeze f2 edge">
            Per financial statements{line.note ? `, note ${line.note}` : ''} {agrees ? <span className="tag ok">Agrees</span> : <span className="tag bad">Differs</span>}
          </td>
          {withPrior && <td className="num">{amt(line.fsPrior)}</td>}
          <td />
          <td />
          <td />
          <td />
          <td className="num">{amt(line.fsFinal)}</td>
          {withPrior && <td />}
          {withPrior && <td />}
        </tr>
      )}
    </>
  );
}

export function LeadsStep(ctx: Ctx) {
  const { lines } = ctx;
  const { etb, leads } = useWorkbook(ctx);
  const [shown, setShown] = useState<string>('');
  const withPrior = etb.totals.prior !== null;
  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Lead schedules</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );
  const selected = shown ? leads.filter((l) => l.ref === shown) : leads;
  return (
    <div className="stack">
      <div>
        <h2>Lead schedules</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          A schedule for each area of the financial statements, under its working paper reference: the accounts behind each statement line, from last year’s final balance through the draft and the adjustments to the final balance, subtotalled by line and agreed to the statements. Revenue, trade receivables, trade payables, reserves and share capital each have their own.
        </p>
      </div>
      <ExcelActions ctx={ctx} what="lead schedules and the extended trial balance" />
      <div className="grid-view" style={{ ['--f1' as string]: '56px', maxHeight: 420 }}>
        <table className="data" aria-label="Lead schedules summary">
          <thead>
            <tr>
              <th className="freeze f1">Lead</th>
              <th className="freeze f2 edge">Area of the financial statements</th>
              {withPrior && <th className="num">Prior year final</th>}
              <th className="num">Draft TB</th>
              <th className="num">Adjustments</th>
              <th className="num">Final TB</th>
              {withPrior && <th className="num">Change</th>}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.ref} className="clickable" onClick={() => setShown(l.ref)}>
                <td className="freeze f1">
                  <strong>{l.ref}</strong>
                </td>
                <td className={`freeze f2 edge${l.ref === UNMAPPED_LEAD.ref ? ' danger' : ''}`}>
                  <button className="link" onClick={() => setShown(l.ref)}>
                    {l.title}
                  </button>
                </td>
                {withPrior && <td className="num">{amt(l.prior)}</td>}
                <td className="num">{amt(l.draft)}</td>
                <td className="num">{amt(l.dr - l.cr)}</td>
                <td className="num">{amt(l.final)}</td>
                {withPrior && <td className="num small muted">{pctText(l.final, l.prior)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chips" role="group" aria-label="Show lead schedule">
        <button className={shown === '' ? 'on' : ''} onClick={() => setShown('')}>
          All
        </button>
        {leads.map((l) => (
          <button key={l.ref} className={shown === l.ref ? 'on' : ''} onClick={() => setShown(l.ref)} title={l.title}>
            {l.ref}
          </button>
        ))}
      </div>
      {selected.map((l) => (
        <div key={l.ref} className="card stack">
          <div className="between">
            <h3 style={{ margin: 0 }}>
              {l.ref} · {l.title}
            </h3>
            <span className="small muted">W/P ref {l.ref}</span>
          </div>
          <LeadTable l={l} withPrior={withPrior} />
        </div>
      ))}
      <p className="small muted" style={{ margin: 0 }}>
        Amounts in {cur()}. Debit balances are positive; credit balances are in brackets. The Excel copy adds columns for tick marks and working paper references, and lines for the preparer and reviewer.
      </p>
    </div>
  );
}
