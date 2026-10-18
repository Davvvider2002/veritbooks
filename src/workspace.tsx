import { useMemo, useState } from 'react';
import { reconcile, type Reconciliation } from './engine/bank';
import { computeMateriality, type BankGate } from './engine/checks';
import { testLedger, type GlEntry, type LedgerTest } from './engine/ledger';
import { adjustedBalances } from './engine/statements';
import type { BankAccount, ClientRequest, Evidence, StoredBankLine } from './data/repo';
import { RequestsStep } from './steps/requests';
import { EvidenceStep } from './steps/evidence';
import { BankStep, LedgerStep } from './steps/analytics';
import { DisclosuresStep } from './steps/disclosures';
import { ChecklistStep } from './steps/checklist';
import { PoliciesStep } from './steps/policies';
import { AnalyticalStep } from './steps/analytical';
import { ConsolidationStep } from './steps/consolidation';
import { TaxStep } from './steps/tax';
import { CipcStep } from './steps/cipc';
import { cashFlowBlocker, consolidate, groupCashFlow, groupEquity, unitOf, unitOfGroup, type Consolidated, type GroupEquity, type GroupSetup, type Unit } from './engine/consolidation';
import type { Row } from './engine/statements';
import { figures, hasPrior } from './engine/statements';
import { Link, useParams } from 'react-router-dom';
import { packOf, programmeFor } from './content/packs';
import { repo } from './data';
import type { Client, Engagement, Workspace } from './data/repo';
import { validateTrialBalance } from './engine/checks';
import { longDate } from './engine/report';
import { setCur } from './engine/money';
import { CURRENCIES, currencyOf, jurisdictionOf, type CurrencyCode, type Jurisdiction } from './content/jurisdictions';
import { buildStatements, type Statements } from './engine/statements';
import type { Adjustment, TbLine } from './engine/types';
import { TYPE_LABEL } from './pages';
import { ImportStep, MappingStep } from './steps/input';
import { ReportStep, SignOffStep, StatementsStep, TrailStep } from './steps/output';
import { JournalsStep, PlanningStep, ProgrammeStep } from './steps/work';
import { ErrorNote, useAction, useLoad } from './ui';
import { OpeningStep } from './steps/opening';
import { ManagementStep } from './steps/management';

export interface Ctx {
  ws: Workspace;
  /** The firm's country: the law its reports cite and the licence it signs with. */
  jur: Jurisdiction;
  eng: Engagement;
  client: Client;
  lines: TbLine[];
  adjustments: Adjustment[];
  statements: Statements;
  locked: boolean;
  reload: () => void;
  /** False when the database has not had the phase 2 migration applied. */
  analyticsReady: boolean;
  ledger: GlEntry[];
  /** Last year's general ledger, when the firm has imported it. It is not tested, only held for reference. */
  priorLedger: GlEntry[];
  /** False when the database has not had migration 0006 applied. */
  priorReady: boolean;
  ledgerTest: LedgerTest | null;
  bankAccounts: BankAccount[];
  recons: Recon[];
  bankGates: BankGate[];
  /** False when the database has not had the evidence migration applied. */
  evidenceReady: boolean;
  evidence: Evidence[];
  /** The consolidation, when this client is the parent of a group. Null when it has no subsidiaries. */
  group: Group | null;
  /** False when the database has not had the client requests migration applied. */
  requestsReady: boolean;
  requests: ClientRequest[];
}

export interface GroupMember {
  engagementId: string;
  /** Null when the subsidiary's engagement can no longer be read. */
  name: string | null;
  status: Engagement['status'] | null;
  yearEnd: string | null;
  /** True when the subsidiary is itself the parent of a group, and comes in already consolidated. */
  isGroup: boolean;
}
export interface Group {
  members: GroupMember[];
  /** Null when a subsidiary's engagement could not be read. */
  cur: Consolidated | null;
  /** Null unless the parent and every subsidiary hold a prior year. */
  prior: Consolidated | null;
  /** Changes in equity and cash flows need both years. */
  equity: GroupEquity | null;
  cashFlow: { rows: Row[]; difference: number } | null;
  /** Why the cash flow cannot be drawn from the file, when it cannot. */
  blocker: string | null;
}

