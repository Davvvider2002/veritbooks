import { ITEM, isBalanceSheet } from './chart';
import { fmt2 } from './money';
import { buildStatements, type Figures } from './statements';
import type { LedgerTest } from './ledger';
import type { Adjustment, EngagementType, Kobo, Planning, ProgrammeState, ReportSettings, TbLine, Testing } from './types';

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  /** Blocking checks stop sign-off. Advisory checks are shown for the reviewer. */
  blocking: boolean;
}

/** Validation of the imported trial balance, run before anything is drafted. */
export function validateTrialBalance(lines: TbLine[]): Check[] {
  const checks: Check[] = [];
  const sum = lines.reduce((a, l) => a + l.balance, 0);
  checks.push({
    id: 'tb_foots',
    label: 'Current year trial balance foots',
    ok: lines.length > 0 && sum === 0,
    detail:
      lines.length === 0
        ? 'No trial balance has been imported.'
        : sum === 0
          ? undefined
          : `Debits and credits differ by ${fmt2(Math.abs(sum))}.`,
    blocking: true,
  });
  const withPrior = lines.some((l) => l.prior !== null);
  if (withPrior) {
    const ps = lines.reduce((a, l) => a + (l.prior ?? 0), 0);
    checks.push({
      id: 'prior_foots',
      label: 'Prior year trial balance foots',
      ok: ps === 0,
      detail: ps === 0 ? undefined : `Debits and credits differ by ${fmt2(Math.abs(ps))}.`,
      blocking: true,
    });
  } else {
    checks.push({
      id: 'prior_present',
      label: 'Prior year trial balance imported',
      ok: false,
      detail: 'Without it there are no comparatives and no statement of cash flows.',
      blocking: false,
    });
  }
  const unmapped = lines.filter((l) => !l.mapCode || !ITEM.has(l.mapCode));
  checks.push({
    id: 'mapped',
    label: 'Every account is mapped to a line item',
    ok: lines.length > 0 && unmapped.length === 0,
    detail: unmapped.length ? `${unmapped.length} account(s) are not mapped.` : undefined,
    blocking: true,
  });
  if (lines.length > 0 && unmapped.length === 0) {
    const hasResult = lines.some((l) => !isBalanceSheet(ITEM.get(l.mapCode!)!.section));
    checks.push({
      id: 'pre_closing',
      label: 'Trial balance is before closing entries',
      ok: hasResult,
      detail: hasResult
        ? undefined
        : 'No income or expense accounts were found. Import the trial balance before the year-end closing journal.',
      blocking: true,
    });
  }
  return checks;
}

export interface Materiality {
  base: Kobo;
  overall: Kobo;
  performance: Kobo;
  trivial: Kobo;
}

export const BENCHMARKS = {
  revenue: { label: 'Revenue', range: '0.5% to 2%', suggested: 1 },
  profit_before_tax: { label: 'Profit before tax', range: '5% to 10%', suggested: 5 },
  total_assets: { label: 'Total assets', range: '1% to 2%', suggested: 1 },
  equity: { label: 'Equity', range: '2% to 5%', suggested: 2 },
} as const;

export function benchmarkBase(f: Figures, benchmark: NonNullable<Planning['benchmark']>): Kobo {
  switch (benchmark) {
    case 'revenue':
      return f.v.revenue;
    case 'profit_before_tax':
      return Math.abs(f.pbt);
    case 'total_assets':
      return f.totalAssets;
    case 'equity':
      return Math.abs(f.totalEquity);
  }
}

export function computeMateriality(f: Figures, p: Planning): Materiality | null {
  if (!p.benchmark || !p.percent || p.percent <= 0) return null;
  const base = benchmarkBase(f, p.benchmark);
  const overall = Math.round((base * p.percent) / 100);
  return {
    base,
    overall,
    performance: Math.round((overall * (p.performancePercent ?? 75)) / 100),
    trivial: Math.round((overall * (p.trivialPercent ?? 5)) / 100),
  };
}

