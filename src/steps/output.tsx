import { SealCard, SealMark, useSeal } from '../seal';
import { useState } from 'react';
import { downloadWorkbook } from '../excel';
import { formPhrase, governorsOf, legalFormOf } from '../content/entities';
import { policiesFor, policyApplies, policyCodes } from '../content/notes';
import { aspeBasis } from '../content/aspe';
import { basisNote, COMPILATION_BASES, statuteOf } from '../content/canada';
import { checklistFor, programmeFor } from '../content/packs';
import { repo } from '../data';
import { buildChecklist, checklistOpen } from '../engine/checklist';
import { analyticalReview, unexplainedMovements } from '../engine/analytical';
import { canSign, computeMateriality, signOffChecks } from '../engine/checks';
import { directorList, disclosureGaps, financialSummary, ppeSchedule, priorEquity, taxReconciliation, type PpeRow } from '../engine/disclosures';
import type { EquityTable, Period, Source } from '../engine/statements';
import { TracePanel } from './trace';
import { fmt, cur } from '../engine/money';
import { draftReport, longDate } from '../engine/report';
import { booksLaw, currencyOf, frameworkText, upper } from '../content/jurisdictions';
import { provinceOf } from '../content/canada';
import { retainedEarningsRows, titlesFor } from '../engine/frameworks';
import type { ReportSettings } from '../engine/types';
import { canOpen, ErrorNote, Field, StatementTable, useAction, useLoad, type OnTrace, type Opened } from '../ui';
import { BrandedHead, ContentsSheet, CoverSheet, PageFoot } from './branding';
import type { Ctx } from '../workspace';
import { ChecksList } from './input';
import { Amendments } from './reopen';

function DraftMark({ locked }: { locked: boolean }) {
  return locked ? null : <div className="draft-mark">DRAFT · NOT SIGNED</div>;
}

function SheetHead({ ctx, title, sub }: { ctx: Ctx; title: string; sub?: string }) {
  return (
    <>
      <DraftMark locked={ctx.eng.status === 'locked'} />
      <div className="entity">{ctx.client.name}</div>
      <h2>{title}</h2>
      <div className="sub">{sub ?? `for the year ended ${longDate(ctx.eng.yearEnd)}`}</div>
    </>
  );
}

