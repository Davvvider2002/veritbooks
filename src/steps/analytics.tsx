import { useMemo, useState } from 'react';
import { repo } from '../data';
import type { JournalExplanation } from '../data/repo';
import { computeMateriality } from '../engine/checks';
import { ITEM } from '../engine/chart';
import { balanceAt, parseBankStatement, type BankParse } from '../engine/bank';
import { shortDate } from '../engine/dates';
import type { DateOrder } from '../engine/dates';
import { FLAG_LABEL, HIGH_RISK_SCORE, parseLedger, priorAgreement, resolveAccounts, type Flag, type Journal, type LedgerParse } from '../engine/ledger';
import { fmt2, parseAmount } from '../engine/money';
import { PdfPasswordError } from '../pdf';
import { ErrorNote, Field, message, useAction } from '../ui';
import { invalidateAnalytics, type Ctx, type Recon } from '../workspace';
import { FileCount } from './evidence';
import { readRows, SourceGuide } from './input';

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
  const [explained, setExplained] = useState<(JournalExplanation & { model: string }) | null>(null);
  const ask = useAction();
  const explain = () =>
    void ask.run(async () => {
      const m = computeMateriality(ctx.statements.cur, eng.planning);
      setExplained(
        await repo.explainJournal(
          eng.id,
          {
            entryNo: j.entryNo,
            date: j.date,
            description: j.description,
            user: j.user,
            flags: j.flags.map((f) => FLAG_LABEL[f]),
            lines: j.lines.map((e) => {
              const l = lines.find((x) => x.code === e.accountCode);
              return { account: `${e.accountCode} ${l?.name ?? ''}`.trim(), line: (l?.mapCode && ITEM.get(l.mapCode)?.label) || 'not mapped', amount: e.amount / 100 };
            }),
          },
          { yearEnd: eng.yearEnd, performanceMateriality: m ? m.performance / 100 : null },
        ),
      );
    });

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
          {ctx.ws.firm.aiEnabled && !explained && (
            <div>
              <button disabled={ask.busy} onClick={explain}>{ask.busy ? 'Asking…' : 'Explain this journal'}</button>
              <span className="small muted" style={{ marginLeft: 10 }}>Sends this journal’s date, description, poster, accounts and amounts to the AI service.</span>
            </div>
          )}
          <ErrorNote error={ask.error} />
          {explained && (
            <div className="assist">
              <div className="small" style={{ fontWeight: 600 }}>Written by AI from the journal alone. It has not seen any evidence, and it can be wrong.</div>
              <p>{explained.whatItDoes}</p>
              {explained.whyFlagged.length > 0 && (
                <>
                  <strong className="small">Why it was flagged</strong>
                  <ul>{explained.whyFlagged.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              {explained.tests.length > 0 && (
                <>
                  <strong className="small">Ways to test it</strong>
                  <ul>{explained.tests.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              {explained.questions.length > 0 && (
                <>
                  <strong className="small">Questions for management</strong>
                  <ul>{explained.questions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </>
              )}
              <div className="small muted">
                From {explained.model}. This is not saved to the file. Record your own work and conclusion below.{' '}
                <button className="link small" onClick={() => setExplained(null)}>Hide</button>
              </div>
            </div>
          )}
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

/** Last year's ledger. It is not tested. It is held so a comparative figure can be followed to its entries. */
function PriorLedgerCard({ eng, lines, priorLedger, priorReady, locked, reload }: Ctx) {
  const [raw, setRaw] = useState<{ rows: unknown[][]; file: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const { busy, error, run } = useAction();
  const year = Number(eng.yearEnd.slice(0, 4)) - 1;
  const end = `${year}${eng.yearEnd.slice(4)}`;
  const start = `${year - 1}${eng.yearEnd.slice(4)}`;
  const parsed = useMemo(() => {
    if (!raw) return null;
    try {
      const p = parseLedger(raw.rows);
      return { ...p, ...resolveAccounts(p.entries, lines), failed: null as string | null };
    } catch (e) {
      return { entries: [], warnings: [], unresolved: [], badDates: 0, failed: message(e) };
    }
  }, [raw, lines]);
  const inYear = parsed?.entries.filter((e) => e.date > start && e.date <= end).length ?? 0;
  const agreement = useMemo(() => priorAgreement(priorLedger, lines), [priorLedger, lines]);
  const agreed = agreement.filter((a) => a.difference === 0).length;
  const replace = (entries: LedgerParse['entries']) =>
    run(async () => {
      await repo.replaceLedger(eng.id, entries, 'prior');
      invalidateAnalytics(eng.id);
      setRaw(null);
      setKey((k) => k + 1);
      reload();
    });

  if (!priorReady)
    return (
      <div className="card stack">
        <h3>Last year’s ledger, {year}</h3>
        <div className="banner warn">
          Holding last year’s ledger needs a database update. Run <code>supabase/migrations/0006_prior_ledger_and_pages.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      </div>
    );

  return (
    <div className="card stack">
      <div className="between">
        <h3>Last year’s ledger, {year}</h3>
        {!locked && priorLedger.length > 0 && (
          <button className="link danger" disabled={busy} onClick={() => void replace([])}>Remove last year’s ledger</button>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Optional. With it, a {year} figure in the statements opens to its entries, as this year’s figures do. It is not tested for risk and plays no part in sign-off. Try the{' '}
        <a href="/samples/general-ledger-2024.csv" download>sample</a>.
      </p>
      {priorLedger.length > 0 && (
        <div className={`banner ${agreed === agreement.length ? 'info' : 'warn'}`}>
          {priorLedger.length.toLocaleString()} lines held for {year}.{' '}
          {agreement.length === 0
            ? 'No income or expense account could be compared to last year’s trial balance.'
            : agreed === agreement.length
              ? `It agrees to last year’s trial balance on all ${agreement.length} income and expense accounts.`
              : `It agrees to last year’s trial balance on ${agreed} of ${agreement.length} income and expense accounts. It differs on: ${agreement.filter((a) => a.difference).slice(0, 6).map((a) => `${a.code} ${a.name}`).join(', ')}.`}{' '}
          Balance sheet accounts cannot be compared, because their opening balances are not held.
        </div>
      )}
      {!locked && (
        <label className="field">
          <span>{priorLedger.length ? `Replace the ${year} ledger` : `General ledger for ${year} (CSV or Excel)`}</span>
          <input
            key={key}
            type="file"
            accept=".csv,.xlsx"
            aria-label={`General ledger file for ${year}`}
            style={{ padding: '6px 0' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setRaw(null);
              setParseError(null);
              if (file) readRows(file).then((rows) => setRaw({ rows, file: file.name }), (x) => setParseError(message(x)));
            }}
          />
        </label>
      )}
      <ErrorNote error={parseError ?? parsed?.failed ?? error} />
      {parsed && !parsed.failed && (
        <div className="stack">
          {parsed.badDates > 0 && <div className="banner bad">{parsed.badDates.toLocaleString()} row(s) have a date that cannot be read, and were left out.</div>}
          {inYear < parsed.entries.length && (
            <div className="banner bad">
              Only {inYear.toLocaleString()} of {parsed.entries.length.toLocaleString()} lines are dated in the year ended {shortDate(end)}. This may be the wrong year’s ledger.
            </div>
          )}
          {parsed.unresolved.length > 0 && (
            <div className="banner warn">
              {parsed.unresolved.length} ledger account(s) were not found in the trial balance, so their entries will not appear behind any figure: {parsed.unresolved.slice(0, 8).join(', ')}
              {parsed.unresolved.length > 8 ? ' and more' : ''}.
            </div>
          )}
          <div className="banner info">
            <strong>{raw!.file}</strong>: {parsed.entries.length.toLocaleString()} lines.
          </div>
          <div>
            <button className="primary" disabled={busy || parsed.entries.length === 0 || inYear === 0} onClick={() => void replace(parsed.entries)}>
              {busy ? 'Importing…' : `Import as the ${year} ledger`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LedgerStep(ctx: Ctx) {
  const { eng, lines, ledger, ledgerTest: t, locked, reload, analyticsReady } = ctx;
  const [raw, setRaw] = useState<{ rows: unknown[][]; file: string } | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');
  const [parseError, setParseError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { busy, error, run } = useAction();

  // The file is re-read whenever the date order is changed, so the preview always shows what will be imported.
  const parsed = useMemo(() => {
    if (!raw) return null;
    try {
      const p = parseLedger(raw.rows, { dateOrder });
      return { ...p, ...resolveAccounts(p.entries, lines), file: raw.file, failed: null as string | null };
    } catch (e) {
      return { entries: [], warnings: [], unresolved: [], dateOrder: { monthFirst: false, certain: true }, badDates: 0, file: raw.file, failed: message(e) };
    }
  }, [raw, dateOrder, lines]);
  const setParsed = (_: null) => setRaw(null);

  const onFile = async (file: File | undefined) => {
    setRaw(null);
    setParseError(null);
    setDateOrder('auto');
    if (!file) return;
    try {
      setRaw({ rows: await readRows(file), file: file.name });
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

  const yearStart = `${Number(eng.yearEnd.slice(0, 4)) - 1}${eng.yearEnd.slice(4)}`;
  const inYear = parsed?.entries.filter((e) => e.date > yearStart && e.date <= eng.yearEnd).length ?? 0;
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
          <SourceGuide kind="gl" />
          <label className="field">
            <span>{ledger.length ? 'Replace the general ledger' : 'General ledger file (CSV or Excel)'}</span>
            <input type="file" accept=".csv,.xlsx" onChange={(e) => void onFile(e.target.files?.[0])} style={{ padding: '6px 0' }} />
          </label>
          <p className="small muted" style={{ margin: 0 }}>
            Needs a header row with a date, an account code, and Debit and Credit or one Amount column. Journal number, description and posted-by columns are used when present. Try the{' '}
            <a href="/samples/general-ledger-2025.csv" download>sample ledger</a>.
          </p>
          <ErrorNote error={parseError ?? parsed?.failed ?? error} />
          {parsed && !parsed.failed && (
            <div className="stack">
              <div className="row">
                <label className="field" style={{ width: 260 }}>
                  <span>Dates in this file are written</span>
                  <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                    <option value="auto">Work it out from the file</option>
                    <option value="day">Day first (31/12/2025)</option>
                    <option value="month">Month first (12/31/2025)</option>
                  </select>
                </label>
                <span className="small muted" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
                  Read as {parsed.dateOrder.monthFirst ? 'month first' : 'day first'}.
                  {!parsed.dateOrder.certain && ' The file does not settle it, so check the dates below.'}
                </span>
              </div>
              {parsed.badDates > 0 && (
                <div className="banner bad">
                  {parsed.badDates.toLocaleString()} row(s) have a date that cannot be read {parsed.dateOrder.monthFirst ? 'month first' : 'day first'}, and were left out. Try the other date order.
                </div>
              )}
              {inYear < parsed.entries.length / 2 && (
                <div className="banner bad">
                  Only {inYear.toLocaleString()} of {parsed.entries.length.toLocaleString()} lines fall inside the year. The dates may be in the other order, or this may be the wrong period.
                </div>
              )}
              {parsed.unresolved.length > 0 && (
                <div className="banner warn">
                  {parsed.unresolved.length} ledger account(s) were not found in the trial balance: {parsed.unresolved.slice(0, 8).join(', ')}
                  {parsed.unresolved.length > 8 ? ' and more' : ''}. Their postings will be flagged, and the ledger will not agree to the trial balance on them.
                </div>
              )}
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
      {analyticsReady && lines.length > 0 && ctx.statements.hasPrior && <PriorLedgerCard {...ctx} />}
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
  const [rawBank, setRawBank] = useState<{ rows: unknown[][]; file: string; fromPdf: boolean } | null>(null);
  const [bankDates, setBankDates] = useState<DateOrder>('auto');
  const bankRead = useMemo((): { parsed: (BankParse & { file: string; fromPdf: boolean }) | null; failed: string | null } => {
    if (!rawBank) return { parsed: null, failed: null };
    try {
      return { parsed: { ...parseBankStatement(rawBank.rows, bankDates), file: rawBank.file, fromPdf: rawBank.fromPdf }, failed: null };
    } catch (e) {
      return { parsed: null, failed: message(e) };
    }
  }, [rawBank, bankDates]);
  const parsed = bankRead.parsed;
  const setParsed = (_: null) => setRawBank(null);
  const [pdf, setPdf] = useState<{ file: File; wrong: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [opening, setOpening] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [manualClosing, setManualClosing] = useState('');
  const { busy, error, run, setError } = useAction();

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setParseError(null);
    if (!file) return;
    setPdf(null);
    setPassword('');
    setBankDates('auto');
    if (/\.pdf$/i.test(file.name)) return void openPdf(file);
    try {
      setRawBank({ rows: await readRows(file), file: file.name, fromPdf: false });
    } catch (e) {
      setParseError(message(e));
    }
  };

  const openPdf = async (file: File, pw?: string) => {
    setParseError(null);
    setOpening(true);
    try {
      const { pdfStatementRows } = await import('../pdfBrowser');
      setRawBank({ rows: await pdfStatementRows(file, pw), file: file.name, fromPdf: true });
      setPdf(null);
    } catch (e) {
      if (e instanceof PdfPasswordError) {
        setPdf({ file, wrong: e.wrong });
      } else {
        setPdf(null);
        setParseError(message(e));
      }
    } finally {
      setOpening(false);
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
              <span>Statement file (PDF, Excel or CSV)</span>
              <input type="file" accept=".csv,.xlsx,.pdf" onChange={(e) => void onFile(e.target.files?.[0])} style={{ padding: '6px 0' }} />
            </label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Needs a line of column headings with a date and Debit and Credit, or one signed Amount column. A Balance column lets the running balance be checked. Running the statement into January shows which outstanding items cleared. A PDF must be the bank’s electronic statement, not a scan, and is read in your browser without being uploaded. Try the sample statement as{' '}
            <a href="/samples/bank-statement-2025.pdf" download>PDF</a> or <a href="/samples/bank-statement-2025.csv" download>CSV</a>.
          </p>
          {opening && <div className="banner info">Reading the PDF…</div>}
          {pdf && (
            <form
              className="row"
              style={{ alignItems: 'flex-end' }}
              onSubmit={(e) => {
                e.preventDefault();
                void openPdf(pdf.file, password);
              }}
            >
              <div style={{ flex: '0 1 280px' }}>
                <Field label="Statement password" hint={pdf.wrong ? 'That password did not open the statement.' : 'This statement is password protected. The password is used in your browser only and is not saved.'}>
                  <input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              </div>
              <button disabled={opening || !password}>Open statement</button>
            </form>
          )}
          <ErrorNote error={parseError ?? bankRead.failed ?? error} />
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
              {(!parsed.dateOrder.certain || bankDates !== 'auto') && (
                <label className="field" style={{ maxWidth: 420 }}>
                  <span>Dates could be day first or month first. This file is written</span>
                  <select value={bankDates} onChange={(e) => setBankDates(e.target.value as DateOrder)}>
                    <option value="auto">Day first (31/12/2025), the Nigerian convention</option>
                    <option value="month">Month first (12/31/2025)</option>
                  </select>
                </label>
              )}
              {parsed.fromPdf &&
                (parsed.breaks === 0 && closing !== null ? (
                  <div className="banner info">
                    Read from a PDF. Every row’s balance follows from the row before, which confirms the amounts were read correctly.
                  </div>
                ) : (
                  <div className="banner warn">
                    Read from a PDF, and the amounts could not be fully confirmed against the running balance. Agree the totals and the closing balance to the statement before relying on this import, or ask the bank for Excel or CSV.
                  </div>
                ))}
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
