import { useMemo } from 'react';
import { reconcile, type Reconciliation } from './engine/bank';
import { computeMateriality, type BankGate } from './engine/checks';
import { testLedger, type GlEntry, type LedgerTest } from './engine/ledger';
import { adjustedBalances } from './engine/statements';
import type { BankAccount, ClientRequest, Evidence, StoredBankLine } from './data/repo';
import { RequestsStep } from './steps/requests';
import { EvidenceStep } from './steps/evidence';
import { BankStep, LedgerStep } from './steps/analytics';
import { DisclosuresStep } from './steps/disclosures';
import { Link, useParams } from 'react-router-dom';
import { PROGRAMMES } from './content/programmes';
import { repo } from './data';
import type { Client, Engagement, Workspace } from './data/repo';
import { validateTrialBalance } from './engine/checks';
import { longDate } from './engine/report';
import { buildStatements, type Statements } from './engine/statements';
import type { Adjustment, TbLine } from './engine/types';
import { TYPE_LABEL } from './pages';
import { ImportStep, MappingStep } from './steps/input';
import { ReportStep, SignOffStep, StatementsStep, TrailStep } from './steps/output';
import { JournalsStep, PlanningStep, ProgrammeStep } from './steps/work';
import { ErrorNote, useLoad } from './ui';

export interface Ctx {
  ws: Workspace;
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
  ledgerTest: LedgerTest | null;
  bankAccounts: BankAccount[];
  recons: Recon[];
  bankGates: BankGate[];
  /** False when the database has not had the evidence migration applied. */
  evidenceReady: boolean;
  evidence: Evidence[];
  /** False when the database has not had the client requests migration applied. */
  requestsReady: boolean;
  requests: ClientRequest[];
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
    p = Promise.all([repo.listLedger(id), repo.listBankAccounts(id), repo.listBankLines(id)]).then(
      ([ledger, bankAccounts, bankLines]) => ({ ready: true, ledger, bankAccounts, bankLines }),
      () => {
        heavyCache.delete(id);
        return { ready: false, ledger: [], bankAccounts: [], bankLines: [] };
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
  { slug: 'requests', label: 'Client requests', el: RequestsStep },
  { slug: 'programme', label: 'Work programme', el: ProgrammeStep },
  { slug: 'ledger', label: 'Journal testing', el: LedgerStep },
  { slug: 'bank', label: 'Bank', el: BankStep },
  { slug: 'journals', label: 'Journals', el: JournalsStep },
  { slug: 'evidence', label: 'Evidence', el: EvidenceStep },
  { slug: 'disclosures', label: 'Disclosures', el: DisclosuresStep },
  { slug: 'statements', label: 'Financial statements', el: StatementsStep },
  { slug: 'report', label: 'Report', el: ReportStep },
  { slug: 'sign-off', label: 'Sign-off', el: SignOffStep },
  { slug: 'trail', label: 'Audit trail', el: TrailStep },
] as const;

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
    return { eng, client: clients.find((c) => c.id === eng.clientId) ?? null, lines, adjustments, heavy, evidence, requests };
  }, [id]);

  const statements = useMemo(
    () => (data ? buildStatements(data.lines, data.adjustments) : null),
    [data],
  );

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
  const steps = STEPS.filter((s) => {
    if (s.slug === 'planning') return data.eng.type !== 'compilation';
    if (s.slug === 'ledger' || s.slug === 'bank') return data.eng.type === 'audit';
    return true;
  });
  const current = steps.find((s) => s.slug === step) ?? steps[0];
  const Step = current.el;
  const ctx: Ctx = {
    ws,
    eng: data.eng,
    client: data.client,
    lines: data.lines,
    adjustments: data.adjustments,
    statements,
    locked: data.eng.status === 'locked',
    reload,
    analyticsReady: data.heavy.ready,
    ledger: data.heavy.ledger,
    ledgerTest: analytics.ledgerTest,
    bankAccounts: data.heavy.bankAccounts,
    recons: analytics.recons,
    bankGates: analytics.bankGates,
    evidenceReady: data.evidence !== null,
    evidence: data.evidence ?? [],
    requestsReady: data.requests !== null,
    requests: data.requests ?? [],
  };
  const tb = validateTrialBalance(data.lines);
  const programmeDone = PROGRAMMES[data.eng.type].filter((i) => data.eng.programme[i.id]?.done).length;

  return (
    <div className="page">
      <div className="between no-print" style={{ marginBottom: 22 }}>
        <div>
          <div className="small muted">
            <Link to="/">Engagements</Link> / {TYPE_LABEL[data.eng.type]}
          </div>
          <h1 style={{ marginTop: 4 }}>{data.client.name}</h1>
          <div className="muted">Year ended {longDate(data.eng.yearEnd)} · IFRS for SMEs</div>
        </div>
        <div className="row">
          {data.lines.length > 0 && (
            <span className={`tag ${tb.every((c) => c.ok || !c.blocking) ? 'ok' : 'warn'}`}>
              {tb.every((c) => c.ok || !c.blocking) ? 'Trial balance clean' : 'Trial balance needs attention'}
            </span>
          )}
          <span className="tag">
            Programme {programmeDone}/{PROGRAMMES[data.eng.type].length}
          </span>
          {ctx.evidence.length > 0 && <span className="tag">{ctx.evidence.length} evidence file{ctx.evidence.length === 1 ? '' : 's'}</span>}
          {ctx.locked ? <span className="tag ok">Signed and locked</span> : <span className="tag">In progress</span>}
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
          {ctx.locked && current.slug !== 'statements' && current.slug !== 'report' && (
            <div className="banner info no-print" style={{ marginBottom: 16 }}>
              This file was signed by {data.eng.signedByName} on {longDate((data.eng.signedAt ?? '').slice(0, 10))} and is locked. Nothing in it can be changed.
            </div>
          )}
          <Step {...ctx} />
        </main>
      </div>
    </div>
  );
}
