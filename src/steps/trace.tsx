import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import { opensAtPage, type Evidence } from '../data/repo';
import { priorAgreement } from '../engine/ledger';
import { fmt2 } from '../engine/money';
import type { Part, Period } from '../engine/statements';
import { traceItem, type TraceAccount } from '../engine/trace';
import { canOpen, ErrorNote, useAction, type Opened } from '../ui';
import type { Ctx } from '../workspace';

const PAGE = 100;

/** The name of a file, with the page it points at. */
export const fileLabel = (f: Evidence) => (f.page ? `${f.fileName}, page ${f.page}` : f.fileName);

/**
 * Where a figure on the statements comes from. A figure made of other figures opens to them,
 * and so on down to the accounts, audit journals, the client's ledger and the files on record.
 */
export function TracePanel({ ctx, opened, onClose }: { ctx: Ctx; opened: Opened; onClose: () => void }) {
  const [stack, setStack] = useState<Opened[]>([opened]);
  const { error, run } = useAction();
  const node = stack[stack.length - 1];

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const period: Period = node.source.period ?? node.period;
  const year = Number(ctx.eng.yearEnd.slice(0, 4)) - (period === 'prior' ? 1 : 0);
  const showFile = (f: Evidence) => void run(async () => void window.open(await repo.evidenceUrl(f), '_blank', 'noopener'));

  return (
    <div className="overlay no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer stack" role="dialog" aria-modal="true" aria-label={`Source of ${node.label}`}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="small muted">Where this figure comes from · {year}</div>
            <h2 style={{ marginTop: 2 }}>{node.label}</h2>
            {stack.length > 1 && (
              <div className="small crumbs">
                {stack.slice(0, -1).map((s, i) => (
                  <span key={i}>
                    <button className="link" onClick={() => setStack(stack.slice(0, i + 1))}>{s.label}</button> ›{' '}
                  </span>
                ))}
                {node.label}
              </div>
            )}
          </div>
          <div className="row">
            {stack.length > 1 && <button onClick={() => setStack(stack.slice(0, -1))}>Back</button>}
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <ErrorNote error={error} />
        {node.source.code ? (
          <AccountsView key={stack.length} ctx={ctx} node={node} period={period} year={year} showFile={showFile} />
        ) : (
          <PartsView node={node} open={(x) => setStack([...stack, { label: x.label, period: node.period, source: x }])} />
        )}
      </div>
    </div>
  );
}