/** A subsidiary's own file, with the files of any subsidiaries it holds in turn. */
interface Member {
  eng: Engagement;
  name: string;
  lines: TbLine[];
  adjustments: Adjustment[];
  subs: (Member | null)[];
}
const isParent = (g: GroupSetup | undefined) => !!g && (g.subsidiaries.length > 0 || (g.associates?.length ?? 0) > 0);

async function loadMember(id: string, clients: Client[], seen: Set<string>, depth: number): Promise<Member | null> {
  // A company cannot sit beneath itself, and groups are not expected to run deeper than this.
  if (seen.has(id) || depth > 4) return null;
  const eng = await repo.getEngagement(id).catch(() => null);
  if (!eng) return null;
  const [lines, adjustments] = await Promise.all([repo.listLines(id), repo.listAdjustments(id)]);
  const below = new Set(seen).add(id);
  const subs = await Promise.all((eng.planning.group?.subsidiaries ?? []).map((s) => loadMember(s.engagementId, clients, below, depth + 1)));
  return { eng, name: clients.find((c) => c.id === eng.clientId)?.name ?? 'Subsidiary', lines, adjustments, subs };
}

const memberHasPrior = (m: Member): boolean => hasPrior(m.lines) && m.subs.every((s) => !s || memberHasPrior(s));
const EMPTY = figures([], [], 'current');

/** A subsidiary for one year: its own figures, or its own group already consolidated. */
function memberUnit(m: Member, period: 'current' | 'prior', withPrior: boolean): Unit {
  const own = unitOf(m.name, figures(m.lines, m.adjustments, period));
  const setup = m.eng.planning.group;
  if (!isParent(setup)) return own;
  const units = (p: 'current' | 'prior') =>
    m.subs.map((s) => (s ? memberUnit(s, p, withPrior) : { ...unitOf('A subsidiary that could not be read', EMPTY), problems: ['its engagement could not be read, so it is left out.'] }));
  const opening = period === 'current' && withPrior ? consolidate(unitOf(m.name, figures(m.lines, m.adjustments, 'prior')), units('prior'), setup!, 'prior', m.eng.yearEnd) : null;
  return unitOfGroup(`${m.name} and its subsidiaries`, consolidate(own, units(period), setup!, period, m.eng.yearEnd, opening));
}

export interface Recon {
  account: BankAccount;
  lines: StoredBankLine[];
  /** Balance per the client's ledger, before audit journals. Null when the account code is no longer in the trial balance. */
  ledgerBalance: number | null;
  /** Net audit journals posted to the account in this file. */
  journals: number;
  /** Null when there is no general ledger to match against. */
  result: Reconciliation | null;
}

interface Heavy {
  ready: boolean;
  ledger: GlEntry[];
  priorLedger: GlEntry[];
  priorReady: boolean;
  bankAccounts: BankAccount[];
  bankLines: StoredBankLine[];
}

// Ledgers and statements run to thousands of rows, so they are fetched once per engagement
// and refetched only after an import or a removal.
const heavyCache = new Map<string, Promise<Heavy>>();
export const invalidateAnalytics = (engagementId: string) => heavyCache.delete(engagementId);
function loadHeavy(id: string): Promise<Heavy> {
  let p = heavyCache.get(id);
  if (!p) {
    // The prior year ledger is optional, and needs a later database update than the rest.
    p = Promise.all([repo.listLedger(id), repo.listBankAccounts(id), repo.listBankLines(id), repo.listLedger(id, 'prior').catch(() => null)]).then(
      ([ledger, bankAccounts, bankLines, priorLedger]) => ({ ready: true, ledger, priorLedger: priorLedger ?? [], priorReady: priorLedger !== null, bankAccounts, bankLines }),
      () => {
        heavyCache.delete(id);
        return { ready: false, ledger: [], priorLedger: [], priorReady: false, bankAccounts: [], bankLines: [] };
      },
    );
    heavyCache.set(id, p);
  }
  return p;
}

