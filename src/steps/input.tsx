import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import { SOURCES } from '../content/sources';
import { Link } from 'react-router-dom';
import { repo } from '../data';
import type { MappingSuggestion } from '../data/repo';
import { CHART, ITEM, NATURE_CODES, SECTION_LABEL, type Section } from '../engine/chart';
import { validateTrialBalance } from '../engine/checks';
import { normaliseNature } from '../engine/mapping';
import { mergeYears } from '../engine/merge';
import { MAX_YEARS, placementProblems, readYears, slotFor, SLOTS, yearOfSlot, type Slot, type YearSet } from '../engine/years';
import { fmt2 } from '../engine/money';
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

type Placed = YearSet & { slot: Slot | null };

const SLOT_NAME: Record<Slot, string> = { current: 'current year', prior: 'prior year', prior2: 'year before' };

export function ImportStep({ eng, client, lines, adjustments, locked, reload }: Ctx) {
  const [sets, setSets] = useState<Placed[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const year = Number(eng.yearEnd.slice(0, 4));
  const checks = validateTrialBalance(lines);
  const withEarlier = lines.some((l) => l.prior2 !== null && l.prior2 !== undefined);

  const onFiles = async (list: FileList | null) => {
    setSets(null);
    setParseError(null);
    setNotice(null);
    const files = [...(list ?? [])];
    if (!files.length) return;
    try {
      const found: YearSet[] = [];
      for (const f of files.slice(0, MAX_YEARS)) found.push(...readYears(await readRows(f), f.name));
      const notes: string[] = [];
      if (files.length > MAX_YEARS) notes.push(`Only the first ${MAX_YEARS} files were read. Import up to three years at a time.`);
      if (found.length > MAX_YEARS) notes.push(`The files hold ${found.length} years. The latest ${MAX_YEARS} are shown.`);
      const latest = found.sort((x, y) => (y.year ?? 0) - (x.year ?? 0)).slice(0, MAX_YEARS);
      const taken = new Set<Slot>();
      setSets(
        latest.map((y) => {
          const slot = slotFor(y.year, eng.yearEnd);
          if (!slot || taken.has(slot)) return { ...y, slot: null };
          taken.add(slot);
          return { ...y, slot };
        }),
      );
      setNotice(notes.join(' ') || null);
    } catch (e) {
      setParseError(message(e));
    }
  };

  const chosen = (sets ?? []).filter((x) => x.slot !== null);
  const problems = sets ? placementProblems(sets.map((x) => x.slot)) : [];
  const ONE: Record<Slot, string> = { current: 'Import as current year', prior: 'Import as prior year', prior2: 'Import as the year before' };
  const label = chosen.length === 1 ? ONE[chosen[0].slot!] : `Import ${chosen.length} years`;

  const save = () =>
    run(async () => {
      const saved = await repo.savedMappings(client.id);
      const merged = mergeYears(lines, chosen.map((x) => ({ slot: x.slot!, lines: x.lines })), saved, adjustments);
      await repo.replaceLines(eng.id, merged);
      setSets(null);
      setNotice(`Imported ${chosen.map((x) => yearOfSlot(x.slot!, eng.yearEnd)).sort().reverse().join(', ')}.`);
      reload();
    });

  return (
    <div className="stack">
      <div>
        <h2>Trial balance</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Import the trial balance before closing entries, as CSV or Excel. The file needs a header row with the account name and either Debit and Credit columns or one Balance column.
          You can bring in up to three years at once: choose several files, or one file with a column for each year.
        </p>
      </div>

      {!locked && (
        <div className="card stack">
          <SourceGuide kind="tb" />
          <label className="field">
            <span>Trial balance files, up to three years</span>
            <input
              type="file"
              multiple
              aria-label="Trial balance files"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = '';
              }}
              style={{ padding: '6px 0' }}
            />
          </label>
          <p className="small muted" style={{ margin: 0 }}>
            VeritBooks reads the year from a column heading, the title above the header, or the file name, and places it against this engagement’s year end of {year}: {year} is the current year, {year - 1} the prior year and {year - 2} the year before. Check each one before importing.
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            No file to hand? Try the sample company:{' '}
            <a href="/samples/trial-balance-2025.csv" download>2025</a>, <a href="/samples/trial-balance-2024.csv" download>2024</a> and{' '}
            <a href="/samples/trial-balance-2023.csv" download>2023</a>, or <a href="/samples/trial-balance-3-years.csv" download>all three years in one file</a>.
          </p>
          <ErrorNote error={parseError ?? error} />
          {notice && <div className="banner info">{notice}</div>}
          {sets && (
            <div className="stack">
              <div className="scroll-x">
                <table className="data" aria-label="Years found">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Year found</th>
                      <th>Import as</th>
                      <th className="num">Accounts</th>
                      <th>Foots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((x, i) => {
                      const debits = x.lines.reduce((a, l) => a + Math.max(l.balance, 0), 0);
                      const credits = x.lines.reduce((a, l) => a + Math.max(-l.balance, 0), 0);
                      const what = `${x.file}${x.column ? `, ${x.column}` : ''}`;
                      const differs = x.slot && x.year !== null && yearOfSlot(x.slot, eng.yearEnd) !== x.year;
                      return (
                        <tr key={what + i}>
                          <td>
                            {x.file}
                            {x.column && <div className="small muted">Column {x.column}</div>}
                          </td>
                          <td>
                            {x.year ?? <span className="muted">Not found</span>}
                            {x.how && <div className="small muted">from the {x.how}</div>}
                          </td>
                          <td>
                            <select
                              aria-label={sets.length === 1 ? 'Which year is this file?' : `Which year is ${what}?`}
                              value={x.slot ?? ''}
                              onChange={(e) => setSets(sets.map((y, j) => (j === i ? { ...y, slot: (e.target.value || null) as Slot | null } : y)))}
                            >
                              <option value="">Leave out</option>
                              {SLOTS.map((sl) => (
                                <option key={sl} value={sl}>
                                  {yearOfSlot(sl, eng.yearEnd)}, {SLOT_NAME[sl]}
                                </option>
                              ))}
                            </select>
                            {differs && <div className="small" style={{ color: 'var(--warn, #8a5a00)' }}>The file says {x.year}.</div>}
                            {x.year !== null && !slotFor(x.year, eng.yearEnd) && !x.slot && (
                              <div className="small muted">{x.year} is outside this engagement’s three years.</div>
                            )}
                          </td>
                          <td className="num">{x.lines.length}</td>
                          <td>
                            {debits === credits ? <span className="tag ok">Foots</span> : <span className="tag warn">Out by {fmt2(Math.abs(debits - credits))}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sets.flatMap((x) => x.warnings.map((w) => `${x.file}${x.column ? ` (${x.column})` : ''}: ${w}`)).map((w) => (
                <div key={w} className="banner warn">{w}</div>
              ))}
              {problems.map((p) => (
                <div key={p} className="banner bad">{p}</div>
              ))}
              {chosen.some((x) => x.slot !== 'current') && !chosen.some((x) => x.slot === 'current') && lines.length === 0 && (
                <div className="banner warn">No current year is being imported. Earlier years can be brought in first, and the current year added later.</div>
              )}
              <div>
                <button className="primary" disabled={busy || problems.length > 0} onClick={() => void save()}>
                  {label}
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
                    {withEarlier && <th className="num">{year - 2}</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.code}</td>
                      <td>{l.name}</td>
                      <td className="num">{fmt2(l.balance)}</td>
                      <td className="num">{l.prior === null ? '' : fmt2(l.prior)}</td>
                      {withEarlier && <td className="num">{l.prior2 === null || l.prior2 === undefined ? '' : fmt2(l.prior2)}</td>}
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
