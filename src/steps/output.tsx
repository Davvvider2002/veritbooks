import { useState } from 'react';
import { POLICIES } from '../content/notes';
import { PROGRAMMES } from '../content/programmes';
import { repo } from '../data';
import { canSign, signOffChecks } from '../engine/checks';
import { directorList, disclosureGaps, financialSummary, ppeSchedule, priorEquity, taxReconciliation, type PpeRow } from '../engine/disclosures';
import type { EquityTable, Period } from '../engine/statements';
import { TracePanel } from './trace';
import { fmt } from '../engine/money';
import { draftReport, longDate } from '../engine/report';
import type { ReportSettings } from '../engine/types';
import { ErrorNote, Field, StatementTable, useAction, useLoad } from '../ui';
import type { Ctx } from '../workspace';
import { ChecksList } from './input';

function DraftMark({ locked }: { locked: boolean }) {
  return locked ? null : <div className="draft-mark">DRAFT · NOT SIGNED</div>;
}

function SheetHead({ ctx, title, sub }: { ctx: Ctx; title: string; sub?: string }) {
  return (
    <>
      <DraftMark locked={ctx.locked} />
      <div className="entity">{ctx.client.name}</div>
      <h2>{title}</h2>
      <div className="sub">{sub ?? `for the year ended ${longDate(ctx.eng.yearEnd)}`}</div>
    </>
  );
}

