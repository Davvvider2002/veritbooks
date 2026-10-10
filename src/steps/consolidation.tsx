import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CHART, ITEM, SECTION_LABEL } from '../engine/chart';
import { ELIMINATION_CODES, eliminationNet, mergePeriods, type Consolidated, type Elimination, type GroupSetup, type GroupSubsidiary } from '../engine/consolidation';
import { fmt, fmt2, parseAmount } from '../engine/money';
import { longDate } from '../engine/report';
import { repo } from '../data';
import { ErrorNote, Field, StatementTable, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';

const kobo = (s: string) => parseAmount(s) ?? 0;
const newId = () => Math.random().toString(36).slice(2, 10);

export function ConsolidationStep(ctx: Ctx) {
  const { eng, client, statements, group, locked, reload } = ctx;
  const setup: GroupSetup = eng.planning.group ?? { subsidiaries: [], eliminations: [] };
  const { data, error: loadError } = useLoad(async () => ({ engagements: await repo.listEngagements(), clients: await repo.listClients() }), [eng.id]);
  const { busy, error, run } = useAction();
  const save = (next: GroupSetup) =>
    run(async () => {
      await repo.updateEngagement(eng.id, { planning: { ...eng.planning, group: next.subsidiaries.length || next.eliminations.length ? next : undefined } });
      reload();
    });

  const year = eng.yearEnd.slice(0, 4);
  const clientName = (id: string) => data?.clients.find((c) => c.id === id)?.name ?? 'Client';
  const candidates = (data?.engagements ?? []).filter(
    (e) => e.id !== eng.id && e.clientId !== eng.clientId && !setup.subsidiaries.some((s) => s.engagementId === e.id) && !e.planning.group?.subsidiaries.length,
  );
  const c = group?.cur ?? null;

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div>
          <h2>Consolidation</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Use this when {client.name} is the parent of a group. Each subsidiary has its own engagement in VeritBooks. Add them here and the software adds the statements line by line, removes the investment, and works out goodwill and non-controlling interests. Leave it empty for a company with no subsidiaries.
          </p>
        </div>
        {!locked && (
          <div className="banner warn">
            First version. It assumes each subsidiary was held for the whole of both years at the same percentage, with the same year end. It produces the consolidated statement of financial position and statement of profit or loss. It does not yet produce the consolidated cash flow, changes in equity or notes, or the wording of a group audit report. Acquisitions and disposals in the year, associates, joint ventures and foreign subsidiaries need to be dealt with outside it.
          </div>
        )}
        <ErrorNote error={loadError ?? error} />
        {statements.cur.unmappedCount > 0 && <div className="banner bad">The parent has accounts that are not mapped. Finish the mapping first.</div>}

        <div className="card stack">
          <h3>Subsidiaries</h3>
          {setup.subsidiaries.length === 0 ? (
            <span className="muted">None. This engagement is not a group.</span>
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Subsidiary</th>
                    <th className="num">Held</th>
                    <th className="num">Cost</th>
                    <th className="num">Share of net assets acquired</th>
                    <th className="num">Goodwill carried</th>
                    <th className="num">Non-controlling interests</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {setup.subsidiaries.map((s, i) => {
                    const m = group?.members[i];
                    const g = c?.goodwill[i];
                    return (
                      <tr key={s.engagementId}>
                        <td>
                          {m?.name ? <Link to={`/engagements/${s.engagementId}`}>{m.name}</Link> : <span className="danger">Engagement not found</span>}
                          <div className="small">
                            {m?.status === 'locked' ? <span className="tag ok">Signed</span> : m?.status ? <span className="tag warn">In progress</span> : null}
                            {m?.yearEnd && m.yearEnd !== eng.yearEnd && <span className="tag bad" style={{ marginLeft: 6 }}>Year end {longDate(m.yearEnd)}</span>}
                            {g && g.bargainGain > 0 && <span className="tag" style={{ marginLeft: 6 }}>Bargain purchase</span>}
                          </div>
                        </td>
                        <td className="num">{s.ownership}%</td>
                        <td className="num">{fmt2(s.cost)}</td>
                        <td className="num">{g ? fmt2(g.shareOfNetAssets) : ''}</td>
                        <td className="num">{g ? fmt2(g.carrying) : ''}</td>
                        <td className="num">{g ? fmt2(g.nci) : ''}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!locked && (
                            <button
                              className="link danger"
                              disabled={busy}
                              aria-label={`Remove ${m?.name ?? 'subsidiary'} from the group`}
                              onClick={() => void save({ ...setup, subsidiaries: setup.subsidiaries.filter((x) => x.engagementId !== s.engagementId) })}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!locked && (
            <NewSubsidiary
              busy={busy}
              options={candidates.map((e) => ({ id: e.id, label: `${clientName(e.clientId)}, year ended ${longDate(e.yearEnd)}${e.yearEnd === eng.yearEnd ? '' : ' (different year end)'}` }))}
              add={(s) => save({ ...setup, subsidiaries: [...setup.subsidiaries, s] })}
            />
          )}
        </div>

        {setup.subsidiaries.length > 0 && (
          <div className="card stack">
            <h3>Intercompany eliminations</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Remove what the group companies owe each other and sold to each other, and any profit on goods still held in the group. Enter each one on the lines of the statements. Debits must equal credits. To remove a dividend paid to the parent, debit Other income and credit Dividends declared.
            </p>
            {setup.eliminations.length === 0 && <span className="muted">None entered.</span>}
            {setup.eliminations.map((e) => (
              <div className="journal" key={e.id}>
                <div className="between">
                  <strong>{e.description}</strong>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="tag">{e.period === 'current' ? year : Number(year) - 1}</span>
                    {eliminationNet(e) !== 0 && <span className="tag bad">Out by {fmt2(Math.abs(eliminationNet(e)))}</span>}
                    {!locked && (
                      <button className="link danger" disabled={busy} aria-label={`Remove elimination ${e.description}`} onClick={() => void save({ ...setup, eliminations: setup.eliminations.filter((x) => x.id !== e.id) })}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                <div className="small muted">
                  {e.lines.map((l) => `${l.amount > 0 ? 'Dr' : 'Cr'} ${ITEM.get(l.code)?.label ?? l.code} ${fmt2(Math.abs(l.amount))}`).join(' · ')}
                </div>
              </div>
            ))}
            {!locked && <NewElimination busy={busy} year={year} hasPrior={!!group?.prior} add={(e) => save({ ...setup, eliminations: [...setup.eliminations, e] })} />}
          </div>
        )}

        {group && !c && <div className="banner bad">A subsidiary’s engagement could not be read, so the group cannot be consolidated. Remove it from the list, or restore the engagement.</div>}
        {c && (
          <>
            {c.warnings.map((w) => (
              <div className="banner warn" key={w}>{w}</div>
            ))}
            {group!.members.some((m) => m.yearEnd && m.yearEnd !== eng.yearEnd) && (
              <div className="banner bad">A subsidiary has a different year end. Its figures are for a different period and should not be added to the parent’s as they stand.</div>
            )}
            <div className={`banner ${c.difference === 0 && c.unbalanced.length === 0 ? 'info' : 'bad'}`}>
              {c.unbalanced.length > 0
                ? `${c.unbalanced.length} elimination(s) do not balance, so the consolidation is out by ${fmt2(Math.abs(c.difference))}.`
                : c.difference === 0
                  ? `The consolidation balances. Total assets ${fmt2(c.totalAssets)}.`
                  : `The consolidation is out by ${fmt2(Math.abs(c.difference))}. Check that every company’s own statement of financial position balances.`}
              {!group!.prior && ' Comparatives are not shown, because the parent or a subsidiary holds no prior year.'}
            </div>
            <Worksheet c={c} year={year} />
            <div className="between">
              <span className="small muted">The consolidated statements follow. They print without this working.</span>
              <button onClick={() => window.print()}>Print or save as PDF</button>
            </div>
          </>
        )}
      </div>

      {c && (
        <>
          <section className="sheet">
            {!locked && <div className="draft-mark">DRAFT · NOT SIGNED</div>}
            <div className="entity">{client.name} and its subsidiaries</div>
            <h2>Consolidated statement of financial position</h2>
            <div className="sub">as at {longDate(eng.yearEnd)}</div>
            <StatementTable rows={mergePeriods(c.position, group!.prior?.position ?? null)} curLabel={year} priorLabel={group!.prior ? String(Number(year) - 1) : null} />
          </section>
          <section className="sheet">
            {!locked && <div className="draft-mark">DRAFT · NOT SIGNED</div>}
            <div className="entity">{client.name} and its subsidiaries</div>
            <h2>Consolidated statement of profit or loss</h2>
            <div className="sub">for the year ended {longDate(eng.yearEnd)}</div>
            <StatementTable rows={mergePeriods(c.income, group!.prior?.income ?? null)} curLabel={year} priorLabel={group!.prior ? String(Number(year) - 1) : null} />
          </section>
        </>
      )}
    </div>
  );
}

/** Each company, the adjustments and the group, side by side, so every group figure can be followed across. */
function Worksheet({ c, year }: { c: Consolidated; year: string }) {
  const rows = CHART.filter((i) => c.v[i.code] !== 0 || c.adjustments[i.code] !== 0 || c.columns.some((col) => col.v[i.code] !== 0));
  const equity = new Set(['share_capital', 'share_premium', 'other_reserves', 'retained_earnings']);
  const across = (code: string) => c.columns.reduce((a, col) => a + col.v[code], 0);
  let section = '';
  return (
    <div className="card stack">
      <h3>Consolidation working, {year}</h3>
      <div className="scroll-x">
        <table className="data worksheet">
          <thead>
            <tr>
              <th>Line</th>
              {c.columns.map((col, i) => (
                <th className="num" key={i}>{col.name}</th>
              ))}
              <th className="num">Adjustments</th>
              <th className="num">Group</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const head = i.section !== section ? ((section = i.section), SECTION_LABEL[i.section]) : null;
              // For equity lines the adjustment is whatever takes the companies' own equity to the group's.
              const adjustment = equity.has(i.code) ? c.v[i.code] - across(i.code) : c.adjustments[i.code];
              return [
                head && (
                  <tr key={`h-${i.section}`} className="section">
                    <td colSpan={c.columns.length + 3}>{head}</td>
                  </tr>
                ),
                <tr key={i.code}>
                  <td>{i.code === 'retained_earnings' ? 'Retained earnings brought forward, and group reserves' : i.label}</td>
                  {c.columns.map((col, n) => (
                    <td className="num" key={n}>{fmt(col.v[i.code])}</td>
                  ))}
                  <td className="num">{fmt(adjustment)}</td>
                  <td className="num"><strong>{fmt(c.v[i.code])}</strong></td>
                </tr>,
                i.code === 'retained_earnings' && (
                  <tr key="nci">
                    <td>Non-controlling interests</td>
                    {c.columns.map((_, n) => (
                      <td key={n}></td>
                    ))}
                    <td className="num">{fmt(c.nci)}</td>
                    <td className="num"><strong>{fmt(c.nci)}</strong></td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Each company’s retained earnings are shown as brought forward, before the year’s profit. The group figure is the closing reserve: the parent’s, plus its share of what each subsidiary has earned since acquisition, less goodwill written off and unrealised profit.
      </p>
    </div>
  );
}

function NewSubsidiary({ options, add, busy }: { options: { id: string; label: string }[]; add: (s: GroupSubsidiary) => Promise<void>; busy: boolean }) {
  const blank = { engagementId: '', ownership: '', cost: '', netAssets: '', amortised: '', charge: '', chargePrior: '' };
  const [f, setF] = useState(blank);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (options.length === 0)
    return (
      <p className="small muted" style={{ margin: 0 }}>
        To add a subsidiary, first open an engagement for it from the <Link to="/">engagements page</Link> and import its trial balance. A company that is itself a parent here cannot be added.
      </p>
    );
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <strong>Add a subsidiary</strong>
      <div className="grid2">
        <Field label="Subsidiary’s engagement">
          <select value={f.engagementId} onChange={set('engagementId')}>
            <option value="">Choose an engagement</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Percentage held by the parent">
          <input type="number" min={0} max={100} step="0.01" value={f.ownership} onChange={set('ownership')} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Cost of the investment (₦)" hint="As carried in the parent’s own books, mapped to Investments.">
          <input type="text" inputMode="decimal" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="Subsidiary’s net assets when acquired (₦)" hint="At fair value on the acquisition date.">
          <input type="text" inputMode="decimal" value={f.netAssets} onChange={set('netAssets')} />
        </Field>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Field label="Goodwill amortised to date (₦)" hint="Up to the end of this year, with any impairment.">
          <input type="text" inputMode="decimal" value={f.amortised} onChange={set('amortised')} />
        </Field>
        <Field label="Of which this year (₦)">
          <input type="text" inputMode="decimal" value={f.charge} onChange={set('charge')} />
        </Field>
        <Field label="And last year (₦)">
          <input type="text" inputMode="decimal" value={f.chargePrior} onChange={set('chargePrior')} />
        </Field>
      </div>
      <ErrorNote error={problem} />
      <div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            const own = Number(f.ownership);
            if (!f.engagementId) return setProblem('Choose the subsidiary’s engagement.');
            if (!(own > 0 && own <= 100)) return setProblem('Enter the percentage held, above 0 and up to 100.');
            if (kobo(f.cost) <= 0) return setProblem('Enter the cost of the investment.');
            if (f.netAssets.trim() === '') return setProblem('Enter the subsidiary’s net assets when it was acquired. Goodwill depends on it.');
            if (kobo(f.charge) + kobo(f.chargePrior) > kobo(f.amortised)) return setProblem('Goodwill amortised to date cannot be less than the charges for this year and last year.');
            setProblem(null);
            void add({ engagementId: f.engagementId, ownership: own, cost: kobo(f.cost), netAssets: kobo(f.netAssets), amortised: kobo(f.amortised), charge: kobo(f.charge), chargePrior: kobo(f.chargePrior) }).then(() => setF(blank));
          }}
        >
          Add subsidiary
        </button>
      </div>
    </div>
  );
}

function NewElimination({ add, busy, year, hasPrior }: { add: (e: Elimination) => Promise<void>; busy: boolean; year: string; hasPrior: boolean }) {
  const blankLine = { code: '', debit: '', credit: '' };
  const [description, setDescription] = useState('');
  const [period, setPeriod] = useState<'current' | 'prior'>('current');
  const [lines, setLines] = useState([blankLine, blankLine]);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (i: number, patch: Partial<typeof blankLine>) => setLines(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const built = lines.filter((l) => l.code && (kobo(l.debit) || kobo(l.credit))).map((l) => ({ code: l.code, amount: kobo(l.debit) - kobo(l.credit) }));
  const net = built.reduce((a, l) => a + l.amount, 0);
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <strong>New elimination</strong>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 160px' }}>
        <Field label="What is being eliminated">
          <input type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Year">
          <select value={period} onChange={(e) => setPeriod(e.target.value as 'current' | 'prior')}>
            <option value="current">{year}</option>
            {hasPrior && <option value="prior">{Number(year) - 1}</option>}
          </select>
        </Field>
      </div>
      {lines.map((l, i) => (
        <div className="row" key={i}>
          <select aria-label={`Statement line, entry ${i + 1}`} value={l.code} onChange={(e) => set(i, { code: e.target.value })} style={{ flex: 2, minWidth: 200 }}>
            <option value="">Statement line</option>
            {ELIMINATION_CODES.map((code) => (
              <option key={code} value={code}>{code === 'retained_earnings' ? 'Group reserves brought forward' : ITEM.get(code)!.label}</option>
            ))}
          </select>
          <input type="text" inputMode="decimal" aria-label={`Debit, entry ${i + 1}`} placeholder="Debit" value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: '' })} style={{ flex: 1, minWidth: 110 }} />
          <input type="text" inputMode="decimal" aria-label={`Credit, entry ${i + 1}`} placeholder="Credit" value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: '' })} style={{ flex: 1, minWidth: 110 }} />
        </div>
      ))}
      <div className="row">
        <button onClick={() => setLines([...lines, blankLine])}>Add an entry</button>
        <span className={`small ${net === 0 ? 'muted' : 'danger'}`}>{built.length === 0 ? '' : net === 0 ? 'Debits equal credits.' : `Out by ${fmt2(Math.abs(net))}.`}</span>
      </div>
      <ErrorNote error={problem} />
      <div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            if (!description.trim()) return setProblem('Say what is being eliminated.');
            if (built.length < 2) return setProblem('An elimination needs at least two entries.');
            if (net !== 0) return setProblem(`Debits and credits differ by ${fmt2(Math.abs(net))}.`);
            setProblem(null);
            void add({ id: newId(), description: description.trim(), period, lines: built }).then(() => {
              setDescription('');
              setLines([blankLine, blankLine]);
            });
          }}
        >
          Save elimination
        </button>
      </div>
    </div>
  );
}
