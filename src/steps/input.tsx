import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import { SOURCES } from '../content/sources';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import type { MappingSuggestion } from '../data/repo';
import { CHART, ITEM, NATURE_CODES, SECTION_LABEL, type Section } from '../engine/chart';
import { validateTrialBalance } from '../engine/checks';
import { normaliseNature } from '../engine/mapping';
import { mergeImport } from '../engine/merge';
import { fmt2 } from '../engine/money';
import { parseTrialBalance, type ParseResult } from '../engine/parse';
import type { Nature } from '../engine/types';
import { ErrorNote, message, useAction } from '../ui';
import type { Ctx } from '../workspace';

export async function readRows(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(file)) as unknown[][];
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error('Old .xls files are not supported. Save the file as .xlsx or .csv and try again.');
  }
  const text = await file.text();
  return Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
}

const SOURCE_KEY = 'veritbooks.source';

/** Pick the client's accounting package and see how to export from it. The choice is remembered in this browser. */
export function SourceGuide({ kind }: { kind: 'tb' | 'gl' }) {
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(SOURCE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const source = SOURCES.find((x) => x.id === id);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="field" style={{ maxWidth: 340 }}>
        <span>Where does the client keep its books?</span>
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            try {
              localStorage.setItem(SOURCE_KEY, e.target.value);
            } catch {
              // The choice simply is not remembered.
            }
          }}
        >
          <option value="">Choose a system for export steps</option>
          {SOURCES.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </label>
      {source && (
        <div className="guide">
          <strong>{kind === 'tb' ? 'To export the trial balance' : 'To export the ledger'} from {source.name}</strong>
          <ol>
            {source[kind].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {source.notes.length > 0 && (
            <ul>
              {source.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <span className="small muted">Menu names differ between versions. Import the file as it is exported, without tidying it first.</span>
        </div>
      )}
    </div>
  );
}

export function ChecksList({ checks }: { checks: ReturnType<typeof validateTrialBalance> }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.id}>
          <span className={`mark ${c.ok ? 'ok' : c.blocking ? 'no' : 'adv'}`} aria-hidden>
            {c.ok ? '✓' : c.blocking ? '✕' : '!'}
          </span>
          <span>
            {c.label}
            {!c.ok && !c.blocking && <span className="muted"> (advisory)</span>}
            {c.detail && <span className="small muted" style={{ display: 'block' }}>{c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ImportStep({ eng, client, lines, adjustments, locked, reload }: Ctx) {
  const [period, setPeriod] = useState<'current' | 'prior'>('current');
  const [parsed, setParsed] = useState<(ParseResult & { file: string }) | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const year = Number(eng.yearEnd.slice(0, 4));
  const checks = validateTrialBalance(lines);

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setParseError(null);
    if (!file) return;
    try {
      setParsed({ ...parseTrialBalance(await readRows(file)), file: file.name });
    } catch (e) {
      setParseError(message(e));
    }
  };

  const debits = parsed?.lines.reduce((a, l) => a + Math.max(l.balance, 0), 0) ?? 0;
  const credits = parsed?.lines.reduce((a, l) => a + Math.max(-l.balance, 0), 0) ?? 0;

  const save = () =>
    run(async () => {
      const saved = await repo.savedMappings(client.id);
      const merged = mergeImport(lines, parsed!.lines, period, saved, adjustments);
      await repo.replaceLines(eng.id, merged);
      setParsed(null);
      reload();
    });

  return (
    <div className="stack">
      <div>
        <h2>Trial balance</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Import the trial balance before closing entries, as CSV or Excel. The file needs a header row with the account name and either Debit and Credit columns or one Balance column.
        </p>
      </div>

      {!locked && (
        <div className="card stack">
          <SourceGuide kind="tb" />
          <div className="grid2">
            <label className="field">
              <span>Which year is this file?</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value as 'current' | 'prior')}>
                <option value="current">Current year ({year})</option>
                <option value="prior">Prior year ({year - 1})</option>
              </select>
            </label>
            <label className="field">
              <span>File</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void onFile(e.target.files?.[0])}
                style={{ padding: '6px 0' }}
              />
            </label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            No file to hand? Try the sample company:{' '}
            <a href="/samples/trial-balance-2025.csv" download>current year</a> and{' '}
            <a href="/samples/trial-balance-2024.csv" download>prior year</a>.
          </p>
          <ErrorNote error={parseError ?? error} />
          {parsed && (
            <div className="stack">
              <div className={`banner ${debits === credits ? 'info' : 'warn'}`}>
                <strong>{parsed.file}</strong>: {parsed.lines.length} accounts. Debits {fmt2(debits)}, credits {fmt2(credits)}.{' '}
                {debits === credits ? 'It foots.' : `It does not foot. Difference ${fmt2(Math.abs(debits - credits))}.`}
              </div>
              {parsed.warnings.map((w) => (
                <div key={w} className="banner warn">{w}</div>
              ))}
              <div>
                <button className="primary" disabled={busy} onClick={() => void save()}>
                  Import as {period === 'current' ? 'current' : 'prior'} year
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <>
          <div className="card">
            <h3>Checks</h3>
            <ChecksList checks={checks} />
          </div>
          <div className="card">
            <h3>Imported accounts</h3>
            <div className="scroll-x" style={{ marginTop: 8 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="num">{year}</th>
                    <th className="num">{year - 1}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.code}</td>
                      <td>{l.name}</td>
                      <td className="num">{fmt2(l.balance)}</td>
                      <td className="num">{l.prior === null ? '' : fmt2(l.prior)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ margin: '10px 0 0' }}>Debit balances are positive. Credit balances are in brackets.</p>
          </div>
        </>
      )}
    </div>
  );
}

const SECTIONS: Section[] = ['nca', 'ca', 'equity', 'ncl', 'cl', 'income', 'expense', 'distribution'];

const CONFIDENCE = { high: ['High', 'ok'], medium: ['Medium', 'warn'], low: ['Low', 'bad'] } as const;

/** Asks the AI service where the unmapped accounts belong, and lets the accountant take or leave each answer. */
function MappingAssist({ ctx, unmapped, apply }: { ctx: Ctx; unmapped: Ctx['lines']; apply: (lineId: string, mapCode: string, nature: Nature | null) => Promise<void> }) {
  const [found, setFound] = useState<{ suggestions: MappingSuggestion[]; model: string } | null>(null);
  const { busy, error, run } = useAction();
  const open = (found?.suggestions ?? []).filter((s) => unmapped.some((l) => l.code === s.code));
  const line = (code: string) => unmapped.find((l) => l.code === code)!;
  if (!ctx.ws.firm.aiEnabled)
    return unmapped.length > 3 ? (
      <p className="small muted" style={{ margin: 0 }}>
        AI suggestions for unmapped accounts are off for your firm. A partner can turn them on in the <Link to="/firm">firm details</Link>.
      </p>
    ) : null;
  if (unmapped.length === 0 && !found) return null;
  return (
    <div className="card stack">
      <div className="between">
        <h3>AI suggestions</h3>
        {unmapped.length > 0 && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                // 150 accounts a request keeps each answer complete.
                setFound(await repo.suggestMappings(ctx.eng.id, unmapped.slice(0, 150).map((l) => ({ code: l.code, name: l.name, balance: l.balance / 100 }))));
              })
            }
          >
            {busy ? 'Asking…' : `Suggest lines for ${Math.min(unmapped.length, 150)} unmapped account${unmapped.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Sends the code, name and balance of each unmapped account to the AI service. Nothing is mapped until you accept it. A suggestion can be wrong: read the reason, and check any marked low.
      </p>
      <ErrorNote error={error} />
      {found && open.length === 0 && <div className="banner info">{found.suggestions.length === 0 ? 'The AI service returned no suggestions.' : 'Every suggestion has been dealt with.'}</div>}
      {open.length > 0 && (
        <>
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Suggested line</th>
                  <th>Confidence</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {open.map((s) => (
                  <tr key={s.code}>
                    <td>
                      {s.code} {line(s.code).name}
                      <div className="small muted">{fmt2(line(s.code).balance)}</div>
                    </td>
                    <td>
                      {ITEM.get(s.line)?.label ?? s.line}
                      {s.nature && s.nature !== 'other' && <div className="small muted">{s.nature === 'staff' ? 'Staff cost' : 'Depreciation'}</div>}
                    </td>
                    <td><span className={`tag ${CONFIDENCE[s.confidence][1]}`}>{CONFIDENCE[s.confidence][0]}</span></td>
                    <td className="small">{s.reason}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button disabled={busy} aria-label={`Accept the suggestion for ${line(s.code).name}`} onClick={() => void run(() => apply(line(s.code).id, s.line, s.nature))}>
                        Accept
                      </button>{' '}
                      <button className="link" aria-label={`Dismiss the suggestion for ${line(s.code).name}`} onClick={() => setFound({ ...found!, suggestions: found!.suggestions.filter((x) => x.code !== s.code) })}>
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            {open.some((s) => s.confidence === 'high') && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    for (const s of open.filter((x) => x.confidence === 'high')) await apply(line(s.code).id, s.line, s.nature);
                  })
                }
              >
                Accept the {open.filter((s) => s.confidence === 'high').length} marked high
              </button>
            )}
            <span className="small muted">From {found!.model}. You remain responsible for the mapping.</span>
          </div>
        </>
      )}
    </div>
  );
}

export function MappingStep(ctx: Ctx) {
  const { eng, client, lines, locked, reload } = ctx;
  const [filter, setFilter] = useState<'all' | 'unmapped'>('all');
  const { error, run } = useAction();
  const unmapped = lines.filter((l) => !l.mapCode || !ITEM.has(l.mapCode));
  const shown = useMemo(
    () => (filter === 'all' ? lines : lines.filter((l) => !l.mapCode || !ITEM.has(l.mapCode))),
    [filter, lines],
  );

  const change = (lineId: string, mapCode: string | null, nature: Nature | null) =>
    run(async () => {
      const line = lines.find((l) => l.id === lineId)!;
      await repo.setMapping(eng.id, client.id, line, mapCode, normaliseNature(mapCode, nature));
      reload();
    });

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Mapping</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  return (
    <div className="stack">
      <div>
        <h2>Mapping</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Each account is mapped to a line in the financial statements. The suggestions come from account names, so review every line. Your choices are remembered for this client.
        </p>
      </div>
      <div className="row">
        <span className={`tag ${unmapped.length ? 'bad' : 'ok'}`}>
          {unmapped.length ? `${unmapped.length} not mapped` : 'All accounts mapped'}
        </span>
        <label className="row small">
          <input type="checkbox" checked={filter === 'unmapped'} onChange={(e) => setFilter(e.target.checked ? 'unmapped' : 'all')} />
          Show only unmapped
        </label>
      </div>
      <ErrorNote error={error} />
      {!locked && (
        <MappingAssist
          ctx={ctx}
          unmapped={unmapped}
          apply={async (lineId, mapCode, nature) => {
            await repo.setMapping(eng.id, client.id, lines.find((l) => l.id === lineId)!, mapCode, normaliseNature(mapCode, nature));
            reload();
          }}
        />
      )}
      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th className="num">Balance</th>
              <th>Statement line</th>
              <th>Nature</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td className="num">{fmt2(l.balance)}</td>
                <td>
                  <select
                    aria-label={`Statement line for ${l.name}`}
                    disabled={locked}
                    value={l.mapCode ?? ''}
                    onChange={(e) => void change(l.id, e.target.value || null, l.nature)}
                  >
                    <option value="">Not mapped</option>
                    {SECTIONS.map((s) => (
                      <optgroup key={s} label={SECTION_LABEL[s]}>
                        {CHART.filter((i) => i.section === s).map((i) => (
                          <option key={i.code} value={i.code}>
                            {i.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td>
                  {l.mapCode && NATURE_CODES.has(l.mapCode) ? (
                    <select
                      aria-label={`Nature of ${l.name}`}
                      disabled={locked}
                      value={l.nature ?? 'other'}
                      onChange={(e) => void change(l.id, l.mapCode, e.target.value as Nature)}
                    >
                      <option value="other">Bought-in</option>
                      <option value="staff">Staff cost</option>
                      <option value="depreciation">Depreciation</option>
                    </select>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Nature tags feed the statement of value added and the cash flow. Tag salaries and pensions as staff cost, and depreciation and amortisation as depreciation.
      </p>
    </div>
  );
}