function EquityRows({ table, onTrace }: { table: EquityTable; onTrace: OnTrace }) {
  return (
    <div className="scroll-x">
      <table className="fs wide">
        <thead>
          <tr>
            <th></th>
            {table.columns.map((c) => (
              <th key={c} className="num">{c}<br />{cur()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className={row.style}>
              <td>{row.label}</td>
              {row.values.map((v, i) => {
                const source = { parts: row.sources?.[i] };
                const what = `${row.label}, ${table.columns[i].toLowerCase()}`;
                return (
                  <td key={i} className="num">
                    {v !== 0 && canOpen(source) ? (
                      <button className="trace" title="Show where this figure comes from" aria-label={`${what}: ${fmt(v)}. Show source`} onClick={() => onTrace({ label: what, period: 'current', source })}>
                        {fmt(v)}
                      </button>
                    ) : (
                      fmt(v)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TBC = '[To be completed in Disclosures.]';

export function StatementsStep(ctx: Ctx) {
  const { eng, client, ws, lines, adjustments, statements: st, jur: j, gaap } = ctx;
  const law = booksLaw(j);
  const canada = gaap !== 'ifrs-smes';
  // ASNPO's deferral method: unspent restricted contributions are a liability, not net assets.
  const deferral = gaap === 'asnpo' && (eng.planning.contributionMethod ?? 'deferral') === 'deferral';
  // An officer's number is printed when entered; a draft shows where it would go, a signed report leaves it out.
  const officer = (n: string | undefined) => (j.officerNumbers && (n?.trim() || eng.status !== 'locked') ? <><br />{n?.trim() || `[${j.licenceShort}]`}</> : null);
  const d = eng.disclosures;
  const gaps = disclosureGaps(d, st, lines, adjustments, eng.yearEnd, j);
  const ppe = ppeSchedule(lines, adjustments, st.cur, d.ppeDisposals);
  const tax = taxReconciliation(st.cur, d);
  const equityPrior = priorEquity(st);
  const summary = financialSummary(st, eng.yearEnd, d.earlierYears);
  const directors = directorList(d);
  const parties = (d.relatedParties ?? []).filter((x) => x.name.trim());
  const year = eng.yearEnd.slice(0, 4);
  const prior = st.hasPrior ? String(Number(year) - 1) : null;
  const r = eng.report;
  // A not-for-profit: its governors, its own words for the statements, and the organisation.
  const form = legalFormOf(eng.planning, j.code);
  const npo = !!form;
  const gv = governorsOf(eng.planning, j.code);
  const body = form?.governors === 'board' ? 'board' : gv.plural;
  const org = npo ? 'organisation' : 'company';
  const titles = titlesFor(gaap, npo);
  const T = {
    report: npo ? `Report of the ${body}` : 'Report of the directors',
    duties: npo ? `Statement of ${gv.possessive} responsibilities` : 'Statement of directors’ responsibilities',
    position: titles.position,
    income: titles.income,
    equity: titles.equity,
  };
  // ASPE's statement of retained earnings, both years side by side.
  const retainedRows = gaap === 'aspe' ? retainedEarningsRows(st.equity, priorEquity(st)) : null;
  const [trace, setTrace] = useState<Opened | null>(null);
  const onTrace: OnTrace = setTrace;
  const lineOf = (code: string) => lines.find((l) => l.code === code)?.id;
  /** A figure in a hand-built table that opens to its source. */
  const figure = (v: number, label: string, source: Source, period: Period) =>
    v === 0 || (source.lineId === undefined && 'lineId' in source) || (period === 'prior' && !st.hasPrior) ? (
      fmt(v)
    ) : (
      <button className="trace" title="Show where this figure comes from" aria-label={`${label}: ${fmt(v)}. Show source`} onClick={() => onTrace({ label, period, source })}>
        {fmt(v)}
      </button>
    );

  if (lines.length === 0)
    return (
      <div className="stack">
        <h2>Financial statements</h2>
        <div className="banner info">Import a trial balance first.</div>
      </div>
    );

  const balanced = st.cur.totalAssets === st.cur.totalEquityAndLiabilities;
  const policies = Object.entries(policiesFor(gaap, eng.planning)).filter(([code]) => policyApplies(code, st));
  const b = ws.firm.branding;
  const sheet = 'sheet';
  // The independent report sits after the directors' pages, where a reader expects it.
  const reportDraft = (eng.status === 'locked' && r.signedReport) || draftFor(ctx, r);
  const showReport = true;
  const reportTitle = canada ? reportDraft.title.charAt(0).toUpperCase() + reportDraft.title.slice(1) : eng.type === 'audit' ? 'Independent auditor’s report' : eng.type === 'review' ? 'Independent practitioner’s review report' : 'Accountant’s compilation report';
  const contents = [
    // Canadian sets carry no directors' report or responsibilities statement.
    ...(canada ? [] : [{ id: 'fs-directors', title: T.report }, { id: 'fs-responsibilities', title: T.duties }]),
    ...(showReport ? [{ id: 'fs-report', title: reportTitle }] : []),
    { id: 'fs-position', title: T.position },
    { id: 'fs-income', title: T.income },
    { id: 'fs-equity', title: T.equity },
    ...(st.cashFlow ? [{ id: 'fs-cashflow', title: 'Statement of cash flows' }] : []),
    { id: 'fs-notes', title: 'Notes to the financial statements' },
    ...(j.nationalStatements
      ? [
          { id: 'fs-value-added', title: 'Statement of value added' },
          { id: 'fs-summary', title: 'Financial summary' },
        ]
      : []),
  ];

  return (
    <div>
      <div className="stack no-print" style={{ marginBottom: 20 }}>
        <div className="between">
          <h2>Financial statements</h2>
          <button onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Select any underlined figure to see what it is made of, down to the accounts, journals, ledger entries and files behind it.
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

      {b.cover !== false && <CoverSheet ctx={ctx} />}
      {b.contents !== false && <ContentsSheet ctx={ctx} entries={contents} />}

      {!canada && (<>
      <section className={sheet} id="fs-directors">
        <SheetHead ctx={ctx} title={T.report} />
        <p>
          The {npo ? gv.plural : 'directors'} present their report and the financial statements of {client.name} for the year ended {longDate(eng.yearEnd)}.
        </p>
        <h3>{npo ? 'Objectives and activities' : 'Principal activity'}</h3>
        <p>{r.principalActivity ? `The principal activity of the ${org} is ${r.principalActivity}.` : '[Describe the principal activity in the Report step.]'}</p>
        <h3>{npo ? 'Financial review' : 'Results and dividends'}</h3>
        <table className="fs">
          <thead>
            <tr>
              <th></th>
              <th className="num">{year}<br />{cur()}</th>
              {prior && <th className="num">{prior}<br />{cur()}</th>}
            </tr>
          </thead>
          <tbody>
            {(npo
              ? ([
                  ['Total income', st.cur.totalIncome, st.prior?.totalIncome],
                  ['Total expenditure', st.cur.totalExpenditure, st.prior?.totalExpenditure],
                  ['Surplus/(deficit) for the year', st.cur.profit, st.prior?.profit],
                  ['Unrestricted funds at the end of the year', st.cur.closingRetained, st.prior?.closingRetained],
                  ['Restricted funds at the end of the year', st.cur.closingRestricted, st.prior?.closingRestricted],
                ] as [string, number, number | undefined][])
              : ([
                ['Revenue', st.cur.v.revenue, st.prior?.v.revenue],
                ['Profit before tax', st.cur.pbt, st.prior?.pbt],
                ['Income tax expense', -st.cur.v.income_tax_expense, st.prior ? -st.prior.v.income_tax_expense : undefined],
                ['Profit for the year', st.cur.profit, st.prior?.profit],
                ['Dividends declared', st.cur.v.dividends, st.prior?.v.dividends],
              ] as [string, number, number | undefined][])
            ).map(([label, c, p]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="num">{fmt(c)}</td>
                {prior && <td className="num">{fmt(p)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{npo ? gv.Plural : 'Directors'}</h3>
        <p>
          {directors.length > 0 ? `The ${npo ? gv.plural : 'directors'} who served during the year were: ${directors.join(', ')}.` : TBC}
        </p>
        <h3>Property, plant and equipment</h3>
        <p>Movements in property, plant and equipment during the year are shown in the notes to the financial statements.</p>
        <h3>Employees</h3>
        <p>
          {d.employees !== undefined ? `The average number of persons employed by the ${org} during the year was ${d.employees}.` : TBC}
        </p>
        <h3>Events after the reporting date</h3>
        <p>{d.subsequentEvents?.trim() || TBC}</p>
        <h3>Auditors</h3>
        <p>
          {eng.type === 'audit'
            ? `${ws.firm.name} have indicated their willingness to continue in office as auditors${j.companiesAct ? `, in accordance with ${j.companiesAct}` : ''}.`
            : 'These financial statements have not been audited.'}
        </p>
        <div className="sign-grid">
          <div className="sign-line">
            By order of the {npo ? body : 'board'}
            <br />
            {d.secretary?.trim() || (npo ? '[Secretary]' : '[Company secretary]')}
            <br />
            {npo ? 'Secretary' : 'Company Secretary'}
            <br />
            {d.registeredOffice?.trim() || '[Registered office]'}
          </div>
        </div>
        <PageFoot ctx={ctx} />
      </section>

      <section className={sheet} id="fs-responsibilities">
        <SheetHead ctx={ctx} title={T.duties} sub={`in relation to the financial statements for the year ended ${longDate(eng.yearEnd)}`} />
        <p>
          {j.companiesAct ? upper(`${j.companiesAct} requires`) : `The ${npo ? gv.plural : 'directors'} are required`}
          {j.companiesAct ? ` the ${npo ? gv.plural : 'directors'}` : ''} to prepare financial statements for each financial year that give a true and fair view of the state of affairs of the {org} at the end of the year and of its {npo ? 'surplus or deficit' : 'profit or loss'} for the year.
        </p>
        <p>In preparing these financial statements, the {npo ? gv.plural : 'directors'} are responsible for:</p>
        <p>
          (a) keeping proper accounting records that disclose, with reasonable accuracy, the financial position of the {org} and enable the financial statements to comply with {law ?? frameworkText(j)};
        </p>
        <p>(b) establishing adequate internal controls to safeguard the {org}’s assets{npo ? ', to apply restricted funds only for the purposes for which they were given,' : ''} and to prevent and detect fraud and other irregularities;</p>
        <p>
          (c) selecting suitable accounting policies, applying them consistently, and making judgments and estimates that are reasonable and prudent, in accordance with the IFRS for SMEs Accounting Standard; and
        </p>
        <p>(d) preparing the financial statements on the going concern basis unless it is inappropriate to presume that the {org} will continue {npo ? 'its activities' : 'in business'}.</p>
        <p>
          The {npo ? gv.plural : 'directors'} accept responsibility for the financial statements, which have been prepared using appropriate accounting policies supported by reasonable and prudent judgments and estimates, in conformity with the IFRS for SMEs Accounting Standard{j.companiesAct ? ` and the requirements of ${j.companiesAct}` : ''}.
        </p>
        <p>{d.goingConcern?.trim() || TBC}</p>
        <div className="sign-grid">
          <div className="sign-line">
            {r.ceoName || (npo ? `[${gv.Plural.replace(/s$/, '')}]` : '[Director]')}
            {officer(r.ceoFrc)}
          </div>
          <div className="sign-line">
            {r.cfoName || (npo ? `[${gv.Plural.replace(/s$/, '')}]` : '[Director]')}
            {officer(r.cfoFrc)}
          </div>
        </div>
        <PageFoot ctx={ctx} />
      </section>
      </>)}

      {showReport && <ReportSheet ctx={ctx} draft={reportDraft} ready={eng.type !== 'audit' || !!r.opinion || (eng.status === 'locked' && !!r.signedReport)} />}

      <section className={sheet} id="fs-position">
        <SheetHead ctx={ctx} title={T.position} sub={`as at ${longDate(eng.yearEnd)}`} />
        <StatementTable rows={st.position} curLabel={year} priorLabel={prior} notes onTrace={onTrace} />
        {canada ? (
          <div className="approval">
            <p>Approved on behalf of the {npo ? 'Board' : 'Board of Directors'}:</p>
            <div className="sign-grid">
              <div className="sign-line">
                {r.ceoName || '[Director]'}
                <br />
                Director
              </div>
              <div className="sign-line">
                {r.cfoName || '[Director]'}
                <br />
                Director
              </div>
            </div>
          </div>
        ) : (
        <div className="approval">
          <p>
            These financial statements were approved by the {npo ? (form?.governors === 'board' ? 'board' : gv.plural) : 'board of directors'} on ____________________ and signed on {npo && form?.governors !== 'board' ? 'their' : 'its'} behalf by:
          </p>
          <div className="sign-grid">
            <div className="sign-line">
              {r.ceoName || (npo ? `[${gv.Plural.replace(/s$/, '')}]` : '[Chief executive officer]')}
              <br />
              {npo ? (form?.governors === 'trustees' ? 'Trustee' : form?.governors === 'board' ? 'Board member' : 'Director') : 'Chief Executive Officer'}
              {officer(r.ceoFrc)}
            </div>
            <div className="sign-line">
              {r.cfoName || (npo ? `[${gv.Plural.replace(/s$/, '')}]` : '[Chief financial officer]')}
              <br />
              {npo ? (form?.governors === 'trustees' ? 'Trustee' : form?.governors === 'board' ? 'Board member' : 'Director') : 'Chief Financial Officer'}
              {officer(r.cfoFrc)}
            </div>
          </div>
        </div>
        )}
        <PageFoot ctx={ctx} />
      </section>

      <section className={sheet} id="fs-income">
        <SheetHead ctx={ctx} title={T.income} />
        <StatementTable rows={st.income} curLabel={year} priorLabel={prior} notes onTrace={onTrace} />
        {!npo && !canada && <p style={{ marginTop: 16 }}>There were no items of other comprehensive income in the year.</p>}
        <PageFoot ctx={ctx} />
      </section>

      <section className={sheet} id="fs-equity">
        <SheetHead ctx={ctx} title={T.equity} />
        {retainedRows ? (
          <StatementTable rows={retainedRows} curLabel={year} priorLabel={prior} onTrace={onTrace} />
        ) : (
          <EquityRows table={st.equity} onTrace={onTrace} />
        )}
        {equityPrior && !npo && !retainedRows && (
          <>
            <h3 style={{ marginTop: 28 }}>For the year ended {longDate(`${prior}${eng.yearEnd.slice(4)}`)}</h3>
            <EquityRows table={equityPrior} onTrace={onTrace} />
          </>
        )}
        <PageFoot ctx={ctx} />
      </section>

      {st.cashFlow && (
        <section className={sheet} id="fs-cashflow">
          <SheetHead ctx={ctx} title="Statement of cash flows" />
          <StatementTable rows={st.cashFlow} curLabel={year} priorLabel={st.cashFlow.some((r) => r.style !== 'heading' && r.prior !== null) ? prior : undefined} onTrace={onTrace} />
          {!st.cashFlow.some((r) => r.style !== 'heading' && r.prior !== null) && (
            <p className="small muted no-print" style={{ marginTop: 12 }}>
              The comparative cash flow needs the balances from {Number(year) - 2} as its opening position. Import that year’s trial balance to show it.
            </p>
          )}
          <PageFoot ctx={ctx} />
      </section>
      )}

      <section className={sheet} id="fs-notes">
        <SheetHead ctx={ctx} title="Notes to the financial statements" />
        {canada ? (
          <CanadaNotesHead ctx={ctx} npo={npo} policies={policies.map(([code, p]) => ({ code, title: p.title, text: d.policies?.[code]?.text || p.text }))} />
        ) : (
          <>
            <h3>1. General information</h3>
            <p>
              {client.name}
              {client.rcNumber ? ` (${j.companyNumberLabel} ${client.rcNumber})` : ''}{' '}
              {npo
                ? `is a not-for-profit organisation domiciled in ${j.inName}, constituted as ${formPhrase(form!)}${j.companiesAct ? ` under ${j.companiesAct}` : ''}.`
                : `is a company incorporated and domiciled in ${j.inName}${j.companiesAct ? ` under ${j.companiesAct}` : ''}.`}{' '}
              {r.principalActivity ? `Its principal activity is ${r.principalActivity}.` : '[Describe the principal activity.]'}
            </p>
            <h3>2. Basis of preparation and significant accounting policies</h3>
            <p>
              These financial statements have been prepared in accordance with the IFRS for SMEs Accounting Standard issued by the International Accounting Standards Board{j.adoptedBy ? `, as adopted by ${j.adoptedBy}` : ''}{j.companiesAct ? `, and the requirements of ${j.companiesAct}` : ''}. They are presented in {currencyOf(eng.currency).name}, the {org}’s functional currency, and are prepared under the historical cost convention.
              {npo &&
                ' As a not-for-profit organisation, it presents a statement of income and expenditure in place of a statement of profit or loss, and its funds in place of equity. Restricted funds are amounts given for a purpose set by the donor or grantor; they are shown separately until spent on that purpose. Unrestricted funds may be used for any of its objectives. Grants and donations are recognised as income when the organisation is entitled to them and they can be measured reliably; a grant with conditions not yet met is held as deferred income.'}
            </p>
            {policies.map(([code, p]) => ({ code, title: p.title, text: d.policies?.[code]?.text || p.text })).map(({ code, ...p }) => (
              <p key={code}>
                <em>{p.title}.</em> {p.text}
              </p>
            ))}
          </>
        )}
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
                          <td className="num">{figure(x.opening, `${x.name} at start of year`, { code: 'ppe', lineId: lineOf(x.code) }, 'prior')}</td>
                          <td className="num">{fmt(x.increase)}</td>
                          <td className="num">{fmt(-x.disposals)}</td>
                          <td className="num">{figure(x.closing, `${x.name} at end of year`, { code: 'ppe', lineId: lineOf(x.code) }, 'current')}</td>
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
                      <td className="num">{figure(ppe.carryingOpening, 'Property, plant and equipment at start of year', { code: 'ppe' }, 'prior')}</td>
                      <td></td>
                      <td></td>
                      <td className="num">{figure(ppe.carryingClosing, 'Property, plant and equipment at end of year', { code: 'ppe' }, 'current')}</td>
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
                ...n.rows.map((x) => ({ label: x.name, cur: x.cur, prior: x.prior, style: 'line' as const, code: n.code, lineId: x.lineId })),
                { label: '', cur: n.cur, prior: n.prior, style: 'total' as const, code: n.code, accountsOnly: true },
              ]}
              curLabel={year}
              priorLabel={prior}
              onTrace={(o) => onTrace({ ...o, label: o.source.lineId ? o.label : n.title })}
            />
            {n.code === 'income_tax_expense' && tax && (
              <>
                <p style={{ marginTop: 14 }}>The tax charge for the year is reconciled to the accounting profit as follows:</p>
                <StatementTable
                  rows={[
                    { label: 'Profit before tax', cur: tax.pbt, prior: null, style: 'line', parts: st.pbtParts },
                    { label: `Tax at the applicable rate of ${tax.rate}%`, cur: tax.atRate, prior: null, style: 'line' },
                    ...tax.items.map((i) => ({ label: i.label, cur: i.amount, prior: null, style: 'line' as const })),
                    ...(tax.difference ? [{ label: 'Unreconciled difference', cur: tax.difference, prior: null, style: 'check' as const }] : []),
                    { label: 'Income tax expense', cur: tax.charge, prior: null, style: 'total', code: 'income_tax_expense' },
                  ]}
                  curLabel={year}
                  onTrace={onTrace}
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
              {npo && st.funds && st.funds.length > 0 && (
                <>
                  <h3>{n++}. {deferral ? 'Deferred contributions' : 'Restricted funds'}</h3>
                  <p>
                    {deferral
                      ? 'Deferred contributions are restricted contributions received that have not yet been spent on the purposes set by the donors and grantors named below. Their movement in the year was:'
                      : 'Restricted funds are held for the purposes set by the donors and grantors named below. Each fund’s movement in the year was:'}
                  </p>
                  <div className="scroll-x">
                    <table className="fs wide" aria-label="Restricted funds">
                      <thead>
                        <tr>
                          <th>{deferral ? 'Contribution' : 'Fund'}</th>
                          <th className="num">{canada ? 'Balance, beginning of year' : 'At start of year'}<br />{cur()}</th>
                          <th className="num">{deferral ? 'Received' : canada ? 'Revenue' : 'Income'}<br />{cur()}</th>
                          <th className="num">{deferral ? 'Recognized as revenue' : canada ? 'Expenses' : 'Expenditure'}<br />{cur()}</th>
                          <th className="num">{canada ? 'Balance, end of year' : 'At end of year'}<br />{cur()}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {st.funds.map((f) => (
                          <tr key={f.name}>
                            <td>{f.name}</td>
                            <td className="num">{fmt(f.opening)}</td>
                            <td className="num">{fmt(f.income)}</td>
                            <td className="num">{fmt(-f.expenditure)}</td>
                            <td className="num">{fmt(f.closing)}</td>
                          </tr>
                        ))}
                        <tr className="total">
                          <td>{deferral ? 'Total deferred contributions' : 'Total restricted funds'}</td>
                          {(['opening', 'income', 'expenditure', 'closing'] as const).map((k) => (
                            <td key={k} className="num">{fmt((k === 'expenditure' ? -1 : 1) * st.funds!.reduce((a, f) => a + f[k], 0))}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {st.funds.some((f) => f.closing < 0) && <p className="small">A fund in deficit has spent more than it has received so far. Say how the deficit will be met, or whether it was funded from unrestricted funds.</p>}
                </>
              )}
              <h3>{n++}. Employees and {npo ? gv.plural : 'directors'}</h3>
              <p>
                {d.employees !== undefined
                  ? `The average number of persons employed by the ${org} during the year was ${d.employees}. Staff costs for the year, including pension contributions, were ${cur()}${fmt(st.cur.staff, { zero: 'nil' })}${st.prior ? ` (${prior}: ${cur()}${fmt(st.prior.staff, { zero: 'nil' })})` : ''}.`
                  : TBC}
              </p>
              <p>
                {d.directorsRemuneration !== undefined
                  ? d.directorsRemuneration === 0
                    ? `No remuneration was paid to the ${npo ? gv.plural : 'directors'} in the year.`
                    : `Remuneration paid to the ${npo ? gv.plural : 'directors'} in the year was ${cur()}${fmt(d.directorsRemuneration)}.`
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
                        <th className="num">Value in the year<br />{cur()}</th>
                        <th className="num">Balance at year end<br />{cur()}</th>
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
        <PageFoot ctx={ctx} />
      </section>

      {j.nationalStatements && (
      <section className={sheet} id="fs-value-added">
        <SheetHead ctx={ctx} title="Statement of value added" />
        <StatementTable rows={st.valueAdded} curLabel={year} priorLabel={prior} onTrace={onTrace} />
        <p className="small" style={{ marginTop: 16 }}>
          This statement is presented as other national disclosure, as directed by the Financial Reporting Council of Nigeria. It is not a required statement under the IFRS for SMEs Accounting Standard.
        </p>
        <PageFoot ctx={ctx} />
      </section>

      )}
      {j.nationalStatements && (
      <section className={sheet} id="fs-summary">
        <SheetHead ctx={ctx} title="Financial summary" sub="other national disclosure" />
        <div className="scroll-x">
          <table className="fs wide">
            <thead>
              <tr>
                <th></th>
                {summary.years.map((y, i) => (
                  <th key={i} className="num">{y}<br />{cur()}</th>
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
        <PageFoot ctx={ctx} />
      </section>
      )}
      {trace && <TracePanel key={`${trace.label}|${trace.period}`} ctx={ctx} opened={trace} onClose={() => setTrace(null)} />}
    </div>
  );
}

/** Canada: notes 1 and 2. A compilation on a basis other than ASPE or ASNPO opens with the basis of accounting (CSRS 4200). */
function CanadaNotesHead({ ctx, npo, policies }: { ctx: Ctx; npo: boolean; policies: { code: string; title: string; text: string }[] }) {
  const { eng, client } = ctx;
  const r = eng.report;
  const statute = statuteOf(eng.planning.statute);
  const special = eng.type === 'compilation' && (r.compilationBasis ?? 'cash-accruals') !== 'aspe';
  const nature = (
    <p>
      {client.name}
      {client.rcNumber ? ` (${ctx.jur.companyNumberLabel} ${client.rcNumber})` : ''}{' '}
      {npo
        ? `is a not-for-profit organization${statute?.name ? ` incorporated under ${statute.name}` : ''}. It is exempt from income taxes under the Income Tax Act.`
        : `is incorporated under ${statute?.name || '[the statute it is incorporated under, chosen on the Planning step]'}.`}{' '}
      {r.principalActivity ? `Its principal activity is ${r.principalActivity}.` : '[Describe the principal activity.]'}
    </p>
  );
  if (special)
    return (
      <>
        <h3>1. Basis of accounting</h3>
        <p>{basisNote(r.compilationBasis, client.name, r.basisAccruals ?? '', r.basisOther ?? '', npo)}</p>
        <h3>2. Nature of operations</h3>
        {nature}
      </>
    );
  return (
    <>
      <h3>1. Nature of operations</h3>
      {nature}
      <h3>2. Significant accounting policies</h3>
      {aspeBasis({ npo, currency: currencyOf(eng.currency).name }).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {policies.map((p) => (
        <p key={p.code}>
          <em>{p.title}.</em> {p.text}
        </p>
      ))}
    </>
  );
}

/** Canada: the signing partner confirms holding the public accounting licence an audit or review needs. */
function LicenceConfirmation({ ctx }: { ctx: Ctx }) {
  const { eng, ws, locked, reload } = ctx;
  const c = eng.report.licenceConfirmed;
  const p = provinceOf(ws.firm.branding.province);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';
  const save = (next: ReportSettings['licenceConfirmed']) =>
    run(async () => {
      const { licenceConfirmed: _x, ...rest } = eng.report;
      await repo.updateEngagement(eng.id, { report: next ? { ...rest, licenceConfirmed: next } : rest });
      reload();
    });
  return (
    <div className="card stack" aria-label="Public accounting licence">
      <h3 style={{ margin: 0 }}>Public accounting licence</h3>
      <p className="small muted" style={{ margin: 0 }}>
        {p ? `${p.regulator} licenses public accounting in ${p.name}.` : 'Each province licenses public accounting.'} An {eng.type === 'audit' ? 'audit' : 'review'} may be signed only by a partner who holds a licence that covers it.
      </p>
      {c ? (
        <div className="row">
          <span className="tag ok">Confirmed by {c.by}{c.province ? ` for ${provinceOf(c.province)?.name ?? c.province}` : ''}, {new Date(c.at).toLocaleDateString('en-CA')}</span>
          {!locked && partner && <button className="link danger small" disabled={busy} onClick={() => void save(undefined)}>Withdraw</button>}
        </div>
      ) : !locked && partner ? (
        <div>
          <button disabled={busy || !ws.me.fullName} onClick={() => void save({ by: ws.me.fullName, at: new Date().toISOString(), province: ws.firm.branding.province ?? '' })}>
            I hold a public accounting licence that covers this {eng.type === 'audit' ? 'audit' : 'review engagement'}
          </button>
        </div>
      ) : (
        <span className="small muted">Not yet confirmed. The engagement partner confirms it here.</span>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

/** The report as the software would word it now, from the partner's settings. */
function draftFor(ctx: Ctx, settings: ReportSettings) {
  const form = legalFormOf(ctx.eng.planning, ctx.jur.code);
  const g = governorsOf(ctx.eng.planning, ctx.jur.code);
  const name = ctx.client.name;
  return draftReport({
    npo: form
      ? {
          governors: g,
          addressee:
            form.governors === 'trustees' ? `To the Trustees of ${name}` : form.governors === 'board' ? `To the Board of ${name}` : ctx.eng.type === 'audit' ? `To the members of ${name}` : `To the directors of ${name}`,
        }
      : undefined,
    type: ctx.eng.type,
    clientName: ctx.client.name,
    yearEnd: ctx.eng.yearEnd,
    settings,
    specialBasis: ctx.jur.code === 'CA' && ctx.eng.type === 'compilation' && (settings.compilationBasis ?? 'cash-accruals') !== 'aspe',
    hasCashFlow: ctx.statements.cashFlow !== null,
    group: !!ctx.group && ctx.group.members.length > 0,
    groupCashFlow: !!ctx.group?.cashFlow,
    jurisdiction: ctx.jur,
  });
}


/** The auditor's, reviewer's or accountant's report, as one printed page. */
function ReportSheet({ ctx, draft, ready }: { ctx: Ctx; draft: ReturnType<typeof draftFor>; ready: boolean }) {
  const { eng, ws } = ctx;
  const signed = eng.status === 'locked';
  const title = eng.type === 'audit' ? ctx.jur.signerTitle : undefined;
  return (
    <section className="sheet" id="fs-report">
      <DraftMark locked={signed} />
      <BrandedHead ctx={ctx} />
      <div className="entity">{ws.firm.name}</div>
      <h2>{draft.title}</h2>
      <div className="sub">{draft.addressee}</div>
      {!ready ? (
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
      {ctx.jur.code === 'CA' ? (
        // A Canadian report is signed in the firm's name, with its designation, place and date.
        <div className="sign-grid">
          <div className="sign-line">
            {ws.firm.name}
            <br />
            {ws.firm.branding.designation?.trim() || provinceOf(ws.firm.branding.province)?.designation || 'Chartered Professional Accountants'}
            <br />
            {ws.firm.address || '[City, province]'}
            <br />
            {signed ? longDate((eng.signedAt ?? '').slice(0, 10)) : '[Date of the report]'}
          </div>
        </div>
      ) : (
      <div className="sign-grid">
        <div className="sign-line">
          {signed ? (
            <>
              {eng.signedByName}
              {title && <><br />{title}</>}
              {eng.signedByFrc && <><br />{eng.signedByFrc}</>}
              <br />
              For: {ws.firm.name}{eng.firmFrc ? ` (${eng.firmFrc})` : ''}
              <br />
              {ws.firm.address}
              <br />
              {longDate((eng.signedAt ?? '').slice(0, 10))}
            </>
          ) : (
            <>
              [Engagement partner]
              {title && <><br />{title}</>}
              <br />
              [{ctx.jur.licenceShort}]
              <br />
              For: {ws.firm.name}
            </>
          )}
        </div>
      </div>
      )}
      {signed && <ReportSeal engagementId={eng.id} signedAt={eng.signedAt} />}
      <PageFoot ctx={ctx} />
    </section>
  );
}

/** The verification seal beside the signature, once the file is signed and sealed. */
function ReportSeal({ engagementId, signedAt }: { engagementId: string; signedAt: string | null | undefined }) {
  const { seal } = useSeal(engagementId, signedAt);
  return seal ? <SealMark seal={seal} /> : null;
}

export function ReportStep(ctx: Ctx) {
  const { eng, ws, locked, reload } = ctx;
  const signed = eng.status === 'locked';
  const [r, setR] = useState<ReportSettings>(eng.report);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const partner = ws.me.role === 'partner';
  const set = (patch: Partial<ReportSettings>) => {
    setSaved(false);
    setR({ ...r, ...patch });
  };
  // A signed report is shown as it was signed. Later changes to the wording in the software do not reach it.
  const draft = (signed && eng.report.signedReport) || draftFor(ctx, r);

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
          {eng.type === 'review' && (
            <>
              <Field label="Conclusion" hint={partner ? 'Leave as unmodified unless the review found a matter that changes the conclusion.' : 'Only the engagement partner can change the conclusion.'}>
                <select
                  disabled={locked || !partner}
                  value={r.opinion ?? 'unmodified'}
                  onChange={(e) => set({ opinion: (e.target.value === 'unmodified' ? undefined : e.target.value) as ReportSettings['opinion'] })}
                >
                  <option value="unmodified">Unmodified</option>
                  <option value="qualified">Qualified</option>
                  <option value="adverse">Adverse</option>
                  <option value="disclaimer">Disclaimer of conclusion</option>
                </select>
              </Field>
              {r.opinion && r.opinion !== 'unmodified' && (
                <Field label="Basis for the modification">
                  <textarea disabled={locked || !partner} value={r.basis ?? ''} onChange={(e) => set({ basis: e.target.value })} />
                </Field>
              )}
            </>
          )}
          {eng.type !== 'compilation' && (
            <details className="stack" open={!!(r.goingConcern || r.emphasis || r.otherMatter || r.otherInformation)}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Paragraphs the partner adds</summary>
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                Leave each blank unless it applies. You write the paragraph. The software adds the heading and the sentence the standards require after it. None of these changes the {eng.type === 'audit' ? 'opinion' : 'conclusion'}, and none is a substitute for modifying it.
              </p>
              {eng.type === 'audit' && (
                <Field
                  label="Material uncertainty related to going concern"
                  hint="Only where the uncertainty is adequately disclosed. Refer to the note, say what it shows, and state that a material uncertainty exists that may cast significant doubt on the company’s ability to continue as a going concern."
                >
                  <textarea disabled={locked || !partner} value={r.goingConcern ?? ''} onChange={(e) => set({ goingConcern: e.target.value })} />
                </Field>
              )}
              <Field label="Emphasis of matter" hint="A matter properly presented or disclosed that is fundamental to a reader’s understanding. Begin: We draw attention to Note …">
                <textarea disabled={locked || !partner} value={r.emphasis ?? ''} onChange={(e) => set({ emphasis: e.target.value })} />
              </Field>
              {eng.type === 'audit' && (
                <>
                  <Field label="Other matter" hint="Something not in the financial statements that helps a reader understand the audit or this report, such as the prior year having been audited by another firm.">
                    <textarea disabled={locked || !partner} value={r.otherMatter ?? ''} onChange={(e) => set({ otherMatter: e.target.value })} />
                  </Field>
                  <Field
                    label="Misstatement of the other information"
                    hint={`The report always carries an Other information section covering the directors’ pages${ctx.jur.nationalStatements ? ', the statement of value added and the financial summary' : ''}. Leave this blank and it says there is nothing to report. Describe an uncorrected material misstatement here if you found one.`}
                  >
                    <textarea disabled={locked || !partner} value={r.otherInformation ?? ''} onChange={(e) => set({ otherInformation: e.target.value })} />
                  </Field>
                </>
              )}
            </details>
          )}
          {ctx.jur.code === 'CA' && eng.type === 'compilation' && (
            <fieldset className="stack" aria-label="Compilation engagement (CSRS 4200)">
              <legend>Compilation engagement (CSRS 4200)</legend>
              <Field label="Basis of accounting agreed with management" hint="Name ASPE or ASNPO only if the statements comply with it in full. Otherwise Note 1 describes the basis.">
                <select disabled={locked} value={r.compilationBasis ?? 'cash-accruals'} onChange={(e) => set({ compilationBasis: e.target.value as ReportSettings['compilationBasis'] })}>
                  {COMPILATION_BASES.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </Field>
              {(r.compilationBasis ?? 'cash-accruals') === 'cash-accruals' && (
                <Field label="Accruals added to the cash basis" hint="Completes Note 1: …reflects cash transactions with the addition of …">
                  <input type="text" disabled={locked} value={r.basisAccruals ?? ''} placeholder="accounts receivable, accounts payable and accrued liabilities, and amortization of capital assets" onChange={(e) => set({ basisAccruals: e.target.value })} />
                </Field>
              )}
              {r.compilationBasis === 'other' && (
                <Field label="The basis of accounting, in full">
                  <textarea disabled={locked} value={r.basisOther ?? ''} onChange={(e) => set({ basisOther: e.target.value })} />
                </Field>
              )}
              <Field label="Intended use and users" hint="Who will use the compiled statements and for what, as agreed in the engagement letter. Example: the bank, for the annual covenant review.">
                <input type="text" disabled={locked} value={r.intendedUse ?? ''} onChange={(e) => set({ intendedUse: e.target.value })} />
              </Field>
              <div className="grid2">
                <Field label="Engagement letter signed on" hint="Required before the report is issued. Review it every year.">
                  <input type="date" disabled={locked} value={r.engagementLetter ?? ''} onChange={(e) => set({ engagementLetter: e.target.value || undefined })} />
                </Field>
                <Field label="Management acknowledged the final statements on" hint="Management’s acknowledgment of responsibility for the final compiled statements. The report is dated on or after this.">
                  <input type="date" disabled={locked} value={r.managementAck ?? ''} onChange={(e) => set({ managementAck: e.target.value || undefined })} />
                </Field>
              </div>
            </fieldset>
          )}
          <Field label={`Principal activity of the ${ctx.gaap === 'asnpo' ? 'organization' : 'company'}`} hint="Completes the sentence: Its principal activity is …">
            <input type="text" disabled={locked} value={r.principalActivity ?? ''} onChange={(e) => set({ principalActivity: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label={ctx.jur.code === 'CA' ? 'Director signing the balance sheet' : 'Chief executive officer'}>
              <input type="text" disabled={locked} value={r.ceoName ?? ''} onChange={(e) => set({ ceoName: e.target.value })} />
            </Field>
            {ctx.jur.officerNumbers && (
              <Field label={`CEO’s ${ctx.jur.licenceShort}`}>
                <input type="text" disabled={locked} value={r.ceoFrc ?? ''} onChange={(e) => set({ ceoFrc: e.target.value })} />
              </Field>
            )}
            <Field label={ctx.jur.code === 'CA' ? 'Second director' : 'Chief financial officer'}>
              <input type="text" disabled={locked} value={r.cfoName ?? ''} onChange={(e) => set({ cfoName: e.target.value })} />
            </Field>
            {ctx.jur.officerNumbers && (
              <Field label={`CFO’s ${ctx.jur.licenceShort}`}>
                <input type="text" disabled={locked} value={r.cfoFrc ?? ''} onChange={(e) => set({ cfoFrc: e.target.value })} />
              </Field>
            )}
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

      <ReportSheet ctx={ctx} draft={draft} ready={eng.type !== 'audit' || !!r.opinion || (signed && !!eng.report.signedReport)} />
    </div>
  );
}

export function SignOffStep(ctx: Ctx) {
  const { eng, ws, client, lines, adjustments, statements, locked, reload, ledgerTest, bankGates, requests, group } = ctx;
  const signed = eng.status === 'locked';
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction();
  const confirmations = eng.planning.independence ?? {};
  const mine = confirmations[ws.me.userId];
  const [threats, setThreats] = useState('');
  const confirmedNames = new Set(Object.values(confirmations).map((c) => c.name));
  // Everyone whose name is on a completed step or a journal conclusion did work on the file.
  const workers = new Set([...Object.values(eng.programme), ...Object.values(eng.testing.journals ?? {})].map((x) => x.by).filter((x): x is string => !!x));
  const setIndependence = (next: typeof confirmations) =>
    run(async () => {
      await repo.updateEngagement(eng.id, { planning: { ...eng.planning, independence: next } });
      reload();
    });
  const checks = signOffChecks({
    type: eng.type,
    lines,
    adjustments,
    planning: eng.planning,
    programme: eng.programme,
    programmeItemIds: programmeFor(eng.type, eng.planning, ctx.jur.code).map((i) => i.id),
    report: eng.report,
    firmFrc: signed ? (eng.firmFrc ?? '') : ws.firm.frcNumber,
    jurisdiction: ctx.jur,
    province: ws.firm.branding.province,
    signerRole: signed ? 'partner' : ws.me.role,
    signerFrc: signed ? (eng.signedByFrc ?? '') : ws.me.frcNumber,
    ledger: ledgerTest,
    testing: eng.testing,
    bank: bankGates,
    movements:
      // Files signed before this step existed are not marked down for lacking it.
      eng.type !== 'compilation' && statements.hasPrior && !(signed && !eng.testing.movements)
        ? { unexplained: unexplainedMovements(analyticalReview(statements, eng.type === 'audit' ? (computeMateriality(statements.cur, eng.planning)?.performance ?? null) : null), eng.testing.movements).map((m) => m.label) }
        : undefined,
    group: group
      ? {
          ready: !!group.cur,
          difference: group.cur?.difference ?? 0,
          unbalanced: (group.cur?.unbalanced.length ?? 0) + (group.prior?.unbalanced.length ?? 0),
          unsigned: group.members.filter((m) => m.status === 'in_progress').map((m) => m.name ?? 'a subsidiary'),
          unexplained: group.equity?.unexplained ?? 0,
          noCashFlow: group.cur && group.prior ? group.blocker : null,
        }
      : undefined,
    // Files signed before confirmations existed are not marked down for lacking them.
    independence:
      signed && Object.keys(confirmations).length === 0
        ? undefined
        : { signer: signed ? confirmedNames.has(eng.signedByName ?? '') : !!mine, unconfirmed: [...workers].filter((n) => !confirmedNames.has(n)) },
    checklistOpen: lines.length
      ? checklistOpen(buildChecklist(checklistFor(eng.planning, ctx.jur.code), { statements, lines, adjustments, disclosures: eng.disclosures, principalActivity: eng.report.principalActivity, policyCodes: policyCodes(statements) })).length
      : undefined,
    openRequests: requests.length ? requests.filter((r) => r.status !== 'accepted').length : undefined,
    programmeWithFiles: [...new Set([...ctx.evidence.filter((e) => e.refType === 'programme').map((e) => e.refId), ...Object.entries(eng.programme).filter(([, v]) => (v.files ?? []).some((f) => ctx.evidence.some((e) => e.id === f))).map(([k]) => k)])],
    disclosureGaps: disclosureGaps(eng.disclosures, statements, lines, adjustments, eng.yearEnd, ctx.jur),
  });
  const ready = canSign(checks);
  const advisories = checks.filter((c) => !c.ok && !c.blocking);

  return (
    <div className="stack">
      <div>
        <h2>Sign-off</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Signing records the engagement partner’s name, and their {ctx.jur.licenceShort} when it is on file, on the report and locks the file. A locked file cannot be changed.
        </p>
      </div>
      <Amendments ctx={ctx} />
      {signed && (
        <div className="card">
          <h3>Signed</h3>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            {eng.signedByName}{eng.signedByFrc ? ` (${eng.signedByFrc})` : ''} signed for {ws.firm.name}{eng.firmFrc ? ` (${eng.firmFrc})` : ''} on{' '}
            {new Date(eng.signedAt ?? '').toLocaleString('en-GB')}.
          </p>
        </div>
      )}
      {signed && <SealCard engagementId={eng.id} signedAt={eng.signedAt ?? null} partner={ws.me.role === 'partner'} />}
      <div className="card stack">
        <h3>Independence</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Each person who works on this file confirms they are independent of {client.name}: no financial interest, no close relationship, and no other threat that has not been dealt with. The person signing must confirm before they can sign.
        </p>
        {Object.keys(confirmations).length === 0 ? (
          <span className="muted">No one has confirmed yet.</span>
        ) : (
          <ul className="small files" style={{ marginTop: 0 }}>
            {Object.entries(confirmations).map(([id, c]) => (
              <li key={id}>
                <strong>{c.name}</strong> confirmed on {new Date(c.at).toLocaleDateString('en-GB')}
                {c.note && `. Threats and safeguards: ${c.note}`}
              </li>
            ))}
          </ul>
        )}
        {!locked &&
          (mine ? (
            <div>
              <button
                className="link danger"
                disabled={busy}
                onClick={() => {
                  const { [ws.me.userId]: _mine, ...rest } = confirmations;
                  void setIndependence(rest);
                }}
              >
                Withdraw my confirmation
              </button>
            </div>
          ) : (
            <>
              <Field label="Threats to your independence and the safeguards applied, if any">
                <input type="text" maxLength={500} value={threats} placeholder="Leave blank if there are none" onChange={(e) => setThreats(e.target.value)} />
              </Field>
              <div>
                <button
                  disabled={busy || !ws.me.fullName}
                  onClick={() => void setIndependence({ ...confirmations, [ws.me.userId]: { name: ws.me.fullName, at: new Date().toISOString(), note: threats.trim() } })}
                >
                  I confirm I am independent of {client.name}
                </button>
                {!ws.me.fullName && <span className="small muted" style={{ marginLeft: 10 }}>Add your name in the firm settings first.</span>}
              </div>
            </>
          ))}
      </div>
      {ctx.jur.code === 'CA' && eng.type !== 'compilation' && <LicenceConfirmation ctx={ctx} />}
      <div className="card">
        <h3>{signed ? 'Checks at sign-off' : 'Before you can sign'}</h3>
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
                  // Keep the wording the partner is signing, so the signed report can never be redrafted.
                  const { signedReport: _old, signedFigures: _figs, ...settings } = eng.report;
                  const c = statements.cur;
                  const signedFigures = statements.npo
                    ? { npo: true, revenue: c.totalIncome, result: c.profit, totalAssets: c.totalAssets, netAssets: c.totalEquity }
                    : { revenue: c.v.revenue ?? 0, result: c.profit, totalAssets: c.totalAssets, netAssets: c.totalEquity };
                  await repo.updateEngagement(eng.id, { report: { ...settings, signedReport: draftFor(ctx, settings), signedFigures } });
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

const TRAIL_PAGE = 100;
const ACTION_LABEL: Record<string, string> = { insert: 'added', update: 'changed', delete: 'removed' };
const detailText = (d: Record<string, unknown> | null) =>
  d ? Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`).join('; ') : '';

/** The file's audit trail, page by page, with the whole of it downloadable for the file or a reviewer. */
export function TrailStep({ eng, client, ws }: Ctx) {
  const [offset, setOffset] = useState(0);
  const { data, error } = useLoad(() => repo.listLog(eng.id, { offset, limit: TRAIL_PAGE }), [eng.id, offset]);
  const { busy, error: dlError, run } = useAction();
  const who = (id: string | null) => (id === null ? 'Client, by upload link' : ws.members.find((m) => m.userId === id)?.fullName || 'Unknown user');
  const total = data?.total ?? 0;
  const download = () =>
    run(async () => {
      const { entries } = await repo.listLog(eng.id);
      const head = (v: string) => ({ value: v, type: String, fontWeight: 'bold' as const, textColor: '#ffffff', backgroundColor: '#1f3d33' });
      const text = (v: string) => ({ value: v, type: String });
      const sheet = {
        sheet: 'Audit trail',
        data: [
          [{ value: client.name, type: String, fontWeight: 'bold' as const }],
          [text(`Audit trail, year ended ${longDate(eng.yearEnd)}. ${entries.length.toLocaleString()} entries, newest first. Downloaded ${new Date().toLocaleString('en-GB')} by ${ws.me.fullName || 'a team member'}.`)],
          [],
          ['When', 'Who', 'Area', 'Action', 'Detail'].map(head),
          ...entries.map((l) => [text(new Date(l.at).toLocaleString('en-GB')), text(who(l.userId)), text(TABLE_LABEL[l.table] ?? l.table), text(ACTION_LABEL[l.action] ?? l.action), text(detailText(l.detail))]),
        ],
        columns: [{ width: 20 }, { width: 24 }, { width: 18 }, { width: 10 }, { width: 90 }],
        stickyRowsCount: 4,
        stickyColumnsCount: 0,
        orientation: 'landscape' as const,
      };
      await downloadWorkbook([sheet as never], `${client.name} audit trail ${eng.yearEnd.slice(0, 4)}`);
    });
  return (
    <div className="stack">
      <div>
        <h2>Audit trail</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Every change to this file, newest first. The trail is written by the database and cannot be edited. Download it whole for the file or for a reviewer.
        </p>
      </div>
      <ErrorNote error={error ?? dlError} />
      <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="small muted" aria-label="Trail position">
          {data ? (total ? `Showing ${(offset + 1).toLocaleString()} to ${Math.min(offset + TRAIL_PAGE, total).toLocaleString()} of ${total.toLocaleString()} entries` : '') : ''}
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - TRAIL_PAGE))}>Newer</button>
          <button disabled={!data || offset + TRAIL_PAGE >= total} onClick={() => setOffset(offset + TRAIL_PAGE)}>Older</button>
          <button disabled={busy || total === 0} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download the full trail (Excel)'}</button>
        </div>
      </div>
      <div className="card scroll-x">
        {!data ? (
          <span className="muted">Loading…</span>
        ) : data.entries.length === 0 ? (
          <span className="muted">Nothing recorded yet.</span>
        ) : (
          <table className="data" aria-label="Audit trail entries">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.at).toLocaleString('en-GB')}</td>
                  <td>{who(l.userId)}</td>
                  <td>
                    {TABLE_LABEL[l.table] ?? l.table} {ACTION_LABEL[l.action] ?? l.action}
                  </td>
                  <td className="small muted" style={{ wordBreak: 'break-word' }}>
                    {detailText(l.detail).slice(0, 200)}
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