function EquityRows({ table }: { table: EquityTable }) {
  return (
    <div className="scroll-x">
      <table className="fs wide">
        <thead>
          <tr>
            <th></th>
            {table.columns.map((c) => (
              <th key={c} className="num">{c}<br />₦</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className={row.style}>
              <td>{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="num">{fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TBC = '[To be completed in Disclosures.]';

export function StatementsStep(ctx: Ctx) {
  const { eng, client, ws, lines, adjustments, statements: st } = ctx;
  const d = eng.disclosures;
  const gaps = disclosureGaps(d, st, lines, adjustments, eng.yearEnd);
  const ppe = ppeSchedule(lines, adjustments, st.cur, d.ppeDisposals);
  const tax = taxReconciliation(st.cur, d);
  const equityPrior = priorEquity(st);
  const summary = financialSummary(st, eng.yearEnd, d.earlierYears);
  const directors = directorList(d);
  const parties = (d.relatedParties ?? []).filter((x) => x.name.trim());
  const year = eng.yearEnd.slice(0, 4);
  const prior = st.hasPrior ? String(Number(year) - 1) : null;
  const r = eng.report;
  const [trace, setTrace] = useState<{ code: string; period: Period } | null>(null);
  const onTrace = (code: string, period: Period) => setTrace({ code, period });

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Financial statements</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const balanced = st.cur.totalAssets === st.cur.totalEquityAndLiabilities;
  const policies = Object.entries(POLICIES).filter(([code]) => st.notes.has(code));

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Financial statements</h2>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Select any figure on the statement of financial position or the statement of profit or loss to see the accounts, journals, ledger entries and files behind it.
        </p>
        {st.cur.unmappedCount > 0 && (
          <div className="banner bad">
            {st.cur.unmappedCount} account(s) are not mapped, so these statements are incomplete. Finish the mapping step.
          </div>
        )}
        {!balanced && st.cur.unmappedCount === 0 && (
          <div className="banner bad">The statement of financial position does not balance. Check that the trial balance foots.</div>
        )}
        {!st.hasPrior && (
          <div className="banner warn">No prior year has been imported, so there are no comparatives and no statement of cash flows.</div>
        )}
        {gaps.length > 0 && (
          <div className="banner warn">
            <strong>{gaps.length} disclosure item(s) are still open.</strong> Complete them in the Disclosures step before these statements are issued.
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="banner warn">
          The wording of the directors’ pages, the accounting policies and the notes is starter text. Have it reviewed against the current standards and tailored to this company before issue.
        </div>
      </div>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Report of the directors" />
        <p>
          The directors present their report and the financial statements of {client.name} for the year ended {longDate(eng.yearEnd)}.
        </p>
        <h3>Principal activity</h3>
        <p>{r.principalActivity ? `The principal activity of the company is ${r.principalActivity}.` : '[Describe the principal activity in the Report step.]'}</p>
        <h3>Results and dividends</h3>
        <table className="fs">
          <thead>
            <tr>
              <th></th>
              <th className="num">{year}<br />₦</th>
              {prior && <th className="num">{prior}<br />₦</th>}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Revenue', st.cur.v.revenue, st.prior?.v.revenue],
                ['Profit before tax', st.cur.pbt, st.prior?.pbt],
                ['Income tax expense', -st.cur.v.income_tax_expense, st.prior ? -st.prior.v.income_tax_expense : undefined],
                ['Profit for the year', st.cur.profit, st.prior?.profit],
                ['Dividends declared', st.cur.v.dividends, st.prior?.v.dividends],
              ] as [string, number, number | undefined][]
            ).map(([label, c, p]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="num">{fmt(c)}</td>
                {prior && <td className="num">{fmt(p)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Directors</h3>
        <p>
          {directors.length > 0 ? `The directors who served during the year were: ${directors.join(', ')}.` : TBC}
        </p>
        <h3>Property, plant and equipment</h3>
        <p>Movements in property, plant and equipment during the year are shown in the notes to the financial statements.</p>
        <h3>Employees</h3>
        <p>
          {d.employees !== undefined ? `The average number of persons employed by the company during the year was ${d.employees}.` : TBC}
        </p>
        <h3>Events after the reporting date</h3>
        <p>{d.subsequentEvents?.trim() || TBC}</p>
        <h3>Auditors</h3>
        <p>
          {eng.type === 'audit'
            ? `${ws.firm.name} have indicated their willingness to continue in office as auditors, in accordance with the Companies and Allied Matters Act 2020.`
            : 'These financial statements have not been audited.'}
        </p>
        <div className="sign-grid">
          <div className="sign-line">
            By order of the board
            <br />
            {d.secretary?.trim() || '[Company secretary]'}
            <br />
            Company Secretary
            <br />
            {d.registeredOffice?.trim() || '[Registered office]'}
          </div>
        </div>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of directors’ responsibilities" sub={`in relation to the financial statements for the year ended ${longDate(eng.yearEnd)}`} />
        <p>
          The Companies and Allied Matters Act 2020 requires the directors to prepare financial statements for each financial year that give a true and fair view of the state of affairs of the company at the end of the year and of its profit or loss for the year.
        </p>
        <p>In preparing these financial statements, the directors are responsible for:</p>
        <p>
          (a) keeping proper accounting records that disclose, with reasonable accuracy, the financial position of the company and enable the financial statements to comply with the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011;
        </p>
        <p>(b) establishing adequate internal controls to safeguard the company’s assets and to prevent and detect fraud and other irregularities;</p>
        <p>
          (c) selecting suitable accounting policies, applying them consistently, and making judgments and estimates that are reasonable and prudent, in accordance with the IFRS for SMEs Accounting Standard; and
        </p>
        <p>(d) preparing the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.</p>
        <p>
          The directors accept responsibility for the financial statements, which have been prepared using appropriate accounting policies supported by reasonable and prudent judgments and estimates, in conformity with the IFRS for SMEs Accounting Standard and the requirements of the Companies and Allied Matters Act 2020.
        </p>
        <p>{d.goingConcern?.trim() || TBC}</p>
        <div className="sign-grid">
          <div className="sign-line">
            {r.ceoName || '[Director]'}
            <br />
            {r.ceoFrc || '[FRC number]'}
          </div>
          <div className="sign-line">
            {r.cfoName || '[Director]'}
            <br />
            {r.cfoFrc || '[FRC number]'}
          </div>
        </div>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of financial position" sub={`as at ${longDate(eng.yearEnd)}`} />
        <StatementTable rows={st.position} curLabel={year} priorLabel={prior} notes onTrace={onTrace} />
        <div className="approval">
          <p>
            These financial statements were approved by the board of directors on ____________________ and signed on its behalf by:
          </p>
          <div className="sign-grid">
            <div className="sign-line">
              {r.ceoName || '[Chief executive officer]'}
              <br />
              Chief Executive Officer
              <br />
              {r.ceoFrc || '[FRC number]'}
            </div>
            <div className="sign-line">
              {r.cfoName || '[Chief financial officer]'}
              <br />
              Chief Financial Officer
              <br />
              {r.cfoFrc || '[FRC number]'}
            </div>
          </div>
        </div>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of profit or loss and other comprehensive income" />
        <StatementTable rows={st.income} curLabel={year} priorLabel={prior} notes onTrace={onTrace} />
        <p style={{ marginTop: 16 }}>There were no items of other comprehensive income in the year.</p>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of changes in equity" />
        <EquityRows table={st.equity} />
        {equityPrior && (
          <>
            <h3 style={{ marginTop: 28 }}>For the year ended {longDate(`${prior}${eng.yearEnd.slice(4)}`)}</h3>
            <EquityRows table={equityPrior} />
          </>
        )}
      </section>

      {st.cashFlow && (
        <section className="sheet">
          <SheetHead ctx={ctx} title="Statement of cash flows" />
          <StatementTable rows={st.cashFlow} curLabel={year} />
        </section>
      )}

      <section className="sheet">
        <SheetHead ctx={ctx} title="Notes to the financial statements" />
        <h3>1. General information</h3>
        <p>
          {client.name}
          {client.rcNumber ? ` (RC ${client.rcNumber})` : ''} is a company incorporated and domiciled in Nigeria under the Companies and Allied Matters Act 2020.{' '}
          {r.principalActivity ? `Its principal activity is ${r.principalActivity}.` : '[Describe the principal activity.]'}
        </p>
        <h3>2. Basis of preparation and significant accounting policies</h3>
        <p>
          These financial statements have been prepared in accordance with the IFRS for SMEs Accounting Standard issued by the International Accounting Standards Board, as adopted by the Financial Reporting Council of Nigeria, and the requirements of the Companies and Allied Matters Act 2020. They are presented in Nigerian naira, the company’s functional currency, and are prepared under the historical cost convention.
        </p>
        {policies.map(([code, p]) => (
          <p key={code}>
            <em>{p.title}.</em> {p.text}
          </p>
        ))}
        {st.noteBreakdowns.map((n) =>
          n.code === 'ppe' && ppe ? (
            <div key={n.code}>
              <h3>
                {n.number}. {n.title}
              </h3>
              <div className="scroll-x">
                <table className="fs wide">
                  {(
                    [
                      ['Cost', 'Additions', 'Disposals', ppe.cost, ppe.totalCost],
                      ['Accumulated depreciation', 'Charge for the year', 'On disposals', ppe.depreciation, ppe.totalDepreciation],
                    ] as [string, string, string, PpeRow[], PpeRow][]
                  ).map(([title, inc, dis, rows, total]) => (
                    <tbody key={title}>
                      <tr className="heading">
                        <td>{title}</td>
                        <td className="num">At start of year</td>
                        <td className="num">{inc}</td>
                        <td className="num">{dis}</td>
                        <td className="num">At end of year</td>
                      </tr>
                      {rows.map((x) => (
                        <tr key={x.code}>
                          <td>{x.name}</td>
                          <td className="num">{fmt(x.opening)}</td>
                          <td className="num">{fmt(x.increase)}</td>
                          <td className="num">{fmt(-x.disposals)}</td>
                          <td className="num">{fmt(x.closing)}</td>
                        </tr>
                      ))}
                      <tr className="subtotal">
                        <td></td>
                        <td className="num">{fmt(total.opening)}</td>
                        <td className="num">{fmt(total.increase)}</td>
                        <td className="num">{fmt(-total.disposals)}</td>
                        <td className="num">{fmt(total.closing)}</td>
                      </tr>
                    </tbody>
                  ))}
                  <tbody>
                    <tr className="total">
                      <td>Carrying amount</td>
                      <td className="num">{fmt(ppe.carryingOpening)}</td>
                      <td></td>
                      <td></td>
                      <td className="num">{fmt(ppe.carryingClosing)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <div key={n.code}>
            <h3>
              {n.number}. {n.title}
            </h3>
            <StatementTable
              rows={[
                ...n.rows.map((x) => ({ label: x.name, cur: x.cur, prior: x.prior, style: 'line' as const })),
                { label: '', cur: n.cur, prior: n.prior, style: 'total' as const },
              ]}
              curLabel={year}
              priorLabel={prior}
            />
            {n.code === 'income_tax_expense' && tax && (
              <>
                <p style={{ marginTop: 14 }}>The tax charge for the year is reconciled to the accounting profit as follows:</p>
                <StatementTable
                  rows={[
                    { label: 'Profit before tax', cur: tax.pbt, prior: null, style: 'line' },
                    { label: `Tax at the applicable rate of ${tax.rate}%`, cur: tax.atRate, prior: null, style: 'line' },
                    ...tax.items.map((i) => ({ label: i.label, cur: i.amount, prior: null, style: 'line' as const })),
                    ...(tax.difference ? [{ label: 'Unreconciled difference', cur: tax.difference, prior: null, style: 'check' as const }] : []),
                    { label: 'Income tax expense', cur: tax.charge, prior: null, style: 'total' },
                  ]}
                  curLabel={year}
                />
                {tax.effectiveRate !== null && <p style={{ marginTop: 10 }}>The effective tax rate for the year is {tax.effectiveRate}%.</p>}
              </>
            )}
          </div>
          ),
        )}
        {(() => {
          let n = 3 + st.noteBreakdowns.length;
          return (
            <>
              <h3>{n++}. Employees and directors</h3>
              <p>
                {d.employees !== undefined
                  ? `The average number of persons employed by the company during the year was ${d.employees}. Staff costs for the year, including pension contributions, were ₦${fmt(st.cur.staff, { zero: 'nil' })}${st.prior ? ` (${prior}: ₦${fmt(st.prior.staff, { zero: 'nil' })})` : ''}.`
                  : TBC}
              </p>
              <p>
                {d.directorsRemuneration !== undefined
                  ? d.directorsRemuneration === 0
                    ? 'No remuneration was paid to the directors in the year.'
                    : `Remuneration paid to the directors in the year was ₦${fmt(d.directorsRemuneration)}.`
                  : TBC}
              </p>
              <h3>{n++}. Related party transactions</h3>
              {parties.length > 0 ? (
                <div className="scroll-x">
                  <table className="fs wide">
                    <thead>
                      <tr>
                        <th>Related party</th>
                        <th>Relationship</th>
                        <th>Nature</th>
                        <th className="num">Value in the year<br />₦</th>
                        <th className="num">Balance at year end<br />₦</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties.map((x, i) => (
                        <tr key={i}>
                          <td>{x.name}</td>
                          <td>{x.relationship}</td>
                          <td>{x.nature}</td>
                          <td className="num">{fmt(x.amount)}</td>
                          <td className="num">{fmt(x.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>{d.noRelatedParties ? 'There were no related party transactions during the year other than the remuneration of the directors disclosed above.' : TBC}</p>
              )}
              <h3>{n++}. Contingent liabilities and capital commitments</h3>
              <p>{d.contingencies?.trim() || TBC}</p>
              <p>{d.commitments?.trim() || TBC}</p>
              <h3>{n++}. Events after the reporting date</h3>
              <p>{d.subsequentEvents?.trim() || TBC}</p>
              <h3>{n++}. Going concern</h3>
              <p>{d.goingConcern?.trim() || TBC}</p>
            </>
          );
        })()}
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Statement of value added" />
        <StatementTable rows={st.valueAdded} curLabel={year} priorLabel={prior} />
        <p className="small" style={{ marginTop: 16 }}>
          This statement is presented as other national disclosure, as directed by the Financial Reporting Council of Nigeria. It is not a required statement under the IFRS for SMEs Accounting Standard.
        </p>
      </section>

      <section className="sheet">
        <SheetHead ctx={ctx} title="Financial summary" sub="other national disclosure" />
        <div className="scroll-x">
          <table className="fs wide">
            <thead>
              <tr>
                <th></th>
                {summary.years.map((y, i) => (
                  <th key={i} className="num">{y}<br />₦</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.label} className={row.style}>
                  <td>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="num">{row.style === 'heading' ? '' : fmt(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.years.length < 5 && (
          <p className="small" style={{ marginTop: 14 }}>
            Figures for earlier years are not presented because {summary.years.length < 2 ? 'no earlier year is' : 'they are not'} held in this file.
          </p>
        )}
      </section>
      {trace && <TracePanel ctx={ctx} code={trace.code} period={trace.period} onClose={() => setTrace(null)} />}
    </div>
  );
}

export function ReportStep(ctx: Ctx) {
  const { eng, client, ws, statements, locked, reload } = ctx;
  const [r, setR] = useState<ReportSettings>(eng.report);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';
  const set = (patch: Partial<ReportSettings>) => {
    setSaved(false);
    setR({ ...r, ...patch });
  };
  const draft = draftReport({
    type: eng.type,
    clientName: client.name,
    yearEnd: eng.yearEnd,
    settings: r,
    hasCashFlow: statements.cashFlow !== null,
  });

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Report</h2>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await repo.updateEngagement(eng.id, { report: r });
              setSaved(true);
              reload();
            });
          }}
        >
          {eng.type === 'audit' && (
            <>
              <Field
                label="Opinion"
                hint={partner ? 'The software does not choose the opinion. It is the engagement partner’s judgment.' : 'Only the engagement partner can select the opinion.'}
              >
                <select
                  disabled={locked || !partner}
                  value={r.opinion ?? ''}
                  onChange={(e) => set({ opinion: (e.target.value || undefined) as ReportSettings['opinion'] })}
                >
                  <option value="">Not yet selected</option>
                  <option value="unmodified">Unmodified</option>
                  <option value="qualified">Qualified</option>
                  <option value="adverse">Adverse</option>
                  <option value="disclaimer">Disclaimer of opinion</option>
                </select>
              </Field>
              {r.opinion && r.opinion !== 'unmodified' && (
                <Field label="Basis for the modification">
                  <textarea disabled={locked || !partner} value={r.basis ?? ''} onChange={(e) => set({ basis: e.target.value })} />
                </Field>
              )}
            </>
          )}
          <Field label="Principal activity of the company" hint="Completes the sentence: Its principal activity is …">
            <input type="text" disabled={locked} value={r.principalActivity ?? ''} onChange={(e) => set({ principalActivity: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Chief executive officer">
              <input type="text" disabled={locked} value={r.ceoName ?? ''} onChange={(e) => set({ ceoName: e.target.value })} />
            </Field>
            <Field label="CEO’s FRC number">
              <input type="text" disabled={locked} value={r.ceoFrc ?? ''} onChange={(e) => set({ ceoFrc: e.target.value })} />
            </Field>
            <Field label="Chief financial officer">
              <input type="text" disabled={locked} value={r.cfoName ?? ''} onChange={(e) => set({ cfoName: e.target.value })} />
            </Field>
            <Field label="CFO’s FRC number">
              <input type="text" disabled={locked} value={r.cfoFrc ?? ''} onChange={(e) => set({ cfoFrc: e.target.value })} />
            </Field>
          </div>
          <ErrorNote error={error} />
          {saved && <div className="banner info">Saved.</div>}
          {!locked && (
            <div>
              <button className="primary" disabled={busy}>Save</button>
            </div>
          )}
        </form>
        {!locked && (
          <div className="banner warn">
            This is a draft for the engagement partner to review. The wording is starter text and must be checked against the current standards before it is issued.
          </div>
        )}
      </div>

      <section className="sheet">
        <DraftMark locked={locked} />
        <div className="entity">{ws.firm.name}</div>
        <h2>{draft.title}</h2>
        <div className="sub">{draft.addressee}</div>
        {eng.type === 'audit' && !r.opinion ? (
          <p><em>The engagement partner has not yet selected the opinion. The report is drafted once it is.</em></p>
        ) : (
          draft.sections.map((s, i) => (
            <div key={i}>
              {s.heading && <h3>{s.heading}</h3>}
              {s.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          ))
        )}
        <div className="sign-grid">
          <div className="sign-line">
            {locked ? (
              <>
                {eng.signedByName}
                <br />
                {eng.signedByFrc}
                <br />
                For: {ws.firm.name} ({eng.firmFrc})
                <br />
                {ws.firm.address}
                <br />
                {longDate((eng.signedAt ?? '').slice(0, 10))}
              </>
            ) : (
              <>
                [Engagement partner]
                <br />
                [FRC number]
                <br />
                For: {ws.firm.name}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SignOffStep({ eng, ws, lines, adjustments, statements, locked, reload, ledgerTest, bankGates, requests }: Ctx) {
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction();
  const checks = signOffChecks({
    type: eng.type,
    lines,
    adjustments,
    planning: eng.planning,
    programme: eng.programme,
    programmeItemIds: PROGRAMMES[eng.type].map((i) => i.id),
    report: eng.report,
    firmFrc: locked ? (eng.firmFrc ?? '') : ws.firm.frcNumber,
    signerRole: locked ? 'partner' : ws.me.role,
    signerFrc: locked ? (eng.signedByFrc ?? '') : ws.me.frcNumber,
    ledger: ledgerTest,
    testing: eng.testing,
    bank: bankGates,
    openRequests: requests.length ? requests.filter((r) => r.status !== 'accepted').length : undefined,
    disclosureGaps: disclosureGaps(eng.disclosures, statements, lines, adjustments, eng.yearEnd),
  });
  const ready = canSign(checks);
  const advisories = checks.filter((c) => !c.ok && !c.blocking);

  return (
    <div className="stack">
      <div>
        <h2>Sign-off</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Signing records the engagement partner’s name and FRC number on the report and locks the file. A locked file cannot be changed.
        </p>
      </div>
      {locked && (
        <div className="card">
          <h3>Signed</h3>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            {eng.signedByName} ({eng.signedByFrc}) signed for {ws.firm.name} ({eng.firmFrc}) on{' '}
            {new Date(eng.signedAt ?? '').toLocaleString('en-GB')}.
          </p>
        </div>
      )}
      <div className="card">
        <h3>{locked ? 'Checks at sign-off' : 'Before you can sign'}</h3>
        <ChecksList checks={checks} />
      </div>
      {!locked && (
        <div className="card stack">
          {!ready && <div className="banner warn">Sign-off is blocked until every item marked ✕ is cleared.</div>}
          {ready && advisories.length > 0 && (
            <div className="banner warn">
              {advisories.length} advisory item(s) are open. You can sign, but document why each one is acceptable.
            </div>
          )}
          <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input type="checkbox" disabled={!ready} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 4 }} />
            <span>
              I am the engagement partner. I have reviewed this file and the draft report, the evidence supports the report, and I take responsibility for it.
            </span>
          </label>
          <ErrorNote error={error} />
          <div>
            <button
              className="primary"
              disabled={!ready || !confirm || busy}
              onClick={() =>
                void run(async () => {
                  await repo.sign(eng.id);
                  reload();
                })
              }
            >
              Sign and lock the file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TABLE_LABEL: Record<string, string> = {
  engagements: 'Engagement',
  tb_lines: 'Trial balance',
  adjustments: 'Journal',
  gl_entries: 'General ledger',
  bank_accounts: 'Bank statement',
  bank_lines: 'Bank transactions',
  evidence: 'Evidence file',
  client_requests: 'Client request',
  request_links: 'Upload link',
};

export function TrailStep({ eng, ws }: Ctx) {
  const { data, error } = useLoad(() => repo.listLog(eng.id), [eng.id]);
  const who = (id: string | null) => (id === null ? 'Client, by upload link' : ws.members.find((m) => m.userId === id)?.fullName || 'Unknown user');
  return (
    <div className="stack">
      <div>
        <h2>Audit trail</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Every change to this file, newest first. The trail is written by the database and cannot be edited.
        </p>
      </div>
      <ErrorNote error={error} />
      <div className="card scroll-x">
        {!data ? (
          <span className="muted">Loading…</span>
        ) : data.length === 0 ? (
          <span className="muted">Nothing recorded yet.</span>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.at).toLocaleString('en-GB')}</td>
                  <td>{who(l.userId)}</td>
                  <td>
                    {TABLE_LABEL[l.table] ?? l.table} {l.action}
                  </td>
                  <td className="small muted" style={{ wordBreak: 'break-word' }}>
                    {l.detail ? JSON.stringify(l.detail).slice(0, 160) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