const STEPS = [
  { slug: 'import', label: 'Trial balance', el: ImportStep },
  { slug: 'mapping', label: 'Mapping', el: MappingStep },
  { slug: 'planning', label: 'Planning', el: PlanningStep },
  { slug: 'analytical', label: 'Analytical review', el: AnalyticalStep },
  { slug: 'opening', label: 'Opening balances', el: OpeningStep },
  { slug: 'requests', label: 'Client requests', el: RequestsStep },
  { slug: 'programme', label: 'Work programme', el: ProgrammeStep },
  { slug: 'ledger', label: 'Journal testing', el: LedgerStep },
  { slug: 'bank', label: 'Bank', el: BankStep },
  { slug: 'journals', label: 'Journals', el: JournalsStep },
  { slug: 'tax', label: 'Income tax', el: TaxStep },
  { slug: 'evidence', label: 'Evidence', el: EvidenceStep },
  { slug: 'disclosures', label: 'Disclosures', el: DisclosuresStep },
  { slug: 'policies', label: 'Accounting policies', el: PoliciesStep },
  { slug: 'checklist', label: 'Disclosure checklist', el: ChecklistStep },
  { slug: 'consolidation', label: 'Consolidation', el: ConsolidationStep },
  { slug: 'statements', label: 'Financial statements', el: StatementsStep },
  { slug: 'report', label: 'Report', el: ReportStep },
  { slug: 'management', label: 'Management letter', el: ManagementStep },
  { slug: 'sign-off', label: 'Sign-off', el: SignOffStep },
  { slug: 'cipc', label: 'CIPC filing', el: CipcStep },
  { slug: 'trail', label: 'Audit trail', el: TrailStep },
] as const;

/** The audit file number, shown under the engagement's name and editable until the file is signed. */
function FileNo({ eng, locked, reload }: { eng: Engagement; locked: boolean; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(eng.fileNo);
  const { busy, error, run } = useAction();
  if (!editing)
    return (
      <div className="small" style={{ marginTop: 4 }}>
        File no. {eng.fileNo ? <strong>{eng.fileNo}</strong> : <span className="muted">not set</span>}
        {!locked && (
          <>
            {' '}
            <button className="link" onClick={() => { setValue(eng.fileNo); setEditing(true); }}>
              {eng.fileNo ? 'Change' : 'Set'}
            </button>
          </>
        )}
      </div>
    );
  return (
    <form
      className="row"
      style={{ marginTop: 6, gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await repo.updateEngagement(eng.id, { fileNo: value });
          setEditing(false);
          reload();
        });
      }}
    >
      <input type="text" aria-label="Audit file number" value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} style={{ width: 200 }} />
      <button className="primary" disabled={busy}>Save</button>
      <button type="button" onClick={() => setEditing(false)}>Cancel</button>
      <ErrorNote error={error} />
    </form>
  );
}

