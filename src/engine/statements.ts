import { CHART, ITEM, NATURE_CODES, type Section } from './chart';
import type { Adjustment, Kobo, Nature, TbLine } from './types';

export type Period = 'current' | 'prior';

/** Where a figure comes from: either accounts on one chart line, or other figures that add up to it. */
export interface Source {
  /** The chart line whose accounts make up the figure. */
  code?: string;
  /** The year whose accounts to show, when it is not the year of the column. Opening balances are last year's. */
  period?: Period;
  /** Only the accounts of this nature, such as depreciation charged within several expense lines. */
  nature?: Nature;
  /** Only this account. */
  lineId?: string;
  /** For retained earnings: the accounts brought forward alone, without the year's profit and dividends. */
  accountsOnly?: boolean;
  /** The figures that add up to this one. They always do, in both columns. */
  parts?: Part[];
}

export interface Part extends Source {
  label: string;
  /** What this part adds to the figure, so it carries the sign it has in the sum. */
  cur: Kobo;
  prior: Kobo | null;
}

export interface Row extends Source {
  label: string;
  cur: Kobo | null;
  prior: Kobo | null;
  style: 'heading' | 'line' | 'subtotal' | 'total' | 'check';
  note?: number;
  /** True when the row shows the figure with its sign reversed, as expenses are on the income statement. */
  negated?: boolean;
}

/** The same parts with every amount reversed. */
export const negateParts = (parts: Part[]): Part[] =>
  parts.map((x) => ({ ...x, cur: -x.cur, prior: x.prior === null ? null : -x.prior, parts: x.parts && negateParts(x.parts) }));

/** The prior year column of some parts, moved into the first column, for a table that presents the prior year alone. */
export const priorColumn = (parts: Part[]): Part[] =>
  parts.map((x) => ({ ...x, cur: x.prior ?? 0, prior: null, period: 'prior' as const, parts: x.parts && priorColumn(x.parts) }));

const live = (x: Part) => x.cur !== 0 || (x.prior !== null && x.prior !== 0);
/** One part standing for several, which open when it is selected. */
export function groupParts(label: string, parts: Part[]): Part {
  const kept = parts.filter(live);
  return {
    label,
    cur: kept.reduce((a, x) => a + x.cur, 0),
    prior: kept.some((x) => x.prior !== null) ? kept.reduce((a, x) => a + (x.prior ?? 0), 0) : null,
    parts: kept,
  };
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
  /** What profit before tax and profit for the year are made of, for tables built outside this file. */
  pbtParts: Part[];
  profitParts: Part[];
  valueAdded: Row[];
  noteBreakdowns: NoteBreakdown[];
}

export interface EquityTable {
  columns: string[];
  rows: { label: string; values: Kobo[]; style: 'line' | 'total'; /** What each value is made of, in the order of the columns. */ sources?: (Part[] | undefined)[] }[];
}