/** Net effect on profit before tax of journals that were proposed but not posted. */
export function unadjustedEffect(lines: TbLine[], adjustments: Adjustment[]): Kobo {
  const byId = new Map(lines.map((l) => [l.id, l]));
  let effect = 0;
  for (const a of adjustments) {
    if (a.posted) continue;
    for (const j of a.lines) {
      const code = byId.get(j.lineId)?.mapCode;
      const item = code ? ITEM.get(code) : undefined;
      if (item && (item.section === 'income' || item.section === 'expense')) effect -= j.amount;
    }
  }
  return effect;
}

export interface GateInput {
  type: EngagementType;
  lines: TbLine[];
  adjustments: Adjustment[];
  planning: Planning;
  programme: ProgrammeState;
  programmeItemIds: string[];
  report: ReportSettings;
  firmFrc: string;
  signerRole: string;
  signerFrc: string;
  /** Result of journal testing, or null when no general ledger has been imported. */
  ledger?: LedgerTest | null;
  testing?: Testing;
  /** One entry per bank statement imported. */
  bank?: BankGate[];
}

export interface BankGate {
  id: string;
  name: string;
  /** Unexplained difference between the ledger and the reconciled statement balance. */
  difference: Kobo;
  /** Items on the statement that are not in the ledger. */
  bankOnly: number;
  /** Net value of those items less the audit journals posted to the account. Nil when they have been adjusted for. */
  unbooked: Kobo;
  breaks: number;
  /** False when there is no ledger to match the statement against. */
  matched: boolean;
}

/** Gates from journal testing and bank reconciliation. They apply to audits only. */
export function analyticsChecks(g: Pick<GateInput, 'type' | 'ledger' | 'testing' | 'bank'>): Check[] {
  if (g.type !== 'audit') return [];
  const checks: Check[] = [];
  const t = g.ledger;
  if (!t) {
    checks.push({
      id: 'ledger_present',
      label: 'General ledger imported for journal testing',
      ok: false,
      detail: 'Without it, journals are not tested in this file. Document the alternative procedures.',
      blocking: false,
    });
  } else {
    checks.push({
      id: 'ledger_agrees',
      label: 'General ledger agrees to the trial balance',
      ok: t.disagreements === 0 && t.unknownAccounts.length === 0,
      detail:
        t.disagreements || t.unknownAccounts.length
          ? `${t.disagreements} account(s) do not agree and ${t.unknownAccounts.length} ledger account(s) are not in the trial balance. The journal population may be incomplete.`
          : undefined,
      blocking: false,
    });
    const done = g.testing?.journals ?? {};
    const open = t.highRisk.filter((j) => !done[j.entryNo]);
    checks.push({
      id: 'journals_concluded',
      label: 'Every high-risk journal is tested and concluded on',
      ok: open.length === 0,
      detail: open.length ? `${open.length} of ${t.highRisk.length} high-risk journal(s) have no conclusion.` : undefined,
      blocking: true,
    });
    const exceptions = Object.values(done).filter((d) => d.status === 'exception').length;
    if (exceptions) {
      checks.push({
        id: 'journal_exceptions',
        label: 'No journal was concluded as an exception',
        ok: false,
        detail: `${exceptions} journal(s) are recorded as exceptions. Consider the effect on the opinion.`,
        blocking: false,
      });
    }
  }
  const bank = g.bank ?? [];
  if (bank.length === 0) {
    checks.push({
      id: 'bank_present',
      label: 'Bank statements imported and reconciled',
      ok: false,
      detail: 'No bank statement is in this file. Document the bank work done elsewhere.',
      blocking: false,
    });
  }
  for (const b of bank) {
    const clean = b.matched && b.difference === 0 && (b.bankOnly === 0 || b.unbooked === 0);
    const concluded = !!g.testing?.bank?.[b.id]?.note.trim();
    checks.push({
      id: `bank_${b.id}`,
      label: `Bank reconciliation: ${b.name}`,
      ok: clean || concluded,
      detail: clean
        ? undefined
        : concluded
          ? 'Not clean, but a conclusion is recorded.'
          : !b.matched
            ? 'The statement has not been matched to the ledger. Import the general ledger, or record a conclusion.'
            : `Unexplained difference of ${fmt2(Math.abs(b.difference))}, and ${b.bankOnly} statement item(s) not in the ledger with ${fmt2(Math.abs(b.unbooked))} still to be adjusted. Post the journal or record a conclusion.`,
      blocking: true,
    });
    if (b.breaks > 0) {
      checks.push({
        id: `bank_breaks_${b.id}`,
        label: `Statement running balance is unbroken: ${b.name}`,
        ok: false,
        detail: `${b.breaks} row(s) do not follow from the row before. Pages or transactions may be missing, or the statement may have been altered.`,
        blocking: false,
      });
    }
  }
  return checks;
}