/** The currency the statements are presented in. It can be changed until the file is signed. */
function CurrencyNote({ eng, jur, locked, reload }: { eng: Engagement; jur: Jurisdiction; locked: boolean; reload: () => void }) {
  const { busy, error, run } = useAction();
  const options = [...jur.currencies, ...(Object.keys(CURRENCIES) as CurrencyCode[]).filter((c) => !jur.currencies.includes(c))];
  return (
    <div className="small row" style={{ marginTop: 4, gap: 6 }}>
      <span>Presented in</span>
      {locked ? (
        <strong>{currencyOf(eng.currency).name}</strong>
      ) : (
        <select
          aria-label="Presentation currency"
          disabled={busy}
          value={eng.currency}
          onChange={(e) => void run(async () => { await repo.updateEngagement(eng.id, { currency: e.target.value as CurrencyCode }); reload(); })}
          style={{ padding: '2px 6px', width: 'auto' }}
        >
          {options.map((c) => (
            <option key={c} value={c}>{CURRENCIES[c].name}</option>
          ))}
        </select>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

export function EngagementPage({ ws }: { ws: Workspace }) {
  const { id = '', step } = useParams();
  const { data, error, reload } = useLoad(async () => {
    const eng = await repo.getEngagement(id);
    if (!eng) return null;
    const [clients, lines, adjustments, heavy, evidence, requests] = await Promise.all([
      repo.listClients(),
      repo.listLines(id),
      repo.listAdjustments(id),
      loadHeavy(id),
      repo.listEvidence(id).catch(() => null),
      repo.listRequests(id).catch(() => null),
    ]);
    // A parent's file reads each subsidiary's own file, which belongs to the same firm.
    const subs = await Promise.all((eng.planning.group?.subsidiaries ?? []).map((x) => loadMember(x.engagementId, clients, new Set([eng.id]), 1)));
    return { eng, client: clients.find((c) => c.id === eng.clientId) ?? null, lines, adjustments, heavy, evidence, requests, subs };
  }, [id]);

  const statements = useMemo(
    () => (data ? buildStatements(data.lines, data.adjustments) : null),
    [data],
  );

  const group = useMemo((): Group | null => {
    const setup = data?.eng.planning.group;
    if (!data || !statements || !data.client || !setup || (setup.subsidiaries.length === 0 && !setup.associates?.length)) return null;
    const members: GroupMember[] = setup.subsidiaries.map((s, i) => {
      const x = data.subs[i];
      return { engagementId: s.engagementId, name: x?.name ?? null, status: x?.eng.status ?? null, yearEnd: x?.eng.yearEnd ?? null, isGroup: !!x && isParent(x.eng.planning.group) };
    });
    const none = { members, cur: null, prior: null, equity: null, cashFlow: null, blocker: null };
    if (data.subs.some((x) => !x)) return none;
    const subs = data.subs.map((x) => x!);
    const top = (period: 'current' | 'prior') => unitOf(data.client!.name, period === 'current' ? statements.cur : statements.prior!);
    const both = statements.hasPrior && subs.every(memberHasPrior);
    const prior = both ? consolidate(top('prior'), subs.map((x) => memberUnit(x, 'prior', true)), setup, 'prior', data.eng.yearEnd) : null;
    const cur = consolidate(top('current'), subs.map((x) => memberUnit(x, 'current', both)), setup, 'current', data.eng.yearEnd, prior);
    return { members, cur, prior, equity: prior ? groupEquity(cur, prior) : null, cashFlow: prior ? groupCashFlow(cur, prior) : null, blocker: cashFlowBlocker(cur) };
  }, [data, statements]);

  const analytics = useMemo(() => {
    if (!data || !statements) return null;
    const { heavy, lines, adjustments, eng } = data;
    const m = computeMateriality(statements.cur, eng.planning);
    const ledgerTest = heavy.ledger.length
      ? testLedger(heavy.ledger, lines, { yearEnd: eng.yearEnd, performance: m?.performance ?? null })
      : null;
    const balances = adjustedBalances(lines, adjustments, 'current');
    const recons: Recon[] = heavy.bankAccounts.map((account) => {
      const line = lines.find((l) => l.code === account.accountCode);
      // The client's ledger is matched to the statement as the client kept it. Journals posted
      // in this file are shown separately, as the adjustment for items the client had not booked.
      const ledgerBalance = line ? line.balance : null;
      const journals = line ? (balances.get(line.id) ?? line.balance) - line.balance : 0;
      const bank = heavy.bankLines.filter((l) => l.accountId === account.id);
      const result =
        heavy.ledger.length && ledgerBalance !== null
          ? reconcile({
              bank,
              ledger: heavy.ledger.filter((e) => e.accountCode === account.accountCode),
              bankClosing: account.closing,
              ledgerBalance,
              yearEnd: eng.yearEnd,
            })
          : null;
      return { account, lines: bank, ledgerBalance, journals, result };
    });
    const bankGates: BankGate[] = recons.map((r) => ({
      id: r.account.id,
      name: r.account.name,
      difference: r.result ? r.result.difference : (r.ledgerBalance ?? 0) - r.account.closing,
      bankOnly: r.result?.bankOnly.length ?? 0,
      unbooked: (r.result?.bankOnlyTotal ?? 0) - r.journals,
      breaks: r.account.breaks,
      matched: r.result !== null,
    }));
    return { ledgerTest, recons, bankGates };
  }, [data, statements]);

  if (error) return <div className="page"><ErrorNote error={error} /></div>;
  if (data === undefined) return <div className="page muted">Loading…</div>;
  if (data === null || !data.client || !statements || !analytics)
    return (
      <div className="page">
        <div className="banner warn">This engagement was not found. <Link to="/">Back to engagements</Link></div>
      </div>
    );

  // Review and compilation engagements have no materiality step in this version.
  const jur = jurisdictionOf(ws.firm.country);
  const steps = STEPS.filter((s) => {
    // The SARS tax working and the CIPC filing are South African.
    if (s.slug === 'tax' || s.slug === 'cipc') return jur.code === 'ZA';
    if (s.slug === 'planning' || s.slug === 'analytical' || s.slug === 'opening' || s.slug === 'management') return data.eng.type !== 'compilation';
    if (s.slug === 'ledger' || s.slug === 'bank') return data.eng.type === 'audit';
    return true;
  });
  const current = steps.find((s) => s.slug === step) ?? steps[0];
  const Step = current.el;
  // Every amount label in the steps below follows this engagement's currency.
  setCur(currencyOf(data.eng.currency).symbol);
  const ctx: Ctx = {
    ws,
    jur,
    eng: data.eng,
    client: data.client,
    lines: data.lines,
    adjustments: data.adjustments,
    statements,
    // A firm whose trial or plan has ended can read its files and change nothing.
    locked: data.eng.status === 'locked' || ws.billing.state === 'suspended' || (ws.billing.state === 'expired' && !data.eng.payPer),
    reload,
    analyticsReady: data.heavy.ready,
    ledger: data.heavy.ledger,
    priorLedger: data.heavy.priorLedger,
    priorReady: data.heavy.priorReady,
    ledgerTest: analytics.ledgerTest,
    bankAccounts: data.heavy.bankAccounts,
    recons: analytics.recons,
    bankGates: analytics.bankGates,
    evidenceReady: data.evidence !== null,
    evidence: data.evidence ?? [],
    group,
    requestsReady: data.requests !== null,
    requests: data.requests ?? [],
  };
  const tb = validateTrialBalance(data.lines);
  const programme = programmeFor(data.eng.type, data.eng.planning);
  const programmeDone = programme.filter((i) => data.eng.programme[i.id]?.done).length;

  return (
    <div className="page">
      <div className="between no-print" style={{ marginBottom: 22 }}>
        <div>
          <nav className="small muted crumbs" aria-label="Breadcrumb">
            <Link to="/">Engagements</Link> / <Link to={`/clients?c=${data.client.id}`}>{data.client.name}</Link> / {TYPE_LABEL[data.eng.type]} {data.eng.yearEnd.slice(0, 4)}
          </nav>
          <h1 style={{ marginTop: 4 }}>{data.client.name}</h1>
          <div className="muted">Year ended {longDate(data.eng.yearEnd)} · IFRS for SMEs{packOf(data.eng.planning) ? ` · ${packOf(data.eng.planning)!.name}` : ''}</div>
          <FileNo eng={data.eng} locked={ctx.locked} reload={reload} />
          <CurrencyNote eng={data.eng} jur={ctx.jur} locked={ctx.locked} reload={reload} />
        </div>
        <div className="row">
          {data.lines.length > 0 && (
            <span className={`tag ${tb.every((c) => c.ok || !c.blocking) ? 'ok' : 'warn'}`}>
              {tb.every((c) => c.ok || !c.blocking) ? 'Trial balance clean' : 'Trial balance needs attention'}
            </span>
          )}
          <span className="tag">
            Programme {programmeDone}/{programme.length}
          </span>
          {ctx.evidence.length > 0 && <span className="tag">{ctx.evidence.length} evidence file{ctx.evidence.length === 1 ? '' : 's'}</span>}
          {data.eng.status === 'locked' ? <span className="tag ok">Signed and locked</span> : ctx.locked ? <span className="tag bad">Read-only</span> : <span className="tag">In progress</span>}
        </div>
      </div>

      <div className="workspace">
        <nav className="steps" aria-label="Engagement steps">
          {steps.map((s, i) => (
            <Link
              key={s.slug}
              to={`/engagements/${id}/${s.slug}`}
              className={s.slug === current.slug ? 'active' : ''}
              aria-current={s.slug === current.slug ? 'step' : undefined}
            >
              <span className="n">{i + 1}</span>
              {s.label}
            </Link>
          ))}
        </nav>
        <main>
          {data.eng.status === 'locked' && current.slug !== 'statements' && current.slug !== 'report' && (
            <div className="banner info no-print" style={{ marginBottom: 16 }}>
              This file was signed by {data.eng.signedByName} on {longDate((data.eng.signedAt ?? '').slice(0, 10))} and is locked. Nothing in it can be changed.
            </div>
          )}
          <Step {...ctx} />
          <nav className="step-nav no-print" aria-label="Previous and next step">
            {steps.indexOf(current) > 0 && (
              <Link to={`/engagements/${id}/${steps[steps.indexOf(current) - 1].slug}`} className="prev">
                ← {steps[steps.indexOf(current) - 1].label}
              </Link>
            )}
            {steps.indexOf(current) < steps.length - 1 && (
              <Link to={`/engagements/${id}/${steps[steps.indexOf(current) + 1].slug}`} className="next">
                {steps[steps.indexOf(current) + 1].label} →
              </Link>
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}