/** A figure that is the sum of other figures. */
function PartsView({ node, open }: { node: Opened; open: (x: Part) => void }) {
  const amount = (x: Part) => (node.period === 'current' ? x.cur : (x.prior ?? 0));
  const parts = (node.source.parts ?? []).filter((x) => amount(x) !== 0);
  return (
    <>
      <div className="scroll-x">
        <table className="data trace">
          <thead>
            <tr>
              <th>Made up of</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((x, i) => (
              <tr key={i} className={canOpen(x) ? 'clickable' : ''} onClick={() => canOpen(x) && open(x)}>
                <td>{canOpen(x) ? <button className="link" onClick={(e) => (e.stopPropagation(), open(x))}>{x.label}</button> : x.label}</td>
                <td className="num">{fmt2(amount(x))}</td>
              </tr>
            ))}
            <tr className="sum">
              <td>{node.label}</td>
              <td className="num">{fmt2(parts.reduce((a, x) => a + amount(x), 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Each amount carries the sign it has in the sum, so a deduction shows as a negative. Select a line to open it. The figure is computed from these lines each time, so it always equals their total.
      </p>
    </>
  );
}

/** A figure that is the sum of accounts on one line of the statements. */
function AccountsView({ ctx, node, period, year, showFile }: { ctx: Ctx; node: Opened; period: Period; year: number; showFile: (f: Evidence) => void }) {
  const { eng, lines, adjustments, ledger, priorLedger, ledgerTest, recons, evidence } = ctx;
  const src = node.source;
  const book = period === 'current' ? ledger : priorLedger;
  const trace = useMemo(() => traceItem(src.code!, period, lines, adjustments, book, src), [src, period, lines, adjustments, book]);
  const lastYear = useMemo(() => (period === 'prior' ? priorAgreement(priorLedger, lines) : []), [period, priorLedger, lines]);
  const [open, setOpen] = useState<string | null>(() => (trace && trace.accounts.length === 1 ? trace.accounts[0].line.id : null));
  if (!trace) return null;
  const base = `/engagements/${eng.id}`;
  const risky = new Set((ledgerTest?.highRisk ?? []).map((j) => j.entryNo));

  const Files = ({ files }: { files: Evidence[] }) => (
    <>
      {files.map((f) => (
        <button key={f.id} className="link small" style={{ marginLeft: 8 }} title={opensAtPage(f) ? `Opens at page ${f.page}` : undefined} onClick={() => showFile(f)}>
          {fileLabel(f)}
        </button>
      ))}
    </>
  );

  const detail = (a: TraceAccount): ReactNode => {
    const agree = (period === 'current' ? ledgerTest?.agreement : lastYear)?.find((g) => g.code === a.line.code);
    return (
      <AccountDetail
        account={a}
        period={period}
        year={year}
        hasLedger={book.length > 0}
        agreement={agree ? agree.difference : period === 'prior' && book.length ? null : undefined}
        base={base}
        locked={ctx.locked}
        accountFiles={evidence.filter((e) => e.refType === 'account' && e.refId === a.line.code)}
        banks={
          period === 'current'
            ? recons
                .filter((r) => r.account.accountCode === a.line.code)
                .map((b) => ({
                  id: b.account.id,
                  name: b.account.name,
                  closing: b.account.closing,
                  clean: !!b.result && b.result.difference === 0,
                  files: evidence.filter((e) => e.refType === 'bank' && e.refId === b.account.id),
                }))
            : []
        }
        journalFiles={(id) => evidence.filter((e) => e.refType === 'adjustment' && e.refId === id)}
        entryFiles={(no) => (period === 'current' ? evidence.filter((e) => e.refType === 'journal' && e.refId === no) : [])}
        tested={(no) => (period === 'current' && risky.has(no) ? (eng.testing.journals?.[no]?.status ?? 'open') : null)}
        Files={Files}
      />
    );
  };

  return (
    <>
      {trace.accounts.length === 0 && trace.derived.length === 0 ? (
        <div className="banner info">No account is mapped to this line for {year}.</div>
      ) : (
        <div className="scroll-x">
          <table className="data trace">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Trial balance</th>
                <th className="num">Audit journals</th>
                <th className="num">In the statements</th>
              </tr>
            </thead>
            <tbody>
              {trace.accounts.map((a) => (
                <AccountRow key={a.line.id} a={a} open={open === a.line.id} toggle={() => setOpen(open === a.line.id ? null : a.line.id)} detail={detail} />
              ))}
              {trace.derived.length > 0 && (
                <tr className="sum">
                  <td>Accounts brought forward</td>
                  <td></td>
                  <td></td>
                  <td className="num">{fmt2(trace.subtotal)}</td>
                </tr>
              )}
              {trace.derived.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td></td>
                  <td></td>
                  <td className="num">{fmt2(d.amount)}</td>
                </tr>
              ))}
              <tr className="sum">
                <td>{src.lineId || src.nature || src.accountsOnly ? 'Total' : `${trace.label}, as reported`}</td>
                <td></td>
                <td></td>
                <td className="num">{fmt2(trace.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        {src.nature && `Only the accounts marked as ${src.nature === 'staff' ? 'staff costs' : 'depreciation'} on this line are shown. `}
        Select an account to see what is behind it. Amounts here carry the sign of the statement line, whatever sign they had in the sum you came from. The figure is computed from these accounts each time, so it always equals their total.{' '}
        <Link to={`${base}/mapping`}>Change the mapping</Link>
      </p>
    </>
  );
}

function AccountRow({ a, open, toggle, detail }: { a: TraceAccount; open: boolean; toggle: () => void; detail: (a: TraceAccount) => ReactNode }) {
  const j = a.journals.reduce((s, x) => s + x.amount, 0);
  return (
    <>
      <tr className="clickable" onClick={toggle}>
        <td>
          <button className="link" aria-expanded={open} onClick={(e) => (e.stopPropagation(), toggle())}>
            {a.line.code} {a.line.name}
          </button>
        </td>
        <td className="num">{fmt2(a.tb)}</td>
        <td className="num">{a.journals.length ? fmt2(j) : ''}</td>
        <td className="num">{fmt2(a.reported)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} className="trace-detail">
            {detail(a)}
          </td>
        </tr>
      )}
    </>
  );
}

function AccountDetail(p: {
  account: TraceAccount;
  period: Period;
  year: number;
  hasLedger: boolean;
  /** Ledger less trial balance. Null when it cannot be compared, undefined when there is nothing to compare. */
  agreement: number | null | undefined;
  base: string;
  locked: boolean;
  accountFiles: Evidence[];
  banks: { id: string; name: string; closing: number; clean: boolean; files: Evidence[] }[];
  journalFiles: (id: string) => Evidence[];
  entryFiles: (entryNo: string) => Evidence[];
  tested: (entryNo: string) => 'clear' | 'exception' | 'open' | null;
  Files: (x: { files: Evidence[] }) => ReactNode;
}) {
  const { account: a, Files } = p;
  const [shown, setShown] = useState(PAGE);
  const [largest, setLargest] = useState(false);
  const entries = useMemo(
    () => (largest ? [...a.entries].sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount)) : a.entries),
    [a.entries, largest],
  );
  const net = a.entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <strong className="small">Files for this account</strong>
        {p.accountFiles.length === 0 ? (
          <span className="small muted"> None attached.</span>
        ) : (
          <Files files={p.accountFiles} />
        )}
        {!p.locked && (
          <Link className="small" style={{ marginLeft: 10 }} to={`${p.base}/evidence?for=${encodeURIComponent(`account:${a.line.code}`)}`}>
            Attach a file
          </Link>
        )}
      </div>
      {a.journals.length > 0 && (
        <div>
          <strong className="small">Audit journals</strong>
          <ul className="small files">
            {a.journals.map((j, i) => (
              <li key={i}>
                <Link to={`${p.base}/journals`}>{j.ref}</Link> {j.description}: {fmt2(j.amount)}
                <Files files={p.journalFiles(j.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.banks.length > 0 && (
        <div>
          <strong className="small">Bank statements</strong>
          <ul className="small files">
            {p.banks.map((b) => (
              <li key={b.id}>
                <Link to={`${p.base}/bank`}>{b.name}</Link>: {fmt2(b.closing)} per statement at the year end.{' '}
                <span className={`tag ${b.clean ? 'ok' : 'warn'}`}>{b.clean ? 'Reconciles to the ledger' : 'Not reconciled'}</span>
                <Files files={b.files} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {!p.hasLedger ? (
        <div className="small muted">
          {p.period === 'current'
            ? 'No general ledger has been imported, so the trail stops at the trial balance. '
            : `The ${p.year} ledger has not been imported, so last year’s trail stops at the prior year trial balance. `}
          <Link to={`${p.base}/ledger`}>Import {p.period === 'current' ? 'the ledger' : `the ${p.year} ledger`}</Link>
        </div>
      ) : a.entries.length === 0 ? (
        <div className="small muted">The {p.year} ledger has no entries on this account.</div>
      ) : (
        <div>
          <div className="between">
            <strong className="small">
              Client’s ledger, {p.year}: {a.entries.length.toLocaleString('en-GB')} entr{a.entries.length === 1 ? 'y' : 'ies'}, net {net < 0 ? 'credit' : 'debit'} {fmt2(Math.abs(net))}
            </strong>
            <label className="small row" style={{ gap: 6 }}>
              <input type="checkbox" checked={largest} onChange={(e) => setLargest(e.target.checked)} /> Largest first
            </label>
          </div>
          {p.agreement !== undefined && (
            <div className="small" style={{ margin: '4px 0 6px' }}>
              {p.agreement === null ? (
                <span className="muted">
                  {p.period === 'current'
                    ? 'Not compared to the trial balance: there is no opening balance for this account.'
                    : 'Not compared to last year’s trial balance: the opening balance of a balance sheet account is not held.'}
                </span>
              ) : p.agreement === 0 ? (
                <span className="tag ok">The ledger agrees to the trial balance</span>
              ) : (
                <span className="tag bad">The ledger differs from the trial balance by {fmt2(Math.abs(p.agreement))}</span>
              )}
            </div>
          )}
          <div className="scroll-x">
            <table className="data ledger">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Journal</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, shown).map((e, i) => {
                  const t = p.tested(e.entryNo);
                  return (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{e.date.split('-').reverse().join('/')}</td>
                      <td>{e.entryNo}</td>
                      <td>
                        {e.description}
                        {t && (
                          <Link to={`${p.base}/ledger`} className={`tag ${t === 'clear' ? 'ok' : t === 'exception' ? 'bad' : 'warn'}`} style={{ marginLeft: 8 }}>
                            {t === 'clear' ? 'Tested, no exception' : t === 'exception' ? 'Tested, exception' : 'High risk, not tested'}
                          </Link>
                        )}
                        <Files files={p.entryFiles(e.entryNo)} />
                      </td>
                      <td className="num">{e.amount > 0 ? fmt2(e.amount) : ''}</td>
                      <td className="num">{e.amount < 0 ? fmt2(-e.amount) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {entries.length > shown && (
            <button style={{ marginTop: 8 }} onClick={() => setShown(shown + PAGE)}>
              Show {Math.min(PAGE, entries.length - shown)} more of {(entries.length - shown).toLocaleString('en-GB')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
