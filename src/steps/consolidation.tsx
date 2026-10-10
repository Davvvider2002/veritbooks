import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CHART, ITEM, SECTION_LABEL } from '../engine/chart';
import {
  ELIMINATION_CODES,
  eliminationNet,
  mergePeriods,
  type Associate,
  type Consolidated,
  type Elimination,
  type GroupEquity,
  type GroupSetup,
  type GroupSubsidiary,
} from '../engine/consolidation';
import { fmt, fmt2, parseAmount } from '../engine/money';
import { longDate } from '../engine/report';
import { repo } from '../data';
import { ErrorNote, Field, StatementTable, useAction, useLoad } from '../ui';
import type { Ctx, Group } from '../workspace';

const naira = (k: number | undefined) => (k ? String(k / 100) : '');
const kobo = (s: string) => parseAmount(s) ?? 0;
const newId = () => Math.random().toString(36).slice(2, 10);
const KIND = { associate: 'Associate', joint_venture: 'Joint venture' } as const;

export function ConsolidationStep(ctx: Ctx) {
  const { eng, client, statements, group, locked, reload } = ctx;
  const saved = eng.planning.group;
  const setup: GroupSetup = { subsidiaries: saved?.subsidiaries ?? [], eliminations: saved?.eliminations ?? [], associates: saved?.associates ?? [] };
  const { data, error: loadError } = useLoad(async () => ({ engagements: await repo.listEngagements(), clients: await repo.listClients() }), [eng.id]);
  const { busy, error, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const save = (next: GroupSetup) =>
    run(async () => {
      const empty = !next.subsidiaries.length && !next.eliminations.length && !next.associates?.length;
      await repo.updateEngagement(eng.id, { planning: { ...eng.planning, group: empty ? undefined : next } });
      setEditing(null);
      reload();
    });

  const year = eng.yearEnd.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const clientName = (id: string) => data?.clients.find((c) => c.id === id)?.name ?? 'Client';
  // Any other company's engagement can join, including one that is itself a parent, unless it already holds this one.
  const candidates = (data?.engagements ?? []).filter(
    (e) => e.id !== eng.id && e.clientId !== eng.clientId && !setup.subsidiaries.some((s) => s.engagementId === e.id) && !e.planning.group?.subsidiaries.some((s) => s.engagementId === eng.id),
  );
  const c = group?.cur ?? null;
  const isGroup = setup.subsidiaries.length > 0 || setup.associates!.length > 0;

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div>
          <h2>Consolidation</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Use this when {client.name} is the parent of a group, or holds an associate or joint venture. Each subsidiary has its own engagement in VeritBooks. Add them here and the software adds the statements line by line, removes the investment, and works out goodwill and non-controlling interests. Leave it empty for a company that stands alone.
          </p>
        </div>
        {!locked && isGroup && (
          <div className="banner warn">
            Read the assumptions before relying on these statements. A subsidiary held for part of a year is taken to earn its results evenly through that year. Unrealised profit is borne by the owners of the parent. A subsidiary’s reserves since acquisition sit in group retained earnings. Goodwill on a foreign subsidiary stays at its naira amount at acquisition. Where your group does not fit, use eliminations to correct the result, and say so in the file.
          </div>
        )}
        <ErrorNote error={loadError ?? error} />
        {statements.cur.unmappedCount > 0 && <div className="banner bad">The parent has accounts that are not mapped. Finish the mapping first.</div>}

        <div className="card stack">
          <h3>Subsidiaries</h3>
          {setup.subsidiaries.length === 0 ? (
            <span className="muted">None.{setup.associates!.length === 0 && ' This engagement is not a group.'}</span>
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
                    const g = c?.subs[i];
                    return (
                      <tr key={s.engagementId}>
                        <td>
                          {m?.name ? <Link to={`/engagements/${s.engagementId}`}>{m.name}</Link> : <span className="danger">Engagement not found</span>}
                          <div className="small row" style={{ gap: 6, marginTop: 2 }}>
                            {m?.status === 'locked' ? <span className="tag ok">Signed</span> : m?.status ? <span className="tag warn">In progress</span> : null}
                            {m?.isGroup && <span className="tag">Itself a group</span>}
                            {s.foreign && <span className="tag">{s.foreign.currency}</span>}
                            {s.acquired && <span className="tag">Bought {longDate(s.acquired)}</span>}
                            {s.disposed && <span className="tag">Sold {longDate(s.disposed)}</span>}
                            {m?.yearEnd && m.yearEnd !== eng.yearEnd && <span className="tag bad">Year end {longDate(m.yearEnd)}</span>}
                            {g && g.bargainGain > 0 && <span className="tag">Bargain purchase</span>}
                          </div>
                        </td>
                        <td className="num">{s.ownership}%</td>
                        <td className="num">{fmt2(s.cost)}</td>
                        <td className="num">{g ? fmt2(g.shareOfNetAssets) : ''}</td>
                        <td className="num">{g ? fmt2(g.carrying) : ''}</td>
                        <td className="num">{g ? fmt2(g.nci) : ''}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {!locked && (
                            <>
                              <button className="link" aria-label={`Edit ${m?.name ?? 'subsidiary'}`} onClick={() => setEditing(s.engagementId)}>
                                Edit
                              </button>{' '}
                              <button
                                className="link danger"
                                disabled={busy}
                                aria-label={`Remove ${m?.name ?? 'subsidiary'} from the group`}
                                onClick={() => void save({ ...setup, subsidiaries: setup.subsidiaries.filter((x) => x.engagementId !== s.engagementId) })}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!locked && editing && setup.subsidiaries.some((s) => s.engagementId === editing) ? (
            <SubsidiaryForm
              key={editing}
              busy={busy}
              years={[year, lastYear]}
              initial={setup.subsidiaries.find((s) => s.engagementId === editing)!}
              options={[{ id: editing, label: group?.members.find((m) => m.engagementId === editing)?.name ?? 'Subsidiary' }]}
              cancel={() => setEditing(null)}
              submit={(s) => save({ ...setup, subsidiaries: setup.subsidiaries.map((x) => (x.engagementId === s.engagementId ? s : x)) })}
            />
          ) : (
            !locked && (
              <SubsidiaryForm
                key={`new-${setup.subsidiaries.length}`}
                busy={busy}
                years={[year, lastYear]}
                options={candidates.map((e) => ({
                  id: e.id,
                  label: `${clientName(e.clientId)}, year ended ${longDate(e.yearEnd)}${e.yearEnd === eng.yearEnd ? '' : ' (different year end)'}${e.planning.group?.subsidiaries.length ? ' (itself a group)' : ''}`,
                }))}
                submit={(s) => save({ ...setup, subsidiaries: [...setup.subsidiaries, s] })}
              />
            )
          )}
        </div>

        <div className="card stack">
          <h3>Associates and joint ventures</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Companies the parent influences or controls jointly, but does not control. The IFRS for SMEs lets you carry them at cost or by the equity method. No engagement is needed for them: enter the figures from their accounts.
          </p>
          {setup.associates!.length === 0 ? (
            <span className="muted">None.</span>
          ) : (
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Method</th>
                    <th className="num">Held</th>
                    <th className="num">Cost</th>
                    <th className="num">Carried in the group</th>
                    <th className="num">Share of profit, {year}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {setup.associates!.map((a) => {
                    const r = c?.associates.find((x) => x.id === a.id);
                    return (
                      <tr key={a.id}>
                        <td>
                          {a.name}
                          <div className="small muted">{KIND[a.kind]}</div>
                        </td>
                        <td>{a.method === 'equity' ? 'Equity method' : 'At cost'}</td>
                        <td className="num">{a.ownership}%</td>
                        <td className="num">{fmt2(a.cost)}</td>
                        <td className="num">{r ? fmt2(r.carrying) : fmt2(a.cost)}</td>
                        <td className="num">{a.method === 'equity' ? fmt2(a.share) : ''}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!locked && (
                            <button className="link danger" disabled={busy} aria-label={`Remove ${a.name}`} onClick={() => void save({ ...setup, associates: setup.associates!.filter((x) => x.id !== a.id) })}>
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
          {!locked && <AssociateForm key={setup.associates!.length} busy={busy} years={[year, lastYear]} submit={(a) => save({ ...setup, associates: [...setup.associates!, a] })} />}
        </div>

        {setup.subsidiaries.length > 0 && (
          <div className="card stack">
            <h3>Intercompany eliminations</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Remove what the group companies owe each other and sold to each other, and any profit on goods still held in the group. Enter each one on the lines of the statements. Debits must equal credits. To remove a dividend paid to the parent, debit Other income and credit Dividends declared. Bring forward a profit eliminated at the last year end by debiting Group reserves brought forward.
            </p>
            {setup.eliminations.length === 0 && <span className="muted">None entered.</span>}
            {setup.eliminations.map((e) => (
              <div className="journal" key={e.id}>
                <div className="between">
                  <strong>{e.description}</strong>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="tag">{e.period === 'current' ? year : lastYear}</span>
                    {eliminationNet(e) !== 0 && <span className="tag bad">Out by {fmt2(Math.abs(eliminationNet(e)))}</span>}
                    {!locked && (
                      <button className="link danger" disabled={busy} aria-label={`Remove elimination ${e.description}`} onClick={() => void save({ ...setup, eliminations: setup.eliminations.filter((x) => x.id !== e.id) })}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                <div className="small muted">
                  {e.lines.map((l) => `${l.amount > 0 ? 'Dr' : 'Cr'} ${l.code === 'retained_earnings' ? 'Group reserves brought forward' : (ITEM.get(l.code)?.label ?? l.code)} ${fmt2(Math.abs(l.amount))}`).join(' · ')}
                </div>
              </div>
            ))}
            {!locked && <NewElimination busy={busy} year={year} hasPrior={!!group?.prior} add={(e) => save({ ...setup, eliminations: [...setup.eliminations, e] })} />}
          </div>
        )}

        {group && !c && <div className="banner bad">A subsidiary’s engagement could not be read, so the group cannot be consolidated. Remove it from the list, or restore the engagement.</div>}
        {c && group && (
          <>
            {c.warnings.map((w) => (
              <div className="banner warn" key={w}>{w}</div>
            ))}
            {group.members.some((m) => m.yearEnd && m.yearEnd !== eng.yearEnd) && (
              <div className="banner bad">A subsidiary has a different year end. Its figures are for a different period and should not be added to the parent’s as they stand.</div>
            )}
            <div className={`banner ${c.difference === 0 && c.unbalanced.length === 0 ? 'info' : 'bad'}`}>
              {c.unbalanced.length > 0
                ? `${c.unbalanced.length} elimination(s) do not balance, so the consolidation is out by ${fmt2(Math.abs(c.difference))}.`
                : c.difference === 0
                  ? `The consolidation balances. Total assets ${fmt2(c.totalAssets)}.`
                  : `The consolidation is out by ${fmt2(Math.abs(c.difference))}. Check that every company’s own statement of financial position balances.`}
              {!group.prior && ' Comparatives, changes in equity and cash flows are not shown, because the parent or a subsidiary holds no prior year.'}
            </div>
            {group.equity && group.equity.unexplained !== 0 && (
              <div className="banner bad">
                {fmt2(Math.abs(group.equity.unexplained))} of the movement in group equity is not explained by the year’s results. The usual causes: a dividend from a subsidiary left in the parent’s income, a profit eliminated at the last year end and not brought forward, or figures at an acquisition or disposal that do not agree to the books. It shows in the statement of changes in equity.
              </div>
            )}
            {group.prior && group.blocker && (
              <div className="banner warn">The consolidated statement of cash flows cannot be drawn from this file. {group.blocker} Prepare it outside VeritBooks and attach it in Evidence.</div>
            )}
            <Worksheet c={c} year={year} />
            <div className="between">
              <span className="small muted">The consolidated statements follow. They print without this working.</span>
              <button onClick={() => window.print()}>Print or save as PDF</button>
            </div>
          </>
        )}
      </div>

      {c && group && <Sheets ctx={ctx} c={c} group={group} setup={setup} />}
    </div>
  );
}

function Sheets({ ctx, c, group, setup }: { ctx: Ctx; c: Consolidated; group: Group; setup: GroupSetup }) {
  const { eng, client, locked } = ctx;
  const year = eng.yearEnd.slice(0, 4);
  const prior = group.prior ? String(Number(year) - 1) : null;
  const Head = ({ title, sub }: { title: string; sub?: string }) => (
    <>
      {!locked && <div className="draft-mark">DRAFT · NOT SIGNED</div>}
      <div className="entity">{client.name} and its subsidiaries</div>
      <h2>{title}</h2>
      <div className="sub">{sub ?? `for the year ended ${longDate(eng.yearEnd)}`}</div>
    </>
  );
  const foreign = setup.subsidiaries.filter((s) => s.foreign);
  const changed = c.subs.some((s) => s.fraction < 1);
  let n = 0;
  return (
    <>
      <section className="sheet">
        <Head title="Consolidated statement of financial position" sub={`as at ${longDate(eng.yearEnd)}`} />
        <StatementTable rows={mergePeriods(c.position, group.prior?.position ?? null)} curLabel={year} priorLabel={prior} />
      </section>
      <section className="sheet">
        <Head title={c.oci !== 0 || (group.prior?.oci ?? 0) !== 0 ? 'Consolidated statement of profit or loss and other comprehensive income' : 'Consolidated statement of profit or loss'} />
        <StatementTable rows={mergePeriods(c.income, group.prior?.income ?? null)} curLabel={year} priorLabel={prior} />
      </section>
      {group.equity && (
        <section className="sheet">
          <Head title="Consolidated statement of changes in equity" />
          <EquityTable e={group.equity} />
        </section>
      )}
      {group.cashFlow && (
        <section className="sheet">
          <Head title="Consolidated statement of cash flows" />
          <StatementTable rows={group.cashFlow.rows} curLabel={year} />
        </section>
      )}
      <section className="sheet">
        <Head title="Notes to the consolidated financial statements" />
        <p className="small no-print" style={{ color: 'var(--warn)' }}>
          Starter wording. These notes cover the group matters only and add to the notes in the company’s own statements. Tailor them to the group.
        </p>
        <h3>{++n}. Basis of consolidation</h3>
        <p>
          The consolidated financial statements bring together the financial statements of {client.name} and the entities it controls. Control exists where the company has the power to govern the financial and operating policies of an entity so as to obtain benefits from its activities. Subsidiaries are consolidated from the date control is obtained until the date it ceases. Balances, transactions, income and expenses between group companies are eliminated in full, as are profits on goods still held within the group.
        </p>
        <p>
          Non-controlling interests are measured at their share of the net assets of the subsidiary. Goodwill is the excess of the cost of an acquisition over the group’s share of the fair value of the net assets acquired. It is carried at cost less accumulated amortisation and impairment, and is amortised over its estimated useful life.
          {changed && ' The results of a subsidiary acquired or sold during a year are included for the period it was controlled, apportioned on a time basis.'}
        </p>

        <h3>{++n}. Subsidiaries</h3>
        <table className="fs wide">
          <thead>
            <tr>
              <th></th>
              <th className="num">Held</th>
              <th>In the group</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {setup.subsidiaries.map((s, i) => (
              <tr key={s.engagementId}>
                <td>{c.subs[i].name}</td>
                <td className="num">{s.ownership}%</td>
                <td>{s.disposed ? `Until ${longDate(s.disposed)}` : s.acquired ? `From ${longDate(s.acquired)}` : 'Throughout both years'}</td>
                <td>{s.foreign?.currency ?? 'Naira'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {c.subs.some((s) => s.atAcquisition > 0) && (
          <>
            <h3>{++n}. Goodwill</h3>
            <table className="fs wide">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">On acquisition<br />₦</th>
                  <th className="num">Amortised to date<br />₦</th>
                  <th className="num">Charge for the year<br />₦</th>
                  <th className="num">Carrying amount<br />₦</th>
                </tr>
              </thead>
              <tbody>
                {c.subs.filter((s) => s.atAcquisition > 0).map((s) => (
                  <tr key={s.engagementId}>
                    <td>{s.name}</td>
                    <td className="num">{fmt(s.atAcquisition)}</td>
                    <td className="num">{fmt(-s.amortised)}</td>
                    <td className="num">{fmt(s.charge)}</td>
                    <td className="num">{fmt(s.carrying)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td></td>
                  <td className="num">{fmt(c.subs.reduce((a, s) => a + Math.max(s.atAcquisition, 0), 0))}</td>
                  <td className="num">{fmt(-c.subs.reduce((a, s) => a + s.amortised, 0))}</td>
                  <td className="num">{fmt(c.subs.reduce((a, s) => a + s.charge, 0))}</td>
                  <td className="num">{fmt(c.subs.reduce((a, s) => a + s.carrying, 0))}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {(c.nci !== 0 || c.nciProfit !== 0) && (
          <>
            <h3>{++n}. Non-controlling interests</h3>
            <table className="fs wide">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Held by others</th>
                  <th className="num">Share of profit<br />₦</th>
                  <th className="num">At end of year<br />₦</th>
                </tr>
              </thead>
              <tbody>
                {c.subs.filter((s) => s.nci !== 0 || s.nciProfit !== 0).map((s) => (
                  <tr key={s.engagementId}>
                    <td>{s.name}</td>
                    <td className="num">{Math.round((100 - s.ownership) * 100) / 100}%</td>
                    <td className="num">{fmt(s.nciProfit)}</td>
                    <td className="num">{fmt(s.nci)}</td>
                  </tr>
                ))}
                {c.nci !== c.subs.reduce((a, s) => a + s.nci, 0) && (
                  <tr>
                    <td>Outside shareholders within sub-groups</td>
                    <td></td>
                    <td className="num">{fmt(c.nciProfit - c.subs.reduce((a, s) => a + s.nciProfit, 0))}</td>
                    <td className="num">{fmt(c.nci - c.subs.reduce((a, s) => a + s.nci, 0))}</td>
                  </tr>
                )}
                <tr className="total">
                  <td></td>
                  <td></td>
                  <td className="num">{fmt(c.nciProfit)}</td>
                  <td className="num">{fmt(c.nci)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {c.associates.length > 0 && (
          <>
            <h3>{++n}. Associates and joint ventures</h3>
            <p>
              {c.associates.some((a) => a.method === 'equity') && 'Investments carried by the equity method are stated at cost plus the group’s share of the profits the investee has retained since it was acquired. '}
              {c.associates.some((a) => a.method === 'cost') && 'Investments carried at cost are stated at cost less impairment, and dividends are recognised as income when the right to receive them is established.'}
            </p>
            <table className="fs wide">
              <thead>
                <tr>
                  <th></th>
                  <th>Method</th>
                  <th className="num">Held</th>
                  <th className="num">Share of profit<br />₦</th>
                  <th className="num">Dividends received<br />₦</th>
                  <th className="num">Carrying amount<br />₦</th>
                </tr>
              </thead>
              <tbody>
                {c.associates.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name} ({KIND[a.kind].toLowerCase()})</td>
                    <td>{a.method === 'equity' ? 'Equity' : 'Cost'}</td>
                    <td className="num">{a.ownership}%</td>
                    <td className="num">{a.method === 'equity' ? fmt(a.share) : ''}</td>
                    <td className="num">{a.method === 'equity' ? fmt(a.dividends) : ''}</td>
                    <td className="num">{fmt(a.carrying)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {foreign.length > 0 && (
          <>
            <h3>{++n}. Foreign subsidiaries</h3>
            <p>
              The assets and liabilities of a subsidiary that reports in another currency are translated into naira at the rate at the year end. Its income and expenses are translated at the average rate for the year. The resulting exchange differences are recognised in other comprehensive income and accumulated in equity. Goodwill arising on the acquisition of a foreign subsidiary is carried at the naira amount determined at acquisition.
            </p>
            <table className="fs wide">
              <thead>
                <tr>
                  <th>Naira to one unit</th>
                  <th className="num">Year end {year}</th>
                  <th className="num">Average {year}</th>
                  {prior && <th className="num">Year end {prior}</th>}
                  {prior && <th className="num">Average {prior}</th>}
                </tr>
              </thead>
              <tbody>
                {foreign.map((s) => (
                  <tr key={s.engagementId}>
                    <td>{s.foreign!.currency}</td>
                    <td className="num">{s.foreign!.closing}</td>
                    <td className="num">{s.foreign!.average}</td>
                    {prior && <td className="num">{s.foreign!.closingPrior}</td>}
                    {prior && <td className="num">{s.foreign!.averagePrior}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}

function EquityTable({ e }: { e: GroupEquity }) {
  return (
    <div className="scroll-x">
      <table className="fs wide equity7">
        <thead>
          <tr>
            <th></th>
            {e.columns.map((col) => (
              <th key={col} className="num">{col}<br />₦</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {e.rows.map((r) => (
            <tr key={r.label} className={r.style}>
              <td>{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className="num">{fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
                i.code === 'finance_costs' && c.associateShare !== 0 && (
                  <tr key="assoc">
                    <td>Share of profit of associates and joint ventures (income)</td>
                    {c.columns.map((_, n) => (
                      <td key={n}></td>
                    ))}
                    <td className="num">{fmt(c.associateShare)}</td>
                    <td className="num"><strong>{fmt(c.associateShare)}</strong></td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Subsidiaries are shown in naira, for the part of the year they were in the group. Each company’s own equity is left out of its column: the group’s equity is the parent’s, plus its share of what each subsidiary has earned since acquisition, less goodwill written off and unrealised profit.
      </p>
    </div>
  );
}

function SubsidiaryForm({
  options,
  submit,
  busy,
  initial,
  cancel,
  years,
}: {
  options: { id: string; label: string }[];
  submit: (s: GroupSubsidiary) => Promise<void>;
  busy: boolean;
  initial?: GroupSubsidiary;
  cancel?: () => void;
  years: [string, string];
}) {
  const fx = initial?.foreign;
  const [f, setF] = useState({
    engagementId: initial?.engagementId ?? '',
    ownership: initial ? String(initial.ownership) : '',
    cost: naira(initial?.cost),
    netAssets: initial ? String(initial.netAssets / 100) : '',
    amortised: naira(initial?.amortised),
    charge: naira(initial?.charge),
    chargePrior: naira(initial?.chargePrior),
    changed: !!(initial?.acquired || initial?.disposed),
    acquired: initial?.acquired ?? '',
    disposed: initial?.disposed ?? '',
    netAssetsAtDisposal: naira(initial?.netAssetsAtDisposal),
    foreign: !!fx,
    currency: fx?.currency ?? '',
    closing: fx ? String(fx.closing) : '',
    average: fx ? String(fx.average) : '',
    closingPrior: fx ? String(fx.closingPrior) : '',
    averagePrior: fx ? String(fx.averagePrior) : '',
    reservePriorEnd: naira(fx?.reservePriorEnd),
    differencePrior: naira(fx?.differencePrior),
  });
  const [problem, setProblem] = useState<string | null>(null);
  type K = keyof typeof f;
  const set = (k: K) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const money = (k: K, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="text" inputMode="decimal" value={f[k] as string} onChange={set(k)} />
    </Field>
  );
  if (options.length === 0)
    return (
      <p className="small muted" style={{ margin: 0 }}>
        To add a subsidiary, first open an engagement for it from the <Link to="/">engagements page</Link> and import its trial balance.
      </p>
    );
  const go = () => {
    const own = Number(f.ownership);
    const rate = (k: K) => Number(f[k]);
    if (!f.engagementId) return setProblem('Choose the subsidiary’s engagement.');
    if (!(own > 0 && own <= 100)) return setProblem('Enter the percentage held, above 0 and up to 100.');
    if (kobo(f.cost) <= 0) return setProblem('Enter the cost of the investment.');
    if (f.netAssets.trim() === '') return setProblem('Enter the subsidiary’s net assets when it was acquired. Goodwill depends on it.');
    if (kobo(f.charge) + kobo(f.chargePrior) > kobo(f.amortised)) return setProblem('Goodwill amortised to date cannot be less than the charges for this year and last year.');
    if (f.changed && !f.acquired && !f.disposed) return setProblem('Enter the date it was bought or sold, or untick the box.');
    if (f.changed && f.acquired && f.disposed && f.disposed <= f.acquired) return setProblem('The date sold must be after the date bought.');
    if (f.changed && f.disposed && f.netAssetsAtDisposal.trim() === '') return setProblem('Enter the subsidiary’s net assets on the day it was sold. The group’s gain or loss on the sale depends on it.');
    if (f.foreign) {
      if (!f.currency.trim()) return setProblem('Name the subsidiary’s currency.');
      if (!(['closing', 'average', 'closingPrior', 'averagePrior'] as K[]).every((k) => rate(k) > 0)) return setProblem('Enter all four exchange rates, as naira to one unit of the currency.');
    }
    setProblem(null);
    void submit({
      engagementId: f.engagementId,
      ownership: own,
      cost: kobo(f.cost),
      netAssets: kobo(f.netAssets),
      amortised: kobo(f.amortised),
      charge: kobo(f.charge),
      chargePrior: kobo(f.chargePrior),
      ...(f.changed && f.acquired ? { acquired: f.acquired } : {}),
      ...(f.changed && f.disposed ? { disposed: f.disposed, netAssetsAtDisposal: kobo(f.netAssetsAtDisposal) } : {}),
      ...(f.foreign
        ? { foreign: { currency: f.currency.trim().toUpperCase(), closing: rate('closing'), average: rate('average'), closingPrior: rate('closingPrior'), averagePrior: rate('averagePrior'), reservePriorEnd: kobo(f.reservePriorEnd), differencePrior: kobo(f.differencePrior) } }
        : {}),
    });
  };
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <strong>{initial ? 'Edit subsidiary' : 'Add a subsidiary'}</strong>
      <div className="grid2">
        <Field label="Subsidiary’s engagement">
          <select value={f.engagementId} disabled={!!initial} onChange={set('engagementId')}>
            {!initial && <option value="">Choose an engagement</option>}
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
        {money('cost', 'Cost of the investment (₦)', 'As carried in the parent’s own books, mapped to Investments.')}
        {money('netAssets', 'Subsidiary’s net assets when acquired (₦)', 'At fair value on the acquisition date. For a sub-group, the net assets belonging to its own shareholders.')}
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {money('amortised', 'Goodwill amortised to date (₦)', 'Up to the end of this year, or to the day it was sold, with any impairment.')}
        {money('charge', `Of which in ${years[0]} (₦)`)}
        {money('chargePrior', `And in ${years[1]} (₦)`)}
      </div>

      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={f.changed} onChange={(e) => setF({ ...f, changed: e.target.checked })} /> It was bought or sold during {years[1]} or {years[0]}
      </label>
      {f.changed && (
        <>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Field label="Date control was obtained" hint="Leave blank if it was held before both years.">
              <input type="date" value={f.acquired} onChange={set('acquired')} />
            </Field>
            <Field label="Date control was lost" hint="Leave blank if it is still held.">
              <input type="date" value={f.disposed} onChange={set('disposed')} />
            </Field>
            {money('netAssetsAtDisposal', 'Net assets on the day it was sold (₦)')}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Its income and expenses are included for the days it was held, as a share of the full year in its own engagement. That is right only if its results arose evenly. If they did not, correct the difference with an elimination.
          </p>
        </>
      )}

      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={f.foreign} onChange={(e) => setF({ ...f, foreign: e.target.checked })} /> Its trial balance is in a foreign currency
      </label>
      {f.foreign && (
        <>
          <div className="grid2" style={{ gridTemplateColumns: '120px 1fr 1fr 1fr 1fr' }}>
            <Field label="Currency">
              <input type="text" maxLength={3} value={f.currency} placeholder="GHS" onChange={set('currency')} />
            </Field>
            {(
              [
                ['closing', `Rate at ${years[0]} year end`],
                ['average', `Average rate, ${years[0]}`],
                ['closingPrior', `Rate at ${years[1]} year end`],
                ['averagePrior', `Average rate, ${years[1]}`],
              ] as [K, string][]
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input type="number" min={0} step="any" value={f[k] as string} onChange={set(k)} />
              </Field>
            ))}
          </div>
          <div className="grid2">
            {money('reservePriorEnd', `Group’s share of exchange differences to the end of ${years[1]} (₦)`, 'The translation reserve for this subsidiary in last year’s consolidated statements. Nil if this is the first consolidation.')}
            {money('differencePrior', `Exchange difference arising in ${years[1]} (₦)`, 'On the whole subsidiary, for last year’s column.')}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Rates are naira to one unit of the currency. The cost and net assets above stay in naira, at the rate on the acquisition date. This year’s exchange difference is worked out for you.
          </p>
        </>
      )}
      <ErrorNote error={problem} />
      <div className="row">
        <button className="primary" disabled={busy} onClick={go}>
          {initial ? 'Save subsidiary' : 'Add subsidiary'}
        </button>
        {cancel && <button onClick={cancel}>Cancel</button>}
      </div>
    </div>
  );
}

function AssociateForm({ submit, busy, years }: { submit: (a: Associate) => Promise<void>; busy: boolean; years: [string, string] }) {
  const blank = { name: '', kind: 'associate' as Associate['kind'], method: 'equity' as Associate['method'], ownership: '', cost: '', carryingStartPrior: '', share: '', dividends: '', sharePrior: '', dividendsPrior: '' };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [problem, setProblem] = useState<string | null>(null);
  type K = keyof typeof blank;
  const set = (k: K) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const money = (k: K, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="text" inputMode="decimal" value={f[k]} onChange={set(k)} />
    </Field>
  );
  if (!open) return <div><button onClick={() => setOpen(true)}>Add an associate or joint venture</button></div>;
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
      <div className="grid2">
        <Field label="Name of the investee">
          <input type="text" maxLength={200} value={f.name} onChange={set('name')} />
        </Field>
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 110px' }}>
          <Field label="Kind">
            <select value={f.kind} onChange={set('kind')}>
              <option value="associate">Associate</option>
              <option value="joint_venture">Joint venture</option>
            </select>
          </Field>
          <Field label="Carried">
            <select value={f.method} onChange={set('method')}>
              <option value="equity">By the equity method</option>
              <option value="cost">At cost</option>
            </select>
          </Field>
          <Field label="Held, %">
            <input type="number" min={0} max={100} step="0.01" value={f.ownership} onChange={set('ownership')} />
          </Field>
        </div>
      </div>
      <div className="grid2">
        {money('cost', 'Cost (₦)', 'As carried in the parent’s own books, mapped to Investments.')}
        {f.method === 'equity' && money('carryingStartPrior', `Carrying amount at the start of ${years[1]} (₦)`, 'Cost plus the group’s share of profits kept by the investee up to then.')}
      </div>
      {f.method === 'equity' && (
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          {money('share', `Share of profit, ${years[0]} (₦)`, 'After tax. Negative for a loss.')}
          {money('dividends', `Dividends received, ${years[0]} (₦)`)}
          {money('sharePrior', `Share of profit, ${years[1]} (₦)`)}
          {money('dividendsPrior', `Dividends received, ${years[1]} (₦)`)}
        </div>
      )}
      <ErrorNote error={problem} />
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            const own = Number(f.ownership);
            if (!f.name.trim()) return setProblem('Name the investee.');
            if (!(own > 0 && own <= 100)) return setProblem('Enter the percentage held, above 0 and up to 100.');
            if (kobo(f.cost) <= 0) return setProblem('Enter the cost of the investment.');
            if (f.method === 'equity' && f.carryingStartPrior.trim() === '') return setProblem(`Enter the carrying amount at the start of ${years[1]}. If it was bought later, enter its cost.`);
            setProblem(null);
            void submit({ id: newId(), name: f.name.trim(), kind: f.kind, method: f.method, ownership: own, cost: kobo(f.cost), carryingStartPrior: kobo(f.carryingStartPrior), share: kobo(f.share), dividends: kobo(f.dividends), sharePrior: kobo(f.sharePrior), dividendsPrior: kobo(f.dividendsPrior) });
          }}
        >
          Add to the group
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
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
