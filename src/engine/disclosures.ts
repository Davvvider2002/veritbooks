import { ITEM } from './chart';
import { adjustedBalances, groupParts, priorColumn, type EquityTable, type Figures, type Part, type Statements } from './statements';
import type { Adjustment, Disclosures, EarlierYear, Kobo, TbLine } from './types';

export interface PpeRow {
  code: string;
  name: string;
  opening: Kobo;
  /** Additions for a cost account; the charge for the year for a depreciation account. */
  increase: Kobo;
  disposals: Kobo;
  closing: Kobo;
}

export interface PpeSchedule {
  cost: PpeRow[];
  depreciation: PpeRow[];
  totalCost: PpeRow;
  totalDepreciation: PpeRow;
  carryingClosing: Kobo;
  carryingOpening: Kobo;
  /** Charge per the schedule less depreciation tagged in the mapping. Nil when they agree. */
  chargeDifference: Kobo;
}

const total = (name: string, rows: PpeRow[]): PpeRow => ({
  code: '',
  name,
  opening: rows.reduce((a, r) => a + r.opening, 0),
  increase: rows.reduce((a, r) => a + r.increase, 0),
  disposals: rows.reduce((a, r) => a + r.disposals, 0),
  closing: rows.reduce((a, r) => a + r.closing, 0),
});

/**
 * Movement schedule for property, plant and equipment, one row per ledger account.
 * Opening and closing come from the two trial balances. The preparer enters disposals;
 * additions and the charge for the year are whatever then explains the movement.
 * Returns null when there is no prior year, or nothing is mapped to property, plant and equipment.
 */
export function ppeSchedule(
  lines: TbLine[],
  adjustments: Adjustment[],
  cur: Figures,
  disposals: Record<string, Kobo> = {},
): PpeSchedule | null {
  const ppe = lines.filter((l) => l.mapCode === 'ppe');
  if (ppe.length === 0 || !ppe.some((l) => l.prior !== null)) return null;
  const bal = adjustedBalances(lines, adjustments, 'current');
  const cost: PpeRow[] = [];
  const depreciation: PpeRow[] = [];
  for (const l of ppe) {
    const opening = l.prior ?? 0;
    const closing = bal.get(l.id) ?? 0;
    if (opening === 0 && closing === 0) continue;
    const d = Math.max(0, disposals[l.code] ?? 0);
    if (opening < 0 || closing < 0) {
      // A credit balance: accumulated depreciation, shown as a positive figure.
      depreciation.push({ code: l.code, name: l.name, opening: -opening, increase: -closing + opening + d, disposals: d, closing: -closing });
    } else {
      cost.push({ code: l.code, name: l.name, opening, increase: closing - opening + d, disposals: d, closing });
    }
  }
  const totalCost = total('Total cost', cost);
  const totalDepreciation = total('Total accumulated depreciation', depreciation);
  return {
    cost,
    depreciation,
    totalCost,
    totalDepreciation,
    carryingClosing: totalCost.closing - totalDepreciation.closing,
    carryingOpening: totalCost.opening - totalDepreciation.opening,
    chargeDifference: totalDepreciation.increase - cur.depreciation,
  };
}

export interface TaxReconciliation {
  pbt: Kobo;
  rate: number;
  atRate: Kobo;
  items: { label: string; amount: Kobo }[];
  explained: Kobo;
  charge: Kobo;
  /** Charge per the accounts less the reconciled figure. Nil when the reconciliation is complete. */
  difference: Kobo;
  effectiveRate: number | null;
}

