import { ITEM, isBalanceSheet } from './chart';
import { fmt2 } from './money';
import { buildStatements, type Figures } from './statements';
import type { Adjustment, EngagementType, Kobo, Planning, ProgrammeState, ReportSettings, TbLine } from './types';

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
