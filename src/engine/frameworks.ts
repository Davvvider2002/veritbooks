import type { EquityTable, Part, Row, Statements } from './statements';

/**
 * How a set of statements is presented under each framework. The figures are the same; the
 * words, the statements and, for a not-for-profit using the deferral method, where restricted
 * contributions sit, are not.
 *
 * - IFRS for SMEs: as built in statements.ts.
 * - ASPE (CPA Canada Handbook, Part II): a balance sheet, an income statement and a statement of
 *   retained earnings, with no other comprehensive income.
 * - ASNPO (Part III, used with Part II): a statement of financial position, a statement of
 *   operations and a statement of changes in net assets. Contributions follow the deferral
 *   method or the restricted fund method (Section 4410).
 *
 * Starter wording: a Canadian CPA must confirm the presentation against the Handbook in force.
 */
export type Gaap = 'ifrs-smes' | 'aspe' | 'asnpo';
export type ContributionMethod = 'deferral' | 'restricted-fund';

/** The framework an engagement reports under: Canada's for a Canadian firm, the IFRS for SMEs elsewhere. */
export const gaapOf = (country: string, planning: { entity?: string }): Gaap =>
  country === 'CA' ? (planning.entity === 'npo' ? 'asnpo' : 'aspe') : 'ifrs-smes';

export interface Titles {
  position: string;
  income: string;
  equity: string;
  cashFlow: string;
}

export function titlesFor(gaap: Gaap, npo: boolean): Titles {
  if (gaap === 'asnpo') return { position: 'Statement of financial position', income: 'Statement of operations', equity: 'Statement of changes in net assets', cashFlow: 'Statement of cash flows' };
  if (gaap === 'aspe') return { position: 'Balance sheet', income: 'Statement of income', equity: 'Statement of retained earnings', cashFlow: 'Statement of cash flows' };
  return npo
    ? { position: 'Statement of financial position', income: 'Statement of income and expenditure', equity: 'Statement of changes in funds', cashFlow: 'Statement of cash flows' }
    : { position: 'Statement of financial position', income: 'Statement of profit or loss and other comprehensive income', equity: 'Statement of changes in equity', cashFlow: 'Statement of cash flows' };
}

const ASPE_WORDS: Record<string, string> = {
  'Equity and liabilities': 'Liabilities and shareholders’ equity',
  Equity: 'Shareholders’ equity',
  'Total equity': 'Total shareholders’ equity',
  'Total equity and liabilities': 'Total liabilities and shareholders’ equity',
  'Gross profit': 'Gross margin',
  'Operating profit': 'Income from operations',
  'Profit before tax': 'Income before income taxes',
  'Income tax expense': 'Income taxes',
  'Profit for the year': 'Net income',
  'Income tax paid': 'Income taxes paid',
  'Depreciation and amortisation': 'Amortization',
  'Trade receivables': 'Accounts receivable',
  'Trade payables': 'Accounts payable and accrued liabilities',
  'Inventories': 'Inventory',
  Borrowings: 'Long-term debt',
  'Borrowings and bank overdrafts': 'Bank indebtedness and current portion of debt',
  'Current tax payable': 'Income taxes payable',
  'Deferred tax asset': 'Future income taxes',
  'Deferred tax liability': 'Future income taxes',
  'Finance costs': 'Interest expense',
  'Finance income': 'Investment income',
  'Share premium': 'Contributed surplus',
  'Selling and distribution costs': 'Selling expenses',
  'Administrative expenses': 'General and administrative expenses',
  'Finance costs paid': 'Interest paid',
  'Finance income received': 'Investment income received',
};

const ASNPO_WORDS: Record<string, string> = {
  'Funds and liabilities': 'Liabilities and net assets',
  Funds: 'Net assets',
  'Total funds': 'Total net assets',
  'Total funds and liabilities': 'Total liabilities and net assets',
  'Unrestricted funds': 'Unrestricted net assets',
  'Restricted funds': 'Externally restricted net assets',
  'Endowment funds': 'Net assets restricted for endowment',
  Income: 'Revenue',
  'Total income': 'Total revenue',
  Expenditure: 'Expenses',
  'Total expenditure': 'Total expenses',
  'Other expenditure': 'Other expenses',
  'Surplus/(deficit) before tax': 'Excess (deficiency) of revenue over expenses before income taxes',
  'Surplus/(deficit) for the year': 'Excess (deficiency) of revenue over expenses',
  'Of which, unrestricted funds': 'Of which, unrestricted',
  'Of which, restricted funds': 'Of which, externally restricted',
  'Endowment funds received': 'Endowment contributions received',
  'Depreciation and amortisation': 'Amortization of capital assets',
  'Income tax expense': 'Income taxes',
  'Income tax paid': 'Income taxes paid',
  'Programme and charitable activities': 'Program and charitable activities',
  'Finance income': 'Investment income',
  'Finance costs': 'Interest expense',
};