/** Reconciles the tax charge to accounting profit at the rate the preparer enters. No rate is assumed. */
export function taxReconciliation(cur: Figures, d: Disclosures): TaxReconciliation | null {
  if (d.taxRate === undefined || d.taxRate === null || Number.isNaN(d.taxRate)) return null;
  const atRate = Math.round((cur.pbt * d.taxRate) / 100);
  const items = (d.taxItems ?? []).filter((i) => i.label.trim() && i.amount !== 0);
  const explained = atRate + items.reduce((a, i) => a + i.amount, 0);
  const charge = cur.v.income_tax_expense;
  return {
    pbt: cur.pbt,
    rate: d.taxRate,
    atRate,
    items,
    explained,
    charge,
    difference: charge - explained,
    effectiveRate: cur.pbt !== 0 ? Math.round((charge / cur.pbt) * 1000) / 10 : null,
  };
}

/**
 * Statement of changes in equity for the prior year. Share capital, share premium and other
 * reserves are taken as unchanged during that year, because the year before it is not in the file.
 */
export function priorEquity(st: Statements): EquityTable | null {
  const p = st.prior;
  if (!p) return null;
  const withTotal = (v: Kobo[]) => [...v, v.reduce((a, b) => a + b, 0)];
  const capital = [p.v.share_capital, p.v.share_premium, p.v.other_reserves];
  const columns = st.equity.columns;
  const part = (code: string, amount: Kobo, accountsOnly = false, label = ITEM.get(code)!.label): Part => ({
    label,
    cur: amount,
    prior: null,
    code,
    period: 'prior',
    accountsOnly: accountsOnly || undefined,
  });
  const caps = ['share_capital', 'share_premium', 'other_reserves'].map((c, i) => [part(c, capital[i])]);
  const row = (label: string, values: Kobo[], cells: Part[][], style: 'line' | 'total' = 'line') => ({
    label,
    values: withTotal(values),
    style,
    sources: [...cells, cells.flatMap((c, i) => (values[i] !== 0 ? [{ ...groupParts(columns[i], c), prior: null }] : []))],
  });
  return {
    columns,
    rows: [
      row('At start of year', [...capital, p.v.retained_earnings], [...caps, [part('retained_earnings', p.v.retained_earnings, true, 'Retained earnings brought forward')]]),
      row('Profit for the year', [0, 0, 0, p.profit], [[], [], [], priorColumn(st.profitParts)]),
      row('Dividends', [0, 0, 0, -p.v.dividends], [[], [], [], [part('dividends', -p.v.dividends)]]),
      row('At end of year', [...capital, p.closingRetained], [...caps, [part('retained_earnings', p.closingRetained)]], 'total'),
    ],
  };
}

export interface MultiYear {
  years: string[];
  rows: { label: string; values: (Kobo | null)[]; style: 'heading' | 'line' | 'total' }[];
}

const asYear = (f: Figures, year: string): EarlierYear => ({
  year,
  revenue: f.v.revenue,
  pbt: f.pbt,
  tax: f.v.income_tax_expense,
  nca: f.totalNca,
  ca: f.totalCa,
  liabilities: f.totalLiabilities,
  capital: f.v.share_capital + f.v.share_premium,
  reserves: f.v.other_reserves + f.closingRetained,
});

/** Financial summary: each year imported (up to five), then earlier years as entered to make five. */
export function financialSummary(st: Statements, yearEnd: string, earlier: EarlierYear[] = []): MultiYear {
  const y = Number(yearEnd.slice(0, 4));
  const cols: EarlierYear[] = [asYear(st.cur, String(y))];
  if (st.prior) cols.push(asYear(st.prior, String(y - 1)));
  // The year before, from its imported trial balance, takes the place of figures typed in for it.
  if (st.prior && st.earlier) {
    cols.push(asYear(st.earlier, String(y - 2)));
    // Three and four years back, when their trial balances are imported too.
    (st.older ?? []).forEach((f, i) => cols.push(asYear(f, String(y - 3 - i))));
  }
  cols.push(...earlier.filter((e) => e.year.trim() && !cols.some((c) => c.year === e.year.trim())).slice(0, 5 - cols.length));
  const row = (label: string, f: (e: EarlierYear) => Kobo, style: 'line' | 'total' = 'line') => ({ label, values: cols.map(f), style });
  const head = (label: string) => ({ label, values: cols.map(() => null), style: 'heading' as const });
  return {
    years: cols.map((c) => c.year),
    rows: [
      head('Results'),
      row('Revenue', (e) => e.revenue),
      row('Profit before tax', (e) => e.pbt),
      row('Income tax expense', (e) => -e.tax),
      row('Profit for the year', (e) => e.pbt - e.tax, 'total'),
      head('Financial position'),
      row('Non-current assets', (e) => e.nca),
      row('Current assets', (e) => e.ca),
      row('Total liabilities', (e) => -e.liabilities),
      row('Net assets', (e) => e.nca + e.ca - e.liabilities, 'total'),
      head('Funded by'),
      row('Share capital and premium', (e) => e.capital),
      row('Reserves', (e) => e.reserves),
      row('Total equity', (e) => e.capital + e.reserves, 'total'),
    ],
  };
}