export interface NoteBreakdown {
  number: number;
  code: string;
  title: string;
  rows: { lineId: string; name: string; cur: Kobo; prior: Kobo | null }[];
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
    code,
    negated: negate || undefined,
  });
  const shown = (r: Row) => r.cur !== 0 || (r.prior !== null && r.prior !== 0);
  const label = (code: string) => ITEM.get(code)!.label;
  /** A chart line as part of a sum, added (factor 1) or deducted (factor -1). */
  const leaf = (code: string, factor = 1): Part => ({
    label: label(code),
    cur: factor * cur.v[code],
    prior: prior ? factor * prior.v[code] : null,
    code,
  });
  const of = (s: Section) => CHART.filter((i) => i.section === s).map((i) => leaf(i.code));
  const total = (parts: Part[]) => groupParts('', parts).parts!;
  /** Accounts of one nature, by the expense line they are charged in. */
  const byNature = (nature: Nature): Part[] => {
    const sumFor = (period: Period, code: string) => {
      const bal = adjustedBalances(lines, adjustments, period);
      return lines.reduce((a, l) => (l.mapCode === code && l.nature === nature ? a + (bal.get(l.id) ?? 0) : a), 0);
    };
    return total(
      [...NATURE_CODES].map((code) => ({
        label: `${nature === 'staff' ? 'Staff costs' : 'Depreciation and amortisation'} in ${label(code).toLowerCase()}`,
        cur: sumFor('current', code),
        prior: prior ? sumFor('prior', code) : null,
        code,
        nature,
      })),
    );
  };
  const depParts = byNature('depreciation');
  const staffParts = byNature('staff');
  const retainedPart: Part = { label: 'Retained earnings', cur: cur.closingRetained, prior: prior ? prior.closingRetained : null, code: 'retained_earnings' };
  const ncaParts = total(of('nca'));
  const caParts = total(of('ca'));
  const equityParts = total([leaf('share_capital'), leaf('share_premium'), leaf('other_reserves'), retainedPart]);
  const nclParts = total(of('ncl'));
  const clParts = total(of('cl'));
  const gpParts = total([leaf('revenue'), leaf('cost_of_sales', -1)]);
  const opParts = total([
    groupParts('Gross profit', gpParts),
    leaf('other_income'),
    leaf('distribution_costs', -1),
    leaf('admin_expenses', -1),
    leaf('other_expenses', -1),
  ]);
  const pbtParts = total([groupParts('Operating profit', opParts), leaf('finance_income'), leaf('finance_costs', -1)]);
  const profitParts = total([groupParts('Profit before tax', pbtParts), leaf('income_tax_expense', -1)]);
  const section = (s: Section) =>
    CHART.filter((i) => i.section === s)
      .map((i) => item(i.code))
      .filter(shown);
  const head = (label: string): Row => ({ label, cur: null, prior: null, style: 'heading' });
  const tot = (label: string, f: (x: Figures) => Kobo, parts: Part[], style: Row['style'] = 'subtotal'): Row => ({
    label,
    cur: f(cur),
    prior: p(f),
    style,
    parts,
  });

  const retained: Row = {
    label: 'Retained earnings',
    cur: cur.closingRetained,
    prior: p((x) => x.closingRetained),
    style: 'line',
    note: notes.get('retained_earnings'),
    code: 'retained_earnings',
  };

  const position: Row[] = [
    head('Assets'),
    head('Non-current assets'),
    ...section('nca'),
    tot('Total non-current assets', (x) => x.totalNca, ncaParts),
    head('Current assets'),
    ...section('ca'),
    tot('Total current assets', (x) => x.totalCa, caParts),
    tot('Total assets', (x) => x.totalAssets, [groupParts('Non-current assets', ncaParts), groupParts('Current assets', caParts)], 'total'),
    head('Equity and liabilities'),
    head('Equity'),
    ...['share_capital', 'share_premium', 'other_reserves'].map((c) => item(c)).filter(shown),
    retained,
    tot('Total equity', (x) => x.totalEquity, equityParts),
    head('Non-current liabilities'),
    ...section('ncl'),
    tot('Total non-current liabilities', (x) => x.totalNcl, nclParts),
    head('Current liabilities'),
    ...section('cl'),
    tot('Total current liabilities', (x) => x.totalCl, clParts),
    tot('Total liabilities', (x) => x.totalLiabilities, [groupParts('Non-current liabilities', nclParts), groupParts('Current liabilities', clParts)]),
    tot(
      'Total equity and liabilities',
      (x) => x.totalEquityAndLiabilities,
      [groupParts('Equity', equityParts), groupParts('Non-current liabilities', nclParts), groupParts('Current liabilities', clParts)],
      'total',
    ),
  ];

  const income: Row[] = [
    item('revenue'),
    item('cost_of_sales', true),
    tot('Gross profit', (x) => x.grossProfit, gpParts),
    ...[item('other_income')].filter(shown),
    ...['distribution_costs', 'admin_expenses', 'other_expenses'].map((c) => item(c, true)).filter(shown),
    tot('Operating profit', (x) => x.operatingProfit, opParts),
    ...[item('finance_income')].filter(shown),
    ...[item('finance_costs', true)].filter(shown),
    tot('Profit before tax', (x) => x.pbt, pbtParts),
    item('income_tax_expense', true),
    tot('Profit for the year', (x) => x.profit, profitParts, 'total'),
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
  // The statement has one year in its columns, so every part carries its amount in the first column
  // and names the year whose accounts it comes from.
  const bal = (code: string, period: Period, factor = 1, text?: string): Part => ({
    label: text ?? label(code),
    cur: factor * (period === 'current' ? cur : prior!).v[code],
    prior: null,
    code,
    period,
    accountsOnly: code === 'retained_earnings' || undefined,
  });
  /** The movement in a balance over the year, times the factor: closing less opening. */
  const change = (code: string, factor = 1): Part[] => [
    bal(code, 'current', factor, `${label(code)} at end of year`),
    bal(code, 'prior', -factor, `${label(code)} at start of year`),
  ];
  const curOnly = (parts: Part[]): Part[] => parts.map((x) => ({ ...x, prior: null, parts: x.parts && curOnly(x.parts) }));
  const equityCodes = ['share_capital', 'share_premium', 'other_reserves'];
  const columns = ['Share capital', 'Share premium', 'Other reserves', 'Retained earnings', 'Total'];
  const eqRow = (text: string, values: Kobo[], cells: Part[][], style: 'line' | 'total' = 'line'): EquityTable['rows'][number] => {
    const sources = cells.map((c) => c.filter(live));
    return {
      label: text,
      values: withTotal(values),
      style,
      sources: [...sources, sources.flatMap((c, i) => (values[i] !== 0 ? [{ ...groupParts(columns[i], c), prior: null }] : []))],
    };
  };
  const openingRetained: Part = prior
    ? { label: 'Retained earnings at end of last year', cur: prior.closingRetained, prior: null, code: 'retained_earnings', period: 'prior' }
    : bal('retained_earnings', 'current', 1, 'Retained earnings brought forward');
  const equityRows: EquityTable['rows'] = [
    eqRow('At start of year', open, [...equityCodes.map((c) => [bal(c, prior ? 'prior' : 'current')]), [openingRetained]]),
    eqRow('Profit for the year', [0, 0, 0, cur.profit], [[], [], [], curOnly(profitParts)]),
    eqRow('Dividends', [0, 0, 0, -cur.v.dividends], [[], [], [], [bal('dividends', 'current', -1)]]),
  ];
  if (issued.some((x) => x !== 0))
    equityRows.push(eqRow('Issue of shares', issued, [prior ? change('share_capital') : [], prior ? change('share_premium') : [], [], []]));
  if (reserveMove.some((x) => x !== 0))
    equityRows.push(eqRow('Movement in other reserves', reserveMove, [[], [], prior ? change('other_reserves') : [], []]));
  if (openingGap[3] !== 0)
    equityRows.push(
      eqRow('Unreconciled opening balance difference', openingGap, [
        [],
        [],
        [],
        [bal('retained_earnings', 'current', 1, 'Retained earnings brought forward in this year’s trial balance'), ...negateParts([openingRetained])],
      ]),
    );
  equityRows.push(
    eqRow('At end of year', close, [...equityCodes.map((c) => [bal(c, 'current')]), [{ ...retainedPart, prior: null }]], 'total'),
  );
  const equity: EquityTable = { columns, rows: equityRows };

  // Cash flow, indirect method. Needs the prior year to measure movements.
  let cashFlow: Row[] | null = null;
  let cashFlowDifference: Kobo | null = null;
  if (prior) {
    const d = (code: string) => cur.v[code] - prior.v[code];
    const line = (label: string, amount: Kobo, parts: Part[]): Row => ({ label, cur: amount, prior: null, style: 'line', parts: curOnly(parts).filter(live) });
    const sub = (label: string, amount: Kobo, parts: Part[], style: Row['style'] = 'subtotal'): Row => ({
      label,
      cur: amount,
      prior: null,
      style,
      parts: parts.filter(live),
    });
    const asPart = (r: Row): Part => ({ label: r.label, cur: r.cur ?? 0, prior: null, parts: r.parts });
    const depreciation = groupParts('Depreciation and amortisation', curOnly(depParts));
    const operating = [
      line('Profit before tax', cur.pbt, pbtParts),
      line('Depreciation and amortisation', cur.depreciation, depParts),
      line('Finance costs', cur.v.finance_costs, [leaf('finance_costs')]),
      line('Finance income', -cur.v.finance_income, [leaf('finance_income', -1)]),
      line('Change in inventories', -d('inventories'), change('inventories', -1)),
      line('Change in trade receivables', -d('trade_receivables'), change('trade_receivables', -1)),
      line('Change in other receivables and prepayments', -d('other_receivables'), change('other_receivables', -1)),
      line('Change in trade payables', d('trade_payables'), change('trade_payables')),
      line('Change in other payables and accruals', d('other_payables'), change('other_payables')),
      line('Change in provisions', d('provisions'), change('provisions')),
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
        [...change('ppe', -1), ...change('intangibles', -1), ...negateParts([depreciation])],
      ),
      line('Change in investments', -d('investments'), change('investments', -1)),
      line('Finance income received', cur.v.finance_income, [leaf('finance_income')]),
    ];
    const netInvesting = investing.reduce((a, r) => a + (r.cur ?? 0), 0);
    const financing = [
      line('Proceeds from issue of shares', d('share_capital') + d('share_premium'), [...change('share_capital'), ...change('share_premium')]),
      line('Net movement in borrowings', d('borrowings_nc') + d('borrowings_c'), [...change('borrowings_nc'), ...change('borrowings_c')]),
      line('Finance costs paid', -cur.v.finance_costs, [leaf('finance_costs', -1)]),
      line('Dividends paid', -cur.v.dividends, [leaf('dividends', -1)]),
      line('Movement in other reserves', d('other_reserves'), change('other_reserves')),
    ];
    const netFinancing = financing.reduce((a, r) => a + (r.cur ?? 0), 0);
    const net = netOperating + netInvesting + netFinancing;
    cashFlowDifference = cur.v.cash - prior.v.cash - net;
    const nonZero = (r: Row) => r.cur !== 0;
    const generatedRow = sub('Cash generated from operations', generated, operating.map(asPart));
    const taxRow = line('Income tax paid', taxPaid, [
      leaf('income_tax_expense', -1),
      ...change('current_tax_payable'),
      ...change('deferred_tax_liability'),
      ...change('deferred_tax_asset', -1),
    ]);
    const operatingRow = sub('Net cash from operating activities', netOperating, [generatedRow, taxRow].map(asPart));
    const investingRow = sub('Net cash used in investing activities', netInvesting, investing.map(asPart));
    const financingRow = sub('Net cash from financing activities', netFinancing, financing.map(asPart));
    cashFlow = [
      head('Cash flows from operating activities'),
      ...operating.filter((r, i) => i === 0 || nonZero(r)),
      generatedRow,
      taxRow,
      operatingRow,
      head('Cash flows from investing activities'),
      ...investing.filter(nonZero),
      investingRow,
      head('Cash flows from financing activities'),
      ...financing.filter(nonZero),
      financingRow,
      sub('Net change in cash and cash equivalents', net, [operatingRow, investingRow, financingRow].map(asPart)),
      line('Cash and cash equivalents at start of year', prior.v.cash, [bal('cash', 'prior')]),
      sub('Cash and cash equivalents at end of year', cur.v.cash, [bal('cash', 'current')], 'total'),
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
  const vrow = (label: string, k: keyof ReturnType<typeof va>, parts: Part[], style: Row['style'] = 'line', neg = false): Row => ({
    label,
    cur: neg ? -vc[k] : vc[k],
    prior: vp ? (neg ? -vp[k] : vp[k]) : null,
    style,
    parts: parts.filter(live),
  });
  const grossParts = [leaf('revenue'), leaf('other_income'), leaf('finance_income')];
  const boughtParts = [
    leaf('cost_of_sales', -1),
    leaf('distribution_costs', -1),
    leaf('admin_expenses', -1),
    leaf('other_expenses', -1),
    groupParts('Less staff costs, shown below', staffParts),
    groupParts('Less depreciation and amortisation, shown below', depParts),
  ];
  const addedParts = [groupParts('Revenue and other income', grossParts), groupParts('Bought-in materials and services', boughtParts)];
  const valueAdded: Row[] = [
    vrow('Revenue and other income', 'gross', grossParts),
    vrow('Bought-in materials and services', 'boughtIn', boughtParts, 'line', true),
    vrow('Value added', 'added', addedParts, 'total'),
    head('Applied as follows'),
    vrow('To employees: salaries, wages and benefits', 'staff', staffParts),
    vrow('To government: income tax', 'tax', [leaf('income_tax_expense')]),
    vrow('To providers of finance: finance costs', 'finance', [leaf('finance_costs')]),
    vrow('To shareholders: dividends', 'dividends', [leaf('dividends')]),
    vrow('Retained for replacement of assets: depreciation and amortisation', 'depreciation', depParts),
    vrow('Retained for growth: profit retained', 'retainedProfit', [groupParts('Profit for the year', profitParts), leaf('dividends', -1)]),
    vrow('Value added', 'added', addedParts, 'total'),
  ];

  const curBal = adjustedBalances(lines, adjustments, 'current');
  const noteBreakdowns: NoteBreakdown[] = [];
  for (const [code, number] of notes) {
    const it = ITEM.get(code)!;
    const sign = DEBIT_SECTIONS.includes(it.section) ? 1 : -1;
    const rows = lines
      .filter((l) => l.mapCode === code)
      .map((l) => ({
        lineId: l.id,
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
    pbtParts,
    profitParts,
    valueAdded,
    noteBreakdowns,
  };
}
