import { CHART, ITEM, NATURE_CODES, type Section } from './chart';
import type { Adjustment, Kobo, TbLine } from './types';

export type Period = 'current' | 'prior';

export interface Row {
  label: string;
  cur: Kobo | null;
  prior: Kobo | null;
  style: 'heading' | 'line' | 'subtotal' | 'total' | 'check';
  note?: number;
}

/** Figures for one period, in presentation sign: assets, expenses and dividends are debit-positive; liabilities, equity and income are credit-positive. */
export interface Figures {
  v: Record<string, Kobo>;
  staff: Kobo;
  depreciation: Kobo;
  grossProfit: Kobo;
  operatingProfit: Kobo;
  pbt: Kobo;
  profit: Kobo;
  totalNca: Kobo;
  totalCa: Kobo;
  totalAssets: Kobo;
  closingRetained: Kobo;
  totalEquity: Kobo;
  totalNcl: Kobo;
  totalCl: Kobo;
  totalLiabilities: Kobo;
  totalEquityAndLiabilities: Kobo;
  /** Debit-positive total of accounts with no mapping. Statements are incomplete while this is not nil or any account is unmapped. */
  unmapped: Kobo;
  unmappedCount: number;
  /** Debit-positive sum of the whole trial balance. Nil when it foots. */
  tbDifference: Kobo;
}

const DEBIT_SECTIONS: Section[] = ['nca', 'ca', 'expense', 'distribution'];

/** Balance of each account for a period, after posted adjusting journals (current period only). */
export function adjustedBalances(
  lines: TbLine[],
  adjustments: Adjustment[],
  period: Period,
): Map<string, Kobo> {
  const out = new Map<string, Kobo>();
  for (const l of lines) out.set(l.id, period === 'current' ? l.balance : (l.prior ?? 0));
  if (period === 'current') {
    for (const a of adjustments) {
      if (!a.posted) continue;
      for (const j of a.lines) {
        if (out.has(j.lineId)) out.set(j.lineId, out.get(j.lineId)! + j.amount);
      }
    }
  }
  return out;
}

export function figures(lines: TbLine[], adjustments: Adjustment[], period: Period): Figures {
  const bal = adjustedBalances(lines, adjustments, period);
  const t: Record<string, Kobo> = {};
  for (const i of CHART) t[i.code] = 0;
  let staff = 0;
  let depreciation = 0;
  let unmapped = 0;
  let unmappedCount = 0;
  let tbDifference = 0;

  for (const l of lines) {
    const b = bal.get(l.id) ?? 0;
    tbDifference += b;
    if (!l.mapCode || !ITEM.has(l.mapCode)) {
      if (b !== 0) {
        unmapped += b;
        unmappedCount++;
      }
      continue;
    }
    t[l.mapCode] += b;
    if (NATURE_CODES.has(l.mapCode)) {
      if (l.nature === 'staff') staff += b;
      if (l.nature === 'depreciation') depreciation += b;
    }
  }

  const v: Record<string, Kobo> = {};
  for (const i of CHART) v[i.code] = DEBIT_SECTIONS.includes(i.section) ? t[i.code] : -t[i.code];
  const sum = (s: Section) =>
    CHART.filter((i) => i.section === s).reduce((acc, i) => acc + v[i.code], 0);

  const grossProfit = v.revenue - v.cost_of_sales;
  const operatingProfit =
    grossProfit + v.other_income - v.distribution_costs - v.admin_expenses - v.other_expenses;
  const pbt = operatingProfit + v.finance_income - v.finance_costs;
  const profit = pbt - v.income_tax_expense;
  const closingRetained = v.retained_earnings + profit - v.dividends;
  const totalNca = sum('nca');
  const totalCa = sum('ca');
  const totalEquity = v.share_capital + v.share_premium + v.other_reserves + closingRetained;
  const totalNcl = sum('ncl');
  const totalCl = sum('cl');

  return {
    v,
    staff,
    depreciation,
    grossProfit,
    operatingProfit,
    pbt,
    profit,
    totalNca,
    totalCa,
    totalAssets: totalNca + totalCa,
    closingRetained,
    totalEquity,
    totalNcl,
    totalCl,
    totalLiabilities: totalNcl + totalCl,
    totalEquityAndLiabilities: totalEquity + totalNcl + totalCl,
    unmapped,
    unmappedCount,
    tbDifference,
  };
}

export const hasPrior = (lines: TbLine[]) => lines.some((l) => l.prior !== null);

