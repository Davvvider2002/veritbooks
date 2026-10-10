import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import type { Evidence } from '../data/repo';
import { fmt2 } from '../engine/money';
import type { Period } from '../engine/statements';
import { traceItem, type TraceAccount } from '../engine/trace';
import { ErrorNote, useAction } from '../ui';
import type { Ctx } from '../workspace';

const PAGE = 100;

/** Where one figure on the statements comes from: accounts, audit journals, the client's ledger and the files on record. */
export function TracePanel({ ctx, code, period, onClose }: { ctx: Ctx; code: string; period: Period; onClose: () => void }) {
  const { eng, lines, adjustments, ledger, ledgerTest, recons, evidence } = ctx;
  const trace = useMemo(() => traceItem(code, period, lines, adjustments, ledger), [code, period, lines, adjustments, ledger]);
  const [open, setOpen] = useState<string | null>(null);
  const { error, run } = useAction();

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  if (!trace) return null;
  const year = Number(eng.yearEnd.slice(0, 4)) - (period === 'prior' ? 1 : 0);
  const base = `/engagements/${eng.id}`;
  const showFile = (f: Evidence) => void run(async () => void window.open(await repo.evidenceUrl(f), '_blank', 'noopener'));
  const Files = ({ files }: { files: Evidence[] }) =>
    files.length === 0 ? null : (
      <>
        {files.map((f) => (
          <button key={f.id} className="link small" style={{ marginLeft: 8 }} onClick={() => showFile(f)}>
            {f.fileName}
          </button>
        ))}
      </>
    );

  const detail = (a: TraceAccount) => {
    const agree = ledgerTest?.agreement.find((g) => g.code === a.line.code);
    const banks = recons.filter((r) => r.account.accountCode === a.line.code);
    const risky = new Map((ledgerTest?.highRisk ?? []).map((j) => [j.entryNo, j]));
    return (
      <AccountDetail
        key={a.line.id}
        account={a}
        current={period === 'current'}
        hasLedger={ledger.length > 0}
        agreement={agree ? agree.difference : undefined}
        base={base}
        banks={banks.map((b) => ({
          id: b.account.id,
          name: b.account.name,
          closing: b.account.closing,
          clean: !!b.result && b.result.difference === 0,
          files: evidence.filter((e) => e.refType === 'bank' && e.refId === b.account.id),
        }))}
        journalFiles={(id) => evidence.filter((e) => e.refType === 'adjustment' && e.refId === id)}
        entryFiles={(no) => evidence.filter((e) => e.refType === 'journal' && e.refId === no)}
        tested={(no) => (risky.has(no) ? (eng.testing.journals?.[no]?.status ?? 'open') : null)}
        Files={Files}
      />
    );
  };

  return (
    <div className="overlay no-print" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer stack" role="dialog" aria-modal="true" aria-label={`Source of ${trace.label}`}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="small muted">Where this figure comes from · {year}</div>
            <h2 style={{ marginTop: 2 }}>{trace.label}</h2>
          </div>
          <button onClick={onClose}>Close</button>
        </div>
        <ErrorNote error={error} />
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
                  <FragmentRow key={a.line.id} a={a} open={open === a.line.id} toggle={() => setOpen(open === a.line.id ? null : a.line.id)} detail={detail} />
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
                  <td>{trace.label}, as reported</td>
                  <td></td>
                  <td></td>
                  <td className="num">{fmt2(trace.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          Select an account to see what is behind it. Amounts carry the sign the statement uses. The figure is computed from these accounts each time, so it always equals their total.{' '}
          <Link to={`${base}/mapping`}>Change the mapping</Link>
        </p>
      </div>
    </div>
  );
}

function FragmentRow({ a, open, toggle, detail }: { a: TraceAccount; open: boolean; toggle: () => void; detail: (a: TraceAccount) => React.ReactNode }) {
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
  current: boolean;
  hasLedger: boolean;
  /** Ledger less trial balance. Null when it cannot be compared, undefined when there is no ledger. */
  agreement: number | null | undefined;
  base: string;
  banks: { id: string; name: string; closing: number; clean: boolean; files: Evidence[] }[];
  journalFiles: (id: string) => Evidence[];
  entryFiles: (entryNo: string) => Evidence[];
  tested: (entryNo: string) => 'clear' | 'exception' | 'open' | null;
  Files: (x: { files: Evidence[] }) => React.ReactNode;
}) {
  const { account: a, Files } = p;
  const [shown, setShown] = useState(PAGE);
  const [largest, setLargest] = useState(false);
  const entries = useMemo(
    () => (largest ? [...a.entries].sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount)) : a.entries),
    [a.entries, largest],
  );
  const net = a.entries.reduce((s, e) => s + e.amount, 0);

  if (!p.current)
    return <div className="small muted">This is last year’s figure, taken from the prior year trial balance. The prior year ledger is not held in this file.</div>;

  return (
    <div className="stack" style={{ gap: 12 }}>
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
          No general ledger has been imported, so the trail stops at the trial balance. <Link to={`${p.base}/ledger`}>Import the ledger</Link>
        </div>
      ) : a.entries.length === 0 ? (
        <div className="small muted">The ledger has no entries on this account.</div>
      ) : (
        <div>
          <div className="between">
            <strong className="small">
              Client’s ledger: {a.entries.length.toLocaleString('en-GB')} entr{a.entries.length === 1 ? 'y' : 'ies'}, net {net < 0 ? 'credit' : 'debit'} {fmt2(Math.abs(net))}
            </strong>
            <label className="small row" style={{ gap: 6 }}>
              <input type="checkbox" checked={largest} onChange={(e) => setLargest(e.target.checked)} /> Largest first
            </label>
          </div>
          {p.agreement !== undefined && (
            <div className="small" style={{ margin: '4px 0 6px' }}>
              {p.agreement === null ? (
                <span className="muted">Not compared to the trial balance: there is no opening balance for this account.</span>
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
