import { useState } from 'react';
import { repo } from '../data';
import { ITEM } from '../engine/chart';
import { balanceAt, parseBankStatement, type BankParse } from '../engine/bank';
import { shortDate } from '../engine/dates';
import { FLAG_LABEL, HIGH_RISK_SCORE, parseLedger, type Flag, type Journal, type LedgerParse } from '../engine/ledger';
import { fmt2, parseAmount } from '../engine/money';
import { ErrorNote, Field, message, useAction } from '../ui';
import { invalidateAnalytics, type Ctx, type Recon } from '../workspace';
import { FileCount } from './evidence';
import { readRows } from './input';

function NotReady() {
  return (
    <div className="banner warn">
      The database has not been updated for this feature. Run <code>supabase/migrations/0002_ledger_and_bank.sql</code> in the Supabase SQL editor, then reload this page.
    </div>
  );
}

const by = (ctx: Ctx) => ctx.ws.me.fullName || ctx.ws.me.userId;

function JournalCard({ ctx, j, defaultOpen }: { ctx: Ctx; j: Journal; defaultOpen: boolean }) {
  const { eng, lines, locked, reload } = ctx;
  const done = eng.testing.journals?.[j.entryNo];
  const [open, setOpen] = useState(defaultOpen && !done);
  const [status, setStatus] = useState<'clear' | 'exception'>(done?.status ?? 'clear');
  const [note, setNote] = useState(done?.note ?? '');
  const { busy, error, run, setError } = useAction();
  const name = (code: string) => lines.find((l) => l.code === code)?.name ?? 'Not in the trial balance';

  const save = () => {
    if (!note.trim()) return setError('Record what was tested and what it showed.');
    void run(async () => {
      const journals = { ...eng.testing.journals, [j.entryNo]: { status, note: note.trim(), by: by(ctx), at: new Date().toISOString() } };
      await repo.updateEngagement(eng.id, { testing: { ...eng.testing, journals } });
      setOpen(false);
      reload();
    });
  };

  return (
    <div className="journal">
      <button className="journal-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="num" style={{ minWidth: 84, textAlign: 'left' }}>{j.entryNo}</span>
        <span style={{ minWidth: 92 }}>{shortDate(j.date)}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{j.description || <em className="muted">No description</em>}</span>
        <span className="num">{fmt2(j.value)}</span>
        <FileCount evidence={ctx.evidence} type="journal" id={j.entryNo} />
        {done ? (
          <span className={`tag ${done.status === 'clear' ? 'ok' : 'bad'}`}>{done.status === 'clear' ? 'No exception' : 'Exception'}</span>
        ) : j.score >= HIGH_RISK_SCORE ? (
          <span className="tag warn">Open</span>
        ) : null}
      </button>
      <div className="row" style={{ gap: 6, margin: '4px 0 0' }}>
        {j.flags.map((f) => (
          <span key={f} className="tag">{FLAG_LABEL[f]}</span>
        ))}
      </div>
      {open && (
        <div className="stack" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {j.lines.map((e, i) => (
                <tr key={i}>
                  <td>{e.accountCode} {name(e.accountCode)}</td>
                  <td className="num">{e.amount > 0 ? fmt2(e.amount) : ''}</td>
                  <td className="num">{e.amount < 0 ? fmt2(-e.amount) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {j.user && <div className="small muted">Posted by {j.user}</div>}
          <div className="grid2" style={{ gridTemplateColumns: '220px 1fr' }}>
            <Field label="Conclusion">
              <select disabled={locked} value={status} onChange={(e) => setStatus(e.target.value as 'clear' | 'exception')}>
                <option value="clear">Tested, no exception</option>
                <option value="exception">Exception</option>
              </select>
            </Field>
            <Field label="Work done and evidence seen">
              <input type="text" disabled={locked} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {done && <div className="small muted">Concluded by {done.by}, {new Date(done.at).toLocaleDateString('en-GB')}</div>}
          <ErrorNote error={error} />
          {!locked && (
            <div>
              <button className="primary" disabled={busy} onClick={save}>Save conclusion</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LedgerStep(ctx: Ctx) {
  const { eng, lines, ledger, ledgerTest: t, locked, reload, analyticsReady } = ctx;
  const [parsed, setParsed] = useState<(LedgerParse & { file: string }) | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { busy, error, run } = useAction();

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setParseError(null);
    if (!file) return;
    try {
      setParsed({ ...parseLedger(await readRows(file)), file: file.name });
    } catch (e) {
      setParseError(message(e));
    }
  };
  const replace = (entries: LedgerParse['entries']) =>
    run(async () => {
      await repo.replaceLedger(eng.id, entries);
      // Conclusions belong to the journals of the ledger they were made on.
      if (eng.testing.journals && Object.keys(eng.testing.journals).length)
        await repo.updateEngagement(eng.id, { testing: { ...eng.testing, journals: {} } });
      invalidateAnalytics(eng.id);
      setParsed(null);
      reload();
    });

  const journalCount = parsed ? new Set(parsed.entries.map((e) => e.entryNo)).size : 0;
  const net = parsed?.entries.reduce((a, e) => a + e.amount, 0) ?? 0;
  const dates = parsed?.entries.map((e) => e.date).sort();
  const concluded = Object.keys(eng.testing.journals ?? {}).length;
  const disagree = t?.agreement.filter((a) => a.difference) ?? [];
  const lower = t?.journals.filter((j) => j.score > 0 && j.score < HIGH_RISK_SCORE) ?? [];

  return (
    <div className="stack">
      <div>
        <h2>Journal testing</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Import the general ledger for the year. Every journal is tested against the risk indicators below, not a sample. A journal with {HIGH_RISK_SCORE} or more indicators is high risk and needs a conclusion before sign-off.
        </p>
      </div>
      {!analyticsReady && <NotReady />}
      {lines.length === 0 && <div className="banner info">Import a trial balance first, so the ledger can be agreed to it.</div>}

      {analyticsReady && !locked && lines.length > 0 && (
        <div className="card stack">
          <label className="field">
            <span>{ledger.length ? 'Replace the general ledger' : 'General ledger file (CSV or Excel)'}</span>
            <input type="file" accept=".csv,.xlsx" onChange={(e) => void onFile(e.target.files?.[0])} style={{ padding: '6px 0' }} />
          </label>
          <p className="small muted" style={{ margin: 0 }}>
            Needs a header row with a date, an account code, and Debit and Credit or one Amount column. Journal number, description and posted-by columns are used when present. Try the{' '}
            <a href="/samples/general-ledger-2025.csv" download>sample ledger</a>.
          </p>
          <ErrorNote error={parseError ?? error} />
          {parsed && (
            <div className="stack">
              <div className={`banner ${net === 0 ? 'info' : 'warn'}`}>
                <strong>{parsed.file}</strong>: {parsed.entries.length.toLocaleString()} lines in {journalCount.toLocaleString()} journals, dated {shortDate(dates![0])} to {shortDate(dates![dates!.length - 1])}.{' '}
                {net === 0 ? 'Debits equal credits.' : `Debits and credits differ by ${fmt2(Math.abs(net))}.`}
              </div>
              {parsed.warnings.map((w) => (
                <div key={w} className="banner warn">{w}</div>
              ))}
              {ledger.length > 0 && concluded > 0 && (
                <div className="banner warn">Replacing the ledger clears the {concluded} journal conclusion(s) already recorded.</div>
              )}
              <div>
                <button className="primary" disabled={busy} onClick={() => void replace(parsed.entries)}>
                  {busy ? 'Importing…' : 'Import ledger'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {t && (
        <>
          <div className="card stack">
            <div className="between">
              <h3>Population</h3>
              {!locked && (
                <button className="link danger" disabled={busy} onClick={() => void replace([])}>Remove ledger</button>
              )}
            </div>
            <div className="row" style={{ gap: 24 }}>
              <div><div className="stat">{t.journals.length.toLocaleString()}</div><div className="small muted">journals tested</div></div>
              <div><div className="stat">{t.lineCount.toLocaleString()}</div><div className="small muted">ledger lines</div></div>
              <div><div className="stat">{t.highRisk.length}</div><div className="small muted">high risk</div></div>
              <div><div className="stat">{t.journals.filter((j) => j.score > 0).length.toLocaleString()}</div><div className="small muted">with any indicator</div></div>
            </div>
            {disagree.length === 0 && t.unknownAccounts.length === 0 ? (
              <div className="banner info">
                The ledger agrees to the trial balance on all {t.agreement.filter((a) => a.difference !== null).length} accounts that can be checked, so the journal population is complete.
              </div>
            ) : (
              <div className="banner bad">
                The ledger does not explain the trial balance, so journals may be missing from this file.
                {t.unknownAccounts.length > 0 && ` Ledger accounts not in the trial balance: ${t.unknownAccounts.join(', ')}.`}
              </div>
            )}
            {disagree.length > 0 && (
              <div className="scroll-x">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="num">Ledger movement</th>
                      <th className="num">Trial balance</th>
                      <th className="num">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disagree.map((a) => (
                      <tr key={a.code}>
                        <td>{a.code} {a.name}</td>
                        <td className="num">{fmt2(a.ledger)}</td>
                        <td className="num">{fmt2(a.expected!)}</td>
                        <td className="num">{fmt2(a.difference!)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!lines.some((l) => l.prior !== null) && (
              <div className="banner warn">No prior year trial balance is imported, so balance sheet accounts cannot be agreed. Only income and expense accounts were checked.</div>
            )}
            <div className="row" style={{ gap: 6 }}>
              {(Object.entries(t.flagCounts) as [Flag, number][]).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                <span key={f} className="tag">{FLAG_LABEL[f]}: {n}</span>
              ))}
            </div>
            {eng.planning.benchmark ? null : (
              <p className="small muted" style={{ margin: 0 }}>Materiality is not set, so the size indicator is switched off. Set it in Planning.</p>
            )}
          </div>

          <div className="card">
            <h3>High-risk journals</h3>
            <p className="small muted" style={{ margin: '4px 0 8px' }}>
              {t.highRisk.length === 0
                ? 'No journal carries three or more indicators.'
                : `${t.highRisk.filter((j) => eng.testing.journals?.[j.entryNo]).length} of ${t.highRisk.length} concluded. Open each one, test it to supporting evidence, and record the result.`}
            </p>
            {t.highRisk.map((j) => (
              <JournalCard key={j.entryNo} ctx={ctx} j={j} defaultOpen={false} />
            ))}
          </div>

          {lower.length > 0 && (
            <div className="card">
              <div className="between">
                <h3>Other journals with an indicator</h3>
                <span className="small muted">{lower.length.toLocaleString()} journals, largest first</span>
              </div>
              <p className="small muted" style={{ margin: '4px 0 8px' }}>
                These do not block sign-off. Select any that warrant testing and record a conclusion.
              </p>
              {(showAll ? lower.slice(0, 200) : lower.slice(0, 10)).map((j) => (
                <JournalCard key={j.entryNo} ctx={ctx} j={j} defaultOpen={false} />
              ))}
              {lower.length > 10 && (
                <button className="link" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer' : `Show more (up to 200 of ${lower.length.toLocaleString()})`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReconCard({ ctx, r }: { ctx: Ctx; r: Recon }) {
  const { eng, locked, reload, ledger } = ctx;
  const saved = eng.testing.bank?.[r.account.id];
  const [note, setNote] = useState(saved?.note ?? '');
  const [done, setDone] = useState(false);
  const { busy, error, run } = useAction();
  const x = r.result;
  const sum = (list: { amount: number }[], sign: 1 | -1) => list.filter((i) => Math.sign(i.amount) === sign).reduce((a, i) => a + i.amount, 0);
  const unbooked = (x?.bankOnlyTotal ?? 0) - r.journals;
  const clean = x !== null && x.difference === 0 && (x.bankOnly.length === 0 || unbooked === 0);

  return (
    <div className="card stack">
      <div className="between">
        <div>
          <h3>{r.account.name}</h3>
          <div className="small muted">
            Ledger account {r.account.accountCode} · {r.lines.length.toLocaleString()} statement lines · {r.account.fileName}
          </div>
        </div>
        <div className="row">
          <FileCount evidence={ctx.evidence} type="bank" id={r.account.id} />
          {x && <span className={`tag ${clean ? 'ok' : 'warn'}`}>{clean ? 'Reconciled' : 'Needs attention'}</span>}
          {!locked && (
            <button
              className="link danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repo.deleteBankAccount(r.account.id);
                  invalidateAnalytics(eng.id);
                  reload();
                })
              }
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {r.account.breaks > 0 && (
        <div className="banner bad">
          The running balance breaks on {r.account.breaks} row(s). Pages or transactions may be missing, or the statement may have been altered. Obtain the statement direct from the bank.
        </div>
      )}
      {r.ledgerBalance === null && (
        <div className="banner bad">Account {r.account.accountCode} is no longer in the trial balance. Remove this statement and import it against the right account.</div>
      )}
      {r.ledgerBalance !== null && !x && (
        <>
          <div className="banner warn">
            {ledger.length === 0
              ? 'Import the general ledger in Journal testing to match this statement to the cash book, line by line.'
              : 'This statement could not be matched to the ledger.'}
          </div>
          <table className="data">
            <tbody>
              <tr><td>Balance per bank statement at the year end</td><td className="num">{fmt2(r.account.closing)}</td></tr>
              <tr><td>Balance per ledger</td><td className="num">{fmt2(r.ledgerBalance)}</td></tr>
              <tr><td><strong>Difference to be reconciled</strong></td><td className="num"><strong>{fmt2(r.ledgerBalance - r.account.closing)}</strong></td></tr>
            </tbody>
          </table>
        </>
      )}

      {x && (
        <>
          <table className="data">
            <tbody>
              <tr><td>Balance per bank statement at the year end</td><td className="num">{fmt2(x.bankClosing)}</td></tr>
              <tr><td>Add: lodgements in the ledger not yet credited by the bank</td><td className="num">{fmt2(sum(x.ledgerOnly, 1))}</td></tr>
              <tr><td>Less: payments in the ledger not yet presented</td><td className="num">{fmt2(sum(x.ledgerOnly, -1))}</td></tr>
              <tr><td>Less: receipts on the statement not in the ledger</td><td className="num">{fmt2(-sum(x.bankOnly, 1))}</td></tr>
              <tr><td>Add: payments on the statement not in the ledger</td><td className="num">{fmt2(-sum(x.bankOnly, -1))}</td></tr>
              <tr><td><strong>Reconciled balance</strong></td><td className="num"><strong>{fmt2(x.expectedLedger)}</strong></td></tr>
              <tr><td>Balance per ledger</td><td className="num">{fmt2(x.ledgerBalance)}</td></tr>
              <tr><td><strong>Unexplained difference</strong></td><td className="num"><strong>{fmt2(x.difference)}</strong></td></tr>
            </tbody>
          </table>
          {(x.bankOnly.length > 0 || r.journals !== 0) && (
            <table className="data">
              <tbody>
                <tr><td>Statement items not in the ledger, net</td><td className="num">{fmt2(x.bankOnlyTotal)}</td></tr>
                <tr><td>Audit journals posted to this account</td><td className="num">{fmt2(r.journals)}</td></tr>
                <tr><td><strong>Still to be adjusted</strong></td><td className="num"><strong>{fmt2(unbooked)}</strong></td></tr>
                <tr><td>Ledger balance after audit journals</td><td className="num">{fmt2(x.ledgerBalance + r.journals)}</td></tr>
              </tbody>
            </table>
          )}
          <p className="small muted" style={{ margin: 0 }}>
            {x.matched.toLocaleString()} statement lines matched to the ledger on exact amount, within 3 days before and 10 days after the ledger date. Any difference includes reconciling items brought forward from the prior year.
          </p>

          {x.bankOnly.length > 0 && (
            <div>
              <h3>On the statement, not in the ledger ({x.bankOnly.length})</h3>
              <p className="small muted" style={{ margin: '2px 0 6px' }}>These usually need an adjusting journal. Post it in Journals and it is set against them here.</p>
              <div className="scroll-x">
                <table className="data">
                  <thead><tr><th>Date</th><th>Narration</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {x.bankOnly.slice(0, 100).map((b, i) => (
                      <tr key={i}><td style={{ whiteSpace: 'nowrap' }}>{shortDate(b.date)}</td><td>{b.description}</td><td className="num">{fmt2(b.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {x.bankOnly.length > 100 && <p className="small muted">Showing the first 100.</p>}
            </div>
          )}
          {x.ledgerOnly.length > 0 && (
            <div>
              <h3>In the ledger, not on the statement at the year end ({x.ledgerOnly.length})</h3>
              <p className="small muted" style={{ margin: '2px 0 6px' }}>Test each to the bank statement after the year end. Old items need explaining.</p>
              <div className="scroll-x">
                <table className="data">
                  <thead><tr><th>Date</th><th>Journal</th><th>Description</th><th className="num">Amount</th><th>Cleared</th></tr></thead>
                  <tbody>
                    {x.ledgerOnly.slice(0, 100).map((e, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{shortDate(e.date)}</td>
                        <td>{e.entryNo}</td>
                        <td>{e.description}</td>
                        <td className="num">{fmt2(e.amount)}</td>
                        <td>{e.clearedOn ? shortDate(e.clearedOn) : <span className="muted">Not seen</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {x.ledgerOnly.length > 100 && <p className="small muted">Showing the first 100.</p>}
            </div>
          )}
        </>
      )}

      <Field label="Conclusion on this account" hint={clean ? undefined : 'Required before sign-off while the account is not cleanly reconciled.'}>
        <textarea disabled={locked} value={note} onChange={(e) => { setDone(false); setNote(e.target.value); }} />
      </Field>
      {saved && <div className="small muted">Concluded by {saved.by}, {new Date(saved.at).toLocaleDateString('en-GB')}</div>}
      <ErrorNote error={error} />
      {done && <div className="banner info">Saved.</div>}
      {!locked && (
        <div>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const bank = { ...eng.testing.bank, [r.account.id]: { note: note.trim(), by: by(ctx), at: new Date().toISOString() } };
                await repo.updateEngagement(eng.id, { testing: { ...eng.testing, bank } });
                setDone(true);
                reload();
              })
            }
          >
            Save conclusion
          </button>
        </div>
      )}
    </div>
  );
}

export function BankStep(ctx: Ctx) {
  const { eng, lines, recons, locked, reload, analyticsReady } = ctx;
  const cashLines = lines.filter((l) => {
    const c = l.mapCode ? ITEM.get(l.mapCode)?.code : null;
    return c === 'cash' || c === 'borrowings_c';
  });
  const [parsed, setParsed] = useState<(BankParse & { file: string }) | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [manualClosing, setManualClosing] = useState('');
  const { busy, error, run, setError } = useAction();

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setParseError(null);
    if (!file) return;
    if (/\.pdf$/i.test(file.name)) {
      return setParseError('PDF statements are not read yet. Ask the bank for the statement in Excel or CSV, or export it from internet banking.');
    }
    try {
      setParsed({ ...parseBankStatement(await readRows(file)), file: file.name });
    } catch (e) {
      setParseError(message(e));
    }
  };

  const closing = parsed ? balanceAt(parsed, eng.yearEnd) : null;
  const inYear = parsed?.lines.filter((l) => l.date <= eng.yearEnd).length ?? 0;
  const save = () => {
    const c = closing ?? parseAmount(manualClosing);
    if (!name.trim()) return setError('Name the account, for example the bank and the last four digits.');
    if (!code) return setError('Choose the ledger account this statement supports.');
    if (c === null) return setError('Enter the closing balance shown on the statement at the year end.');
    void run(async () => {
      await repo.addBankStatement(
        eng.id,
        { name: name.trim(), accountCode: code, opening: parsed!.opening, closing: c, breaks: parsed!.breaks, fileName: parsed!.file },
        parsed!.lines,
      );
      invalidateAnalytics(eng.id);
      setParsed(null);
      setName('');
      setCode('');
      setManualClosing('');
      reload();
    });
  };

  return (
    <div className="stack">
      <div>
        <h2>Bank</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Import each bank statement for the year. The running balance is checked for breaks, every line is matched to the cash book, and the account is reconciled to the ledger at the year end.
        </p>
      </div>
      {!analyticsReady && <NotReady />}
      {analyticsReady && cashLines.length === 0 && (
        <div className="banner info">Import the trial balance and map the bank accounts to cash first.</div>
      )}

      {analyticsReady && !locked && cashLines.length > 0 && (
        <div className="card stack">
          <h3>Add a statement</h3>
          <div className="grid3">
            <Field label="Account name">
              <input type="text" value={name} placeholder="GTBank current 4471" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Ledger account">
              <select value={code} onChange={(e) => setCode(e.target.value)}>
                <option value="">Select an account</option>
                {cashLines.map((l) => (
                  <option key={l.id} value={l.code}>{l.code} {l.name}</option>
                ))}
              </select>
            </Field>
            <label className="field">
              <span>Statement file (CSV or Excel)</span>
              <input type="file" accept=".csv,.xlsx,.pdf" onChange={(e) => void onFile(e.target.files?.[0])} style={{ padding: '6px 0' }} />
            </label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Needs a header row with a date and Debit and Credit columns, or one signed Amount column. A Balance column lets the running balance be checked. Running the statement into January shows which outstanding items cleared. Try the{' '}
            <a href="/samples/bank-statement-2025.csv" download>sample statement</a>.
          </p>
          <ErrorNote error={parseError ?? error} />
          {parsed && (
            <div className="stack">
              <div className={`banner ${parsed.breaks ? 'bad' : 'info'}`}>
                <strong>{parsed.file}</strong>: {parsed.lines.length.toLocaleString()} transactions, {shortDate(parsed.lines[0].date)} to {shortDate(parsed.lines[parsed.lines.length - 1].date)}, {inYear.toLocaleString()} of them in the year.{' '}
                {parsed.opening !== null && `Opening balance ${fmt2(parsed.opening)}. `}
                {closing !== null && `Balance at the year end ${fmt2(closing)}. `}
                {parsed.breaks
                  ? `The running balance breaks on ${parsed.breaks} row(s), first on ${shortDate(parsed.firstBreak!)}.`
                  : closing !== null
                    ? 'The running balance is unbroken.'
                    : ''}
              </div>
              {parsed.warnings.map((w) => (
                <div key={w} className="banner warn">{w}</div>
              ))}
              {closing === null && (
                <Field label="Closing balance per statement at the year end, ₦">
                  <input type="text" inputMode="decimal" value={manualClosing} onChange={(e) => setManualClosing(e.target.value)} style={{ maxWidth: 240 }} />
                </Field>
              )}
              <div>
                <button className="primary" disabled={busy} onClick={save}>{busy ? 'Importing…' : 'Import statement'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {recons.map((r) => (
        <ReconCard key={r.account.id} ctx={ctx} r={r} />
      ))}
    </div>
  );
}