const FUND_COLUMNS: Record<string, string> = {
  'Unrestricted funds': 'Unrestricted',
  'Restricted funds': 'Externally restricted',
  'Endowment funds': 'Endowment',
};
const FUND_ROWS: Record<string, string> = {
  'At start of year': 'Balance, beginning of year',
  'Surplus/(deficit) for the year': 'Excess (deficiency) of revenue over expenses',
  'At end of year': 'Balance, end of year',
  'Transfers between funds': 'Interfund transfers',
};

const words = (gaap: Gaap): Record<string, string> => (gaap === 'asnpo' ? ASNPO_WORDS : gaap === 'aspe' ? ASPE_WORDS : {});

/** A label in the framework's words. Labels with no Canadian equivalent pass through unchanged. */
export function relabel(label: string, gaap: Gaap): string {
  const w = words(gaap);
  if (w[label]) return w[label];
  // Parts and notes built from a line name: "Depreciation and amortisation in administrative expenses".
  for (const [from, to] of Object.entries(w)) if (label.startsWith(from + ' ')) return to + label.slice(from.length);
  return label;
}

const relabelParts = (parts: Part[] | undefined, gaap: Gaap): Part[] | undefined =>
  parts?.map((p) => ({ ...p, label: relabel(p.label, gaap), parts: relabelParts(p.parts, gaap) }));
const relabelRows = (rows: Row[], gaap: Gaap): Row[] => rows.map((r) => ({ ...r, label: relabel(r.label, gaap), parts: relabelParts(r.parts, gaap) }));

/**
 * The statements in a framework's words, and for a not-for-profit under the deferral method,
 * with restricted contributions deferred until spent. The statements object is copied; the
 * original is not changed.
 */
export function present(st: Statements, gaap: Gaap, method: ContributionMethod = 'restricted-fund'): Statements {
  if (gaap === 'ifrs-smes') return st;
  const out: Statements = { ...st };
  if (gaap === 'asnpo' && st.npo && method === 'deferral') Object.assign(out, deferral(st));
  out.position = relabelRows(out.position, gaap);
  // A not-for-profit with no income taxes shows one excess of revenue over expenses, not a before-tax line too.
  const taxed = out.income.some((r) => r.code === 'income_tax_expense');
  out.income = relabelRows(gaap === 'asnpo' && !taxed ? out.income.filter((r) => r.label !== 'Surplus/(deficit) before tax') : out.income, gaap);
  out.cashFlow = out.cashFlow && relabelRows(out.cashFlow, gaap);
  out.cashFlowFull = out.cashFlowFull && relabelRows(out.cashFlowFull, gaap);
  out.pbtParts = relabelParts(out.pbtParts, gaap)!;
  out.profitParts = relabelParts(out.profitParts, gaap)!;
  out.noteBreakdowns = out.noteBreakdowns.map((n) => ({ ...n, title: relabel(n.title, gaap) }));
  if (gaap === 'asnpo')
    out.equity = {
      columns: out.equity.columns.map((c) => FUND_COLUMNS[c] ?? c),
      rows: out.equity.rows.map((r) => ({ ...r, label: FUND_ROWS[r.label] ?? r.label })),
    };
  return out;
}

/** A part that moves a figure by an amount, so that a figure's parts still add up to it. */
const adjustment = (label: string, cur: number, prior: number | null): Part => ({ label, cur, prior });

function shift(row: Row, cur: number, prior: number | null, label: string): Row {
  return {
    ...row,
    cur: (row.cur ?? 0) + cur,
    prior: row.prior === null ? null : row.prior + (prior ?? 0),
    parts: row.parts ? [...row.parts, adjustment(label, cur, row.prior === null ? null : (prior ?? 0))] : row.parts,
  };
}

/**
 * The deferral method (ASNPO 4410): a restricted contribution is recognised as revenue as the
 * expenses it was given for are incurred. Until then it is a liability, deferred contributions.
 * Restricted income and spending in the year move from the surplus to that liability, and the
 * restricted fund balance is shown as deferred contributions in place of restricted net assets.
 * Endowment contributions stay in net assets, as the standard requires.
 */
