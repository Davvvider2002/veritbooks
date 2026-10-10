import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import { repo } from '../data';
import { CHART, ITEM, NATURE_CODES, SECTION_LABEL, type Section } from '../engine/chart';
import { validateTrialBalance } from '../engine/checks';
import { normaliseNature } from '../engine/mapping';
import { mergeImport } from '../engine/merge';
import { fmt2 } from '../engine/money';
import { parseTrialBalance, type ParseResult } from '../engine/parse';
import type { Nature } from '../engine/types';
import { ErrorNote, message, useAction } from '../ui';
import type { Ctx } from '../workspace';

async function readRows(file: File): Promise<unknown[][]> {
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

export function MappingStep({ eng, client, lines, locked, reload }: Ctx) {
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