export const directorList = (d: Disclosures) =>
  (d.directors ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

/**
 * What still has to be completed before the financial statements can be issued.
 * An empty list means every disclosure this version produces has what it needs.
 */
export function disclosureGaps(
  d: Disclosures,
  st: Statements,
  lines: TbLine[],
  adjustments: Adjustment[],
  yearEnd: string,
): string[] {
  const gaps: string[] = [];
  if (directorList(d).length === 0) gaps.push('Name the directors.');
  if (!d.registeredOffice?.trim()) gaps.push('Enter the registered office.');
  if (!st.hasPrior) {
    gaps.push('Import the prior year trial balance: comparatives, the cash flow and the fixed asset schedule depend on it.');
  } else if (lines.some((l) => l.mapCode === 'ppe')) {
    const s = ppeSchedule(lines, adjustments, st.cur, d.ppeDisposals);
    if (s && s.chargeDifference !== 0) gaps.push('The fixed asset schedule does not agree to the depreciation charge. Check disposals and the depreciation tags in the mapping.');
    if (s && [...s.cost, ...s.depreciation].some((r) => r.increase < 0)) gaps.push('The fixed asset schedule shows negative additions or a negative charge. Enter the disposals.');
  }
  if (st.cur.v.income_tax_expense !== 0 || st.cur.pbt > 0) {
    const t = taxReconciliation(st.cur, d);
    if (!t) gaps.push('Enter the tax rate for the tax reconciliation.');
    else if (t.difference !== 0) gaps.push('The tax reconciliation has an unexplained difference.');
  }
  if (!d.noRelatedParties && (d.relatedParties ?? []).filter((r) => r.name.trim()).length === 0)
    gaps.push('List the related party transactions, or confirm there are none.');
  if (d.employees === undefined || d.employees === null) gaps.push('Enter the average number of employees.');
  if (d.directorsRemuneration === undefined || d.directorsRemuneration === null) gaps.push('Enter the directors’ remuneration.');
  for (const [key, label] of [
    ['goingConcern', 'going concern'],
    ['subsequentEvents', 'events after the reporting date'],
    ['contingencies', 'contingent liabilities'],
    ['commitments', 'capital commitments'],
  ] as const) {
    if (!d[key]?.trim()) gaps.push(`Complete the note on ${label}.`);
  }
  const years = financialSummary(st, yearEnd, d.earlierYears).years.length;
  if (years < 5) gaps.push(`The financial summary covers ${years} of 5 years. Enter the earlier years, or note why they are not available.`);
  return gaps;
}

/** Standard wording offered as a starting point. The preparer confirms it is true for the entity. */
export const STANDARD_NOTES = {
  goingConcern:
    'The directors have assessed the company’s ability to continue as a going concern and have no reason to believe it will not remain in operation for at least twelve months from the date these financial statements were approved. The financial statements are prepared on the going concern basis.',
  subsequentEvents:
    'There were no events after the reporting date that require adjustment to, or disclosure in, these financial statements.',
  contingencies: 'The company had no contingent liabilities at the reporting date.',
  commitments: 'The company had no capital commitments at the reporting date.',
} as const;