/** Everything that must be true before the engagement partner can sign and lock the file. */
export function signOffChecks(g: GateInput): Check[] {
  const checks = validateTrialBalance(g.lines).filter((c) => c.blocking);
  const st = buildStatements(g.lines, g.adjustments);

  checks.push({
    id: 'position_balances',
    label: 'Statement of financial position balances',
    ok: g.lines.length > 0 && st.cur.totalAssets === st.cur.totalEquityAndLiabilities,
    blocking: true,
  });
  for (const a of g.adjustments) {
    const s = a.lines.reduce((x, j) => x + j.amount, 0);
    if (s !== 0) {
      checks.push({ id: `journal_${a.id}`, label: `Journal ${a.ref} balances`, ok: false, blocking: true });
    }
  }
  if (st.hasPrior) {
    checks.push({
      id: 'opening_agrees',
      label: 'Opening retained earnings agree to the prior year closing figure',
      ok: st.cashFlowDifference === 0,
      detail:
        st.cashFlowDifference === 0
          ? undefined
          : `Difference of ${fmt2(Math.abs(st.cashFlowDifference ?? 0))}. Resolve it or document why before signing.`,
      blocking: false,
    });
  }

  if (g.type === 'audit') {
    const m = computeMateriality(st.cur, g.planning);
    checks.push({
      id: 'materiality',
      label: 'Materiality is set, with a rationale',
      ok: !!m && m.overall > 0 && !!g.planning.rationale?.trim(),
      blocking: true,
    });
    if (m) {
      const u = Math.abs(unadjustedEffect(g.lines, g.adjustments));
      checks.push({
        id: 'unadjusted',
        label: 'Unadjusted differences are below overall materiality',
        ok: u < m.overall,
        detail: u === 0 ? undefined : `Net effect on profit of ${fmt2(u)} against materiality of ${fmt2(m.overall)}.`,
        blocking: false,
      });
    }
  }

  checks.push(...analyticsChecks(g));

  const open = g.programmeItemIds.filter((id) => !g.programme[id]?.done);
  checks.push({
    id: 'programme',
    label: 'Every work programme step is completed',
    ok: open.length === 0,
    detail: open.length ? `${open.length} step(s) are still open.` : undefined,
    blocking: true,
  });

  if (g.type === 'audit') {
    checks.push({
      id: 'opinion',
      label: 'The partner has selected the opinion',
      ok: !!g.report.opinion && (g.report.opinion === 'unmodified' || !!g.report.basis?.trim()),
      detail:
        g.report.opinion && g.report.opinion !== 'unmodified' && !g.report.basis?.trim()
          ? 'A modified opinion needs a basis paragraph.'
          : undefined,
      blocking: true,
    });
  }
  checks.push({
    id: 'directors',
    label: 'Chief executive and chief financial officer are named with FRC numbers',
    ok: !!(g.report.ceoName?.trim() && g.report.ceoFrc?.trim() && g.report.cfoName?.trim() && g.report.cfoFrc?.trim()),
    blocking: g.type === 'audit',
  });
  checks.push({
    id: 'firm_frc',
    label: 'The firm has an FRC registration number on file',
    ok: !!g.firmFrc.trim(),
    blocking: true,
  });
  checks.push({
    id: 'signer',
    label: 'The person signing is an engagement partner with an FRC number',
    ok: g.signerRole === 'partner' && !!g.signerFrc.trim(),
    blocking: true,
  });
  return checks;
}

export const canSign = (checks: Check[]) => checks.every((c) => c.ok || !c.blocking);
