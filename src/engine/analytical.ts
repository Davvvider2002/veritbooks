import { CHART, type Section } from './chart';
import type { Statements } from './statements';
import type { Kobo } from './types';

/** One line of the statements, this year against last. */
export interface Movement {
  code: string;
  label: string;
  section: Section;
  cur: Kobo;
  prior: Kobo;
  change: Kobo;
  /** Change as a percentage of last year. Null when last year was nil. */
  percent: number | null;
  /** True when the movement is large enough to need an explanation. */
  significant: boolean;
}

export interface Ratio {
  id: string;
  label: string;
  cur: number | null;
  prior: number | null;
  unit: '%' | 'days' | 'times';
}

export interface AnalyticalReview {
  movements: Movement[];
  ratios: Ratio[];
  /** A movement at or above this, and of 10% or more, needs an explanation. */
  threshold: Kobo;
  /** Where the threshold came from. */
  basis: 'performance materiality' | '1% of revenue' | '1% of total assets';
}

const PERCENT = 10;

/**
 * Analytical review: every statement line against last year, and the ratios an auditor looks at first.
 * A movement is significant when it is at least the threshold in amount and at least 10% of last year,
 * or when a line appears or disappears at an amount above the threshold.
 * Returns null without a prior year: there is nothing to compare.
 */
export function analyticalReview(st: Statements, performance: Kobo | null): AnalyticalReview | null {
  if (!st.prior) return null;
  const { cur, prior } = st;
  const byRevenue = Math.round(Math.abs(cur.v.revenue) / 100);
  const byAssets = Math.round(Math.abs(cur.totalAssets) / 100);
  const [threshold, basis]: [Kobo, AnalyticalReview['basis']] =
    performance && performance > 0 ? [performance, 'performance materiality'] : byRevenue > 0 ? [byRevenue, '1% of revenue'] : [byAssets, '1% of total assets'];

  const movements: Movement[] = [];
  for (const i of CHART) {
    const c = cur.v[i.code];
    const p = prior.v[i.code];
    if (c === 0 && p === 0) continue;
    const change = c - p;
    const percent = p === 0 ? null : Math.round((change / Math.abs(p)) * 1000) / 10;
    // Retained earnings brought forward moves by last year's profit and dividends, which needs no explaining.
    const significant = i.code !== 'retained_earnings' && Math.abs(change) >= threshold && threshold > 0 && (percent === null || Math.abs(percent) >= PERCENT);
    movements.push({ code: i.code, label: i.label, section: i.section, cur: c, prior: p, change, percent, significant });
  }

  const pct = (n: Kobo, d: Kobo) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
  const days = (balance: Kobo, flow: Kobo) => (flow <= 0 ? null : Math.round((balance / flow) * 365));
  const times = (n: Kobo, d: Kobo) => (d === 0 ? null : Math.round((n / d) * 100) / 100);
  const ratio = (id: string, label: string, unit: Ratio['unit'], f: (x: typeof cur) => number | null): Ratio => ({ id, label, unit, cur: f(cur), prior: f(prior) });
  const ratios = [
    ratio('gross_margin', 'Gross margin', '%', (x) => pct(x.grossProfit, x.v.revenue)),
    ratio('operating_margin', 'Operating margin', '%', (x) => pct(x.operatingProfit, x.v.revenue)),
    ratio('receivable_days', 'Receivable days', 'days', (x) => days(x.v.trade_receivables, x.v.revenue)),
    ratio('inventory_days', 'Inventory days', 'days', (x) => days(x.v.inventories, x.v.cost_of_sales)),
    ratio('payable_days', 'Payable days', 'days', (x) => days(x.v.trade_payables, x.v.cost_of_sales)),
    ratio('current_ratio', 'Current ratio', 'times', (x) => times(x.totalCa, x.totalCl)),
    ratio('gearing', 'Borrowings to equity', 'times', (x) => times(x.v.borrowings_nc + x.v.borrowings_c, x.totalEquity)),
    ratio('effective_tax', 'Effective tax rate', '%', (x) => (x.pbt > 0 ? pct(x.v.income_tax_expense, x.pbt) : null)),
  ].filter((r) => r.cur !== null || r.prior !== null);
  return { movements, ratios, threshold, basis };
}

/** Significant movements that have no explanation recorded. */
export const unexplainedMovements = (review: AnalyticalReview | null, notes: Record<string, { note: string }> | undefined) =>
  (review?.movements ?? []).filter((m) => m.significant && !notes?.[m.code]?.note.trim());