function deferral(st: Statements): Partial<Statements> {
  const curDeferred = st.cur.restrictedSurplus;
  const priorDeferred = st.prior ? st.prior.restrictedSurplus : null;
  const curBalance = st.cur.closingRestricted;
  const priorBalance = st.prior ? st.prior.closingRestricted : null;
  const deferLabel = 'Restricted contributions deferred, net of amounts recognized';

  // Statement of operations: restricted income not yet spent is deferred.
  const income: Row[] = [];
  for (const r of st.income) {
    if (r.label === 'Of which, unrestricted funds' || r.label === 'Of which, restricted funds') continue;
    if (r.label === 'Total income') {
      if (curDeferred !== 0 || (priorDeferred ?? 0) !== 0)
        income.push({ label: deferLabel, cur: -curDeferred, prior: priorDeferred === null ? null : -priorDeferred, style: 'line', code: 'restricted_funds' });
      income.push(shift(r, -curDeferred, priorDeferred === null ? null : -priorDeferred, deferLabel));
    } else if (r.label === 'Surplus/(deficit) before tax' || r.label === 'Surplus/(deficit) for the year') {
      income.push(shift(r, -curDeferred, priorDeferred === null ? null : -priorDeferred, deferLabel));
    } else income.push(r);
  }

  // Statement of financial position: restricted balances become deferred contributions.
  const position: Row[] = [];
  const deferredRow: Row = { label: 'Deferred contributions', cur: curBalance, prior: priorBalance, style: 'line', code: 'restricted_funds' };
  for (const r of st.position) {
    if (r.code === 'restricted_funds') continue;
    if (r.label === 'Total funds') position.push(shift(r, -curBalance, priorBalance === null ? null : -priorBalance, 'Deferred contributions, shown as a liability'));
    else if (r.label === 'Total liabilities') {
      if (curBalance !== 0 || (priorBalance ?? 0) !== 0) position.push(deferredRow);
      position.push(shift(r, curBalance, priorBalance, 'Deferred contributions'));
    } else position.push(r);
  }

  // Statement of changes in net assets: no restricted column.
  const keep = (vals: number[]) => [vals[0], vals[2], vals[0] + vals[2]];
  const equity: EquityTable = {
    columns: [st.equity.columns[0], st.equity.columns[2], st.equity.columns[3]],
    rows: st.equity.rows
      .map((r) => ({ label: r.label, style: r.style, values: keep(r.values), sources: r.sources ? [r.sources[0], r.sources[2], undefined] : undefined }))
      .filter((r) => r.style === 'total' || r.label === 'At start of year' || r.values.some((v) => v !== 0)),
  };

  // Cash flows: the surplus is lower, and the increase in deferred contributions is added back.
  const cf = (rows: Row[] | null | undefined): Row[] | null => {
    if (!rows) return null;
    const outRows: Row[] = [];
    for (const r of rows) {
      if (r.label === 'Surplus/(deficit) before tax') {
        outRows.push(shift(r, -curDeferred, r.prior === null ? null : -(priorDeferred ?? 0), deferLabel));
        outRows.push({ label: 'Increase (decrease) in deferred contributions', cur: curDeferred, prior: r.prior === null ? null : priorDeferred ?? 0, style: 'line' });
      } else outRows.push(r);
    }
    return outRows;
  };

  return { income, position, equity, cashFlow: cf(st.cashFlow), cashFlowFull: cf(st.cashFlowFull) ?? undefined };
}

/**
 * ASPE's statement of retained earnings, from the retained earnings column of the statement of
 * changes in equity, with the prior year alongside when it is held.
 */
export function retainedEarningsRows(equity: EquityTable, prior: EquityTable | null): Row[] {
  const col = equity.columns.indexOf('Retained earnings');
  const pcol = prior ? prior.columns.indexOf('Retained earnings') : -1;
  const label: Record<string, string> = {
    'At start of year': 'Retained earnings, beginning of year',
    'Profit for the year': 'Net income',
    Dividends: 'Dividends',
    'At end of year': 'Retained earnings, end of year',
  };
  const priorOf = (name: string) => {
    if (!prior || pcol < 0) return null;
    const r = prior.rows.find((x) => x.label === name);
    return r ? r.values[pcol] : 0;
  };
  return equity.rows
    .filter((r) => r.label in label || r.values[col] !== 0)
    .map((r) => ({
      label: label[r.label] ?? r.label,
      cur: r.values[col],
      prior: priorOf(r.label),
      style: r.style === 'total' ? ('total' as const) : ('line' as const),
      parts: r.sources?.[col],
    }));
}