export interface Statements {
  hasPrior: boolean;
  cur: Figures;
  prior: Figures | null;
  notes: Map<string, number>;
  position: Row[];
  income: Row[];
  equity: EquityTable;
  cashFlow: Row[] | null;
  /** Closing cash less opening cash less the net movement. Nil when the cash flow reconciles. */
  cashFlowDifference: Kobo | null;
  valueAdded: Row[];
  summary: Row[];
  noteBreakdowns: NoteBreakdown[];
}

export interface EquityTable {
  columns: string[];
  rows: { label: string; values: Kobo[]; style: 'line' | 'total' }[];
}

export interface NoteBreakdown {
  number: number;
  code: string;
  title: string;
  rows: { name: string; cur: Kobo; prior: Kobo | null }[];
  cur: Kobo;
  prior: Kobo | null;
}

export function buildStatements(lines: TbLine[], adjustments: Adjustment[]): Statements {
  const cur = figures(lines, adjustments, 'current');
  const withPrior = hasPrior(lines);
  const prior = withPrior ? figures(lines, adjustments, 'prior') : null;
  const p = (f: (x: Figures) => Kobo): Kobo | null => (prior ? f(prior) : null);

  // Notes are numbered from 3: note 1 is general information, note 2 the accounting policies.
  const notes = new Map<string, number>();
  let n = 3;
  for (const i of CHART) {
    if (cur.v[i.code] !== 0 || (prior && prior.v[i.code] !== 0)) notes.set(i.code, n++);
  }

  const item = (code: string, negate = false): Row => ({
    label: ITEM.get(code)!.label,
    cur: negate ? -cur.v[code] : cur.v[code],
    prior: prior ? (negate ? -prior.v[code] : prior.v[code]) : null,
    style: 'line',
    note: notes.get(code),
  });
  const shown = (r: Row) => r.cur !== 0 || (r.prior !== null && r.prior !== 0);
  const section = (s: Section) =>
    CHART.filter((i) => i.section === s)
      .map((i) => item(i.code))
      .filter(shown);
  const head = (label: string): Row => ({ label, cur: null, prior: null, style: 'heading' });
  const tot = (label: string, f: (x: Figures) => Kobo, style: Row['style'] = 'subtotal'): Row => ({
    label,
    cur: f(cur),
    prior: p(f),
    style,
  });

  const retained: Row = {
    label: 'Retained earnings',
    cur: cur.closingRetained,
    prior: p((x) => x.closingRetained),
    style: 'line',
    note: notes.get('retained_earnings'),
  };

  const position: Row[] = [
    head('Assets'),
    head('Non-current assets'),
    ...section('nca'),
    tot('Total non-current assets', (x) => x.totalNca),
    head('Current assets'),
    ...section('ca'),
    tot('Total current assets', (x) => x.totalCa),
    tot('Total assets', (x) => x.totalAssets, 'total'),
    head('Equity and liabilities'),
    head('Equity'),
    ...['share_capital', 'share_premium', 'other_reserves'].map((c) => item(c)).filter(shown),
    retained,
    tot('Total equity', (x) => x.totalEquity),
    head('Non-current liabilities'),
    ...section('ncl'),
    tot('Total non-current liabilities', (x) => x.totalNcl),
    head('Current liabilities'),
    ...section('cl'),
    tot('Total current liabilities', (x) => x.totalCl),
    tot('Total liabilities', (x) => x.totalLiabilities),
    tot('Total equity and liabilities', (x) => x.totalEquityAndLiabilities, 'total'),
  ];

  const income: Row[] = [
    item('revenue'),
    item('cost_of_sales', true),
    tot('Gross profit', (x) => x.grossProfit),
    ...[item('other_income')].filter(shown),
    ...['distribution_costs', 'admin_expenses', 'other_expenses'].map((c) => item(c, true)).filter(shown),
    tot('Operating profit', (x) => x.operatingProfit),
    ...[item('finance_income')].filter(shown),
    ...[item('finance_costs', true)].filter(shown),
    tot('Profit before tax', (x) => x.pbt),
    item('income_tax_expense', true),
    tot('Profit for the year', (x) => x.profit, 'total'),
  ];

  // Statement of changes in equity. Without a prior year, share capital and reserves are assumed unchanged in the year.
  const open = prior
    ? [prior.v.share_capital, prior.v.share_premium, prior.v.other_reserves, prior.closingRetained]
    : [cur.v.share_capital, cur.v.share_premium, cur.v.other_reserves, cur.v.retained_earnings];
  const close = [cur.v.share_capital, cur.v.share_premium, cur.v.other_reserves, cur.closingRetained];
  const withTotal = (vals: Kobo[]) => [...vals, vals.reduce((a, b) => a + b, 0)];
  const issued = [close[0] - open[0], close[1] - open[1], 0, 0];
  const reserveMove = [0, 0, close[2] - open[2], 0];
  // Any gap between this year's opening retained earnings and last year's closing figure.
  const openingGap = [0, 0, 0, cur.v.retained_earnings - open[3]];
  const equityRows: EquityTable['rows'] = [
    { label: 'At start of year', values: withTotal(open), style: 'line' },
    { label: 'Profit for the year', values: withTotal([0, 0, 0, cur.profit]), style: 'line' },
    { label: 'Dividends', values: withTotal([0, 0, 0, -cur.v.dividends]), style: 'line' },
  ];
  if (issued.some((x) => x !== 0))
    equityRows.push({ label: 'Issue of shares', values: withTotal(issued), style: 'line' });
  if (reserveMove.some((x) => x !== 0))
    equityRows.push({ label: 'Movement in other reserves', values: withTotal(reserveMove), style: 'line' });
  if (openingGap[3] !== 0)
    equityRows.push({
      label: 'Unreconciled opening balance difference',
      values: withTotal(openingGap),
      style: 'line',
    });
  equityRows.push({ label: 'At end of year', values: withTotal(close), style: 'total' });
  const equity: EquityTable = {
    columns: ['Share capital', 'Share premium', 'Other reserves', 'Retained earnings', 'Total'],
    rows: equityRows,
  };

  // Cash flow, indirect method. Needs the prior year to measure movements.
  let cashFlow: Row[] | null = null;
  let cashFlowDifference: Kobo | null = null;
  if (prior) {
    const d = (code: string) => cur.v[code] - prior.v[code];
    const line = (label: string, amount: Kobo): Row => ({ label, cur: amount, prior: null, style: 'line' });
    const sub = (label: string, amount: Kobo, style: Row['style'] = 'subtotal'): Row => ({
      label,
      cur: amount,
      prior: null,
      style,
    });
    const operating = [
      line('Profit before tax', cur.pbt),
      line('Depreciation and amortisation', cur.depreciation),
      line('Finance costs', cur.v.finance_costs),
      line('Finance income', -cur.v.finance_income),
      line('Change in inventories', -d('inventories')),
      line('Change in trade receivables', -d('trade_receivables')),
      line('Change in other receivables and prepayments', -d('other_receivables')),
      line('Change in trade payables', d('trade_payables')),
      line('Change in other payables and accruals', d('other_payables')),
      line('Change in provisions', d('provisions')),
    ];
    const generated = operating.reduce((a, r) => a + (r.cur ?? 0), 0);
    const taxPaid = -(
      cur.v.income_tax_expense -
      d('current_tax_payable') -
      d('deferred_tax_liability') +
      d('deferred_tax_asset')
    );
    const netOperating = generated + taxPaid;
    const investing = [
      line(
        'Purchase of property, plant, equipment and intangibles, net of disposals',
        -(d('ppe') + d('intangibles') + cur.depreciation),
      ),
      line('Change in investments', -d('investments')),
      line('Finance income received', cur.v.finance_income),
    ];
    const netInvesting = investing.reduce((a, r) => a + (r.cur ?? 0), 0);
    const financing = [
      line('Proceeds from issue of shares', d('share_capital') + d('share_premium')),
      line('Net movement in borrowings', d('borrowings_nc') + d('borrowings_c')),
      line('Finance costs paid', -cur.v.finance_costs),
      line('Dividends paid', -cur.v.dividends),
      line('Movement in other reserves', d('other_reserves')),
    ];
    const netFinancing = financing.reduce((a, r) => a + (r.cur ?? 0), 0);
    const net = netOperating + netInvesting + netFinancing;
    cashFlowDifference = cur.v.cash - prior.v.cash - net;
    const nonZero = (r: Row) => r.cur !== 0;
    cashFlow = [
      head('Cash flows from operating activities'),
      ...operating.filter((r, i) => i === 0 || nonZero(r)),
      sub('Cash generated from operations', generated),
      line('Income tax paid', taxPaid),
      sub('Net cash from operating activities', netOperating),
      head('Cash flows from investing activities'),
      ...investing.filter(nonZero),
      sub('Net cash used in investing activities', netInvesting),
      head('Cash flows from financing activities'),
      ...financing.filter(nonZero),
      sub('Net cash from financing activities', netFinancing),
      sub('Net change in cash and cash equivalents', net),
      line('Cash and cash equivalents at start of year', prior.v.cash),
      sub('Cash and cash equivalents at end of year', cur.v.cash, 'total'),
    ];
    if (cashFlowDifference !== 0) {
      cashFlow.push({
        label: 'Unreconciled difference: opening balances do not agree to the prior year',
        cur: cashFlowDifference,
        prior: null,
        style: 'check',
      });
    }
  }

  // Statement of value added, as directed by the FRC of Nigeria.
  const va = (f: Figures) => {
    const gross = f.v.revenue + f.v.other_income + f.v.finance_income;
    const operatingCosts =
      f.v.cost_of_sales + f.v.distribution_costs + f.v.admin_expenses + f.v.other_expenses;
    const boughtIn = operatingCosts - f.staff - f.depreciation;
    return {
      gross,
      boughtIn,
      added: gross - boughtIn,
      staff: f.staff,
      tax: f.v.income_tax_expense,
      finance: f.v.finance_costs,
      dividends: f.v.dividends,
      depreciation: f.depreciation,
      retainedProfit: f.profit - f.v.dividends,
    };
  };
  const vc = va(cur);
  const vp = prior ? va(prior) : null;
  const vrow = (label: string, k: keyof ReturnType<typeof va>, style: Row['style'] = 'line', neg = false): Row => ({
    label,
    cur: neg ? -vc[k] : vc[k],
    prior: vp ? (neg ? -vp[k] : vp[k]) : null,
    style,
  });
  const valueAdded: Row[] = [
    vrow('Revenue and other income', 'gross'),
    vrow('Bought-in materials and services', 'boughtIn', 'line', true),
    vrow('Value added', 'added', 'total'),
    head('Applied as follows'),
    vrow('To employees: salaries, wages and benefits', 'staff'),
    vrow('To government: income tax', 'tax'),
    vrow('To providers of finance: finance costs', 'finance'),
    vrow('To shareholders: dividends', 'dividends'),
    vrow('Retained for replacement of assets: depreciation and amortisation', 'depreciation'),
    vrow('Retained for growth: profit retained', 'retainedProfit'),
    vrow('Value added', 'added', 'total'),
  ];

  const summary: Row[] = [
    head('Results'),
    tot('Revenue', (x) => x.v.revenue, 'line'),
    tot('Profit before tax', (x) => x.pbt, 'line'),
    tot('Income tax expense', (x) => -x.v.income_tax_expense, 'line'),
    tot('Profit for the year', (x) => x.profit, 'line'),
    head('Financial position'),
    tot('Non-current assets', (x) => x.totalNca, 'line'),
    tot('Current assets', (x) => x.totalCa, 'line'),
    tot('Total liabilities', (x) => -x.totalLiabilities, 'line'),
    tot('Net assets', (x) => x.totalAssets - x.totalLiabilities, 'total'),
    head('Funded by'),
    tot('Share capital and premium', (x) => x.v.share_capital + x.v.share_premium, 'line'),
    tot('Reserves', (x) => x.v.other_reserves + x.closingRetained, 'line'),
    tot('Total equity', (x) => x.totalEquity, 'total'),
  ];

  const curBal = adjustedBalances(lines, adjustments, 'current');
  const noteBreakdowns: NoteBreakdown[] = [];
  for (const [code, number] of notes) {
    const it = ITEM.get(code)!;
    const sign = DEBIT_SECTIONS.includes(it.section) ? 1 : -1;
    const rows = lines
      .filter((l) => l.mapCode === code)
      .map((l) => ({
        name: l.name,
        cur: sign * (curBal.get(l.id) ?? 0),
        prior: withPrior ? sign * (l.prior ?? 0) : null,
      }))
      .filter((r) => r.cur !== 0 || (r.prior !== null && r.prior !== 0));
    noteBreakdowns.push({
      number,
      code,
      title: code === 'retained_earnings' ? 'Retained earnings at start of year' : it.label,
      rows,
      cur: cur.v[code],
      prior: prior ? prior.v[code] : null,
    });
  }

  return {
    hasPrior: withPrior,
    cur,
    prior,
    notes,
    position,
    income,
    equity,
    cashFlow,
    cashFlowDifference,
    valueAdded,
    summary,
    noteBreakdowns,
  };
}
