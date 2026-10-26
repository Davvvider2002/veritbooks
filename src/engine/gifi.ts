import { adjustedBalances, type Statements } from './statements';
import type { Adjustment, TbLine } from './types';

/**
 * GIFI, the CRA's General Index of Financial Information. Every corporation files its balance
 * sheet (Schedule 100) and income statement (Schedule 125) with the T2 return as GIFI codes.
 * VeritBooks gives each account a code, works out the totals the CRA requires, checks them
 * against the statements, and exports the result for the firm's tax software to import.
 *
 * Codes and descriptions are from the CRA's GIFI guide (RC4088) and the GIFI-Short form (T1178).
 * https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4088/general-index-financial-information-gifi.html
 *
 * Signs: assets as debits are positive, so accumulated amortization and allowances are negative,
 * as tax software expects; liabilities, equity and revenue are positive; expenses are positive.
 */
export interface GifiCode {
  code: string;
  description: string;
}

/** The codes offered in the picker: the GIFI-Short list, with the detail codes most accounts need. */
export const GIFI_CODES: GifiCode[] = [
  ['1000', 'Cash and deposits'], ['1001', 'Cash'], ['1002', 'Deposits in Canadian banks and institutions – Canadian currency'], ['1003', 'Deposits in Canadian banks and institutions – Foreign currency'],
  ['1060', 'Accounts receivable'], ['1061', 'Allowance for doubtful accounts'], ['1062', 'Trade accounts receivable'], ['1066', 'Taxes receivable'], ['1067', 'Interest receivable'], ['1073', 'Amounts receivable from members of NPOs'],
  ['1120', 'Inventories'], ['1121', 'Inventory of goods for sale'], ['1125', 'Work in progress'], ['1126', 'Raw materials'],
  ['1180', 'Short-term investments'], ['1240', 'Loans and notes receivable'], ['1300', 'Due from shareholder(s)/director(s)'], ['1400', 'Due from/investment in related parties'],
  ['1480', 'Other current assets'], ['1481', 'Future (deferred) income taxes'], ['1483', 'Taxes recoverable/refundable'], ['1484', 'Prepaid expenses'], ['1486', 'Security/tender deposits'],
  ['1600', 'Land'], ['1601', 'Land improvements'], ['1602', 'Accumulated amortization of land improvements'],
  ['1680', 'Buildings'], ['1681', 'Accumulated amortization of buildings'],
  ['1740', 'Machinery, equipment, furniture, and fixtures'], ['1741', 'Accumulated amortization of machinery, equipment, furniture, and fixtures'],
  ['1742', 'Motor vehicles'], ['1743', 'Accumulated amortization of motor vehicles'],
  ['1787', 'Furniture and fixtures'], ['1788', 'Accumulated amortization of furniture and fixtures'],
  ['1900', 'Other tangible capital assets'], ['1901', 'Accumulated amortization of other tangible capital assets'],
  ['2010', 'Intangible assets'], ['2011', 'Accumulated amortization of intangible assets'], ['2012', 'Goodwill'], ['2013', 'Accumulated amortization of goodwill'],
  ['2180', 'Due from shareholder(s)/director(s)'], ['2200', 'Investment in joint venture(s)/partnership(s)'], ['2240', 'Due from/investment in related parties'],
  ['2300', 'Long-term investments'], ['2360', 'Long-term loans'], ['2420', 'Other long-term assets'],
  ['2600', 'Bank overdraft'], ['2620', 'Amounts payable and accrued liabilities'], ['2630', 'Amounts payable to members of NPOs'], ['2680', 'Taxes payable'],
  ['2700', 'Short-term debt'], ['2707', 'Credit card loans'], ['2780', 'Due to shareholder(s)/director(s)'], ['2860', 'Due to related parties'],
  ['2920', 'Current portion of long term liability'], ['2960', 'Other current liabilities'],
  ['3140', 'Long-term debt'], ['3220', 'Deferred income'], ['3240', 'Future (deferred) income taxes'], ['3260', 'Due to shareholder(s)/director(s)'], ['3300', 'Due to related parties'], ['3320', 'Other long-term liabilities'],
  ['3500', 'Common shares'], ['3520', 'Preferred shares'], ['3540', 'Contributed and other surplus'], ['3660', 'Retained earnings (deficit) – start'], ['3700', 'Dividends declared'], ['3740', 'Other items affecting retained earnings'],
  ['8000', 'Trade sales of goods and services'], ['8090', 'Investment revenue'], ['8095', 'Dividend income'], ['8120', 'Commission revenue'], ['8140', 'Rental revenue'],
  ['8210', 'Realized gains/losses on disposal of assets'], ['8220', 'NPO amounts received'], ['8221', 'Membership fees'], ['8223', 'Gifts'], ['8224', 'Gross sales and revenues from organizational activities'],
  ['8230', 'Other revenue'], ['8242', 'Subsidies and grants'],
  ['8300', 'Opening inventory'], ['8320', 'Purchases/cost of materials'], ['8340', 'Direct wages'], ['8350', 'Benefits on direct wages'], ['8360', 'Trades and sub-contracts'], ['8450', 'Other direct costs'], ['8500', 'Closing inventory'],
  ['8520', 'Advertising and promotion'], ['8570', 'Amortization of intangible assets'], ['8590', 'Bad debt expense'], ['8620', 'Employee benefits'], ['8670', 'Amortization of tangible assets'],
  ['8710', 'Interest and bank charges'], ['8760', 'Business taxes, licences, and memberships'], ['8810', 'Office expenses'], ['8860', 'Professional fees'], ['8910', 'Rental'],
  ['8960', 'Repairs and maintenance'], ['9060', 'Salaries and wages'], ['9110', 'Sub-contracts'], ['9150', 'Computer-related expenses'], ['9180', 'Property taxes'], ['9270', 'Other expenses'],
  ['9990', 'Current income taxes'], ['9995', 'Future (deferred) income tax provision'],
].map(([code, description]) => ({ code, description }));

const DESCRIPTION = new Map(GIFI_CODES.map((c) => [c.code, c.description]));
export const gifiDescription = (code: string) => DESCRIPTION.get(code) ?? TOTALS.find((t) => t.code === code)?.description ?? '';

/** Totals the CRA requires, and how each is made up. */
const TOTALS: GifiCode[] = [
  ['1599', 'Total current assets'], ['2008', 'Total tangible capital assets'], ['2009', 'Total accumulated amortization of tangible capital assets'],
  ['2178', 'Total intangible capital assets'], ['2179', 'Total accumulated amortization of intangible capital assets'], ['2589', 'Total long-term assets'], ['2599', 'Total assets'],
  ['3139', 'Total current liabilities'], ['3450', 'Total long-term liabilities'], ['3499', 'Total liabilities'], ['3600', 'Retained earnings (deficit)'], ['3620', 'Total shareholder equity'],
  ['3640', 'Total liabilities and shareholder equity'], ['3680', 'Net income/loss'], ['3849', 'Retained earnings (deficit) – end'],
  ['8299', 'Total revenue'], ['8518', 'Total cost of sales'], ['8519', 'Gross profit/loss'], ['9367', 'Total operating expenses'], ['9368', 'Total expenses'],
  ['9369', 'Net non-farming income'], ['9970', 'Net income/loss before taxes and extraordinary items'], ['9999', 'Net income/loss after taxes and extraordinary items'],
].map(([code, description]) => ({ code, description }));

const has = (name: string, ...words: string[]) => words.some((w) => new RegExp(w, 'i').test(name));
const accumulated = (name: string) => has(name, 'accum', 'depreciation', 'amorti[sz]ation', 'a/d\\b', 'acc\\.? ?dep');

/** A suggested GIFI code for an account, from its statement line and its name. Null when the line gives no lead. */
export function suggestGifi(l: Pick<TbLine, 'name' | 'mapCode'>): string | null {
  const n = l.name;
  switch (l.mapCode) {
    case 'cash':
      return has(n, 'overdraft') ? '2600' : has(n, 'petty', 'float', 'on hand') ? '1001' : '1002';
    case 'trade_receivables':
      return has(n, 'allowance', 'doubtful', 'provision') ? '1061' : '1062';
    case 'other_receivables':
      return has(n, 'prepaid', 'prepayment') ? '1484' : has(n, 'shareholder', 'director') ? '1300' : has(n, 'deposit') ? '1486' : has(n, 'gst', 'hst', 'tax') ? '1066' : '1480';
    case 'inventories':
      return has(n, 'work in progress', 'wip') ? '1125' : has(n, 'raw') ? '1126' : '1121';
    case 'ppe': {
      const acc = accumulated(n);
      if (has(n, 'land') && !has(n, 'improvement')) return '1600';
      if (has(n, 'building', 'premises', 'leasehold')) return acc ? '1681' : '1680';
      if (has(n, 'vehicle', 'truck', 'car\\b', 'automobile')) return acc ? '1743' : '1742';
      if (has(n, 'furniture', 'fixture', 'fitting')) return acc ? '1788' : '1787';
      if (has(n, 'machine', 'equipment', 'computer', 'plant', 'tool')) return acc ? '1741' : '1740';
      return acc ? '1901' : '1900';
    }
    case 'intangibles':
      return has(n, 'goodwill') ? (accumulated(n) ? '2013' : '2012') : accumulated(n) ? '2011' : '2010';
    case 'investments':
      return has(n, 'related', 'subsidiar', 'affiliate', 'associate') ? '2240' : '2300';
    case 'deferred_tax_asset':
      return '1481';
    case 'trade_payables':
      return '2620';
    case 'other_payables':
      return has(n, 'shareholder', 'director') ? '2780' : has(n, 'gst', 'hst', 'sales tax', 'payroll', 'source deduction', 'remittance') ? '2680' : has(n, 'deferred', 'unearned') ? '2960' : '2620';
    case 'borrowings_c':
      return has(n, 'overdraft') ? '2600' : has(n, 'credit card') ? '2707' : has(n, 'current portion') ? '2920' : '2700';
    case 'current_tax_payable':
      return '2680';
    case 'borrowings_nc':
      return has(n, 'shareholder', 'director') ? '3260' : has(n, 'related') ? '3300' : '3140';
    case 'deferred_tax_liability':
      return '3240';
    case 'provisions':
      return '3320';
    case 'share_capital':
      return has(n, 'preferred') ? '3520' : '3500';
    case 'share_premium':
    case 'other_reserves':
    case 'restricted_funds':
    case 'endowment_funds':
      return '3540';
    case 'retained_earnings':
      return '3660';
    case 'dividends':
      return '3700';
    case 'revenue':
      return has(n, 'rent') ? '8140' : has(n, 'commission') ? '8120' : has(n, 'membership') ? '8221' : '8000';
    case 'other_income':
      return has(n, 'gain', 'disposal') ? '8210' : has(n, 'rent') ? '8140' : '8230';
    case 'grant_income':
      return '8242';
    case 'donations':
      return '8223';
    case 'finance_income':
      return has(n, 'dividend') ? '8095' : '8090';
    case 'cost_of_sales':
      return has(n, 'opening') ? '8300' : has(n, 'closing') ? '8500' : has(n, 'wage', 'salar', 'labour', 'labor') ? '8340' : has(n, 'subcontract', 'sub-contract') ? '8360' : '8320';
    case 'income_tax_expense':
      return has(n, 'deferred', 'future') ? '9995' : '9990';
    case 'finance_costs':
      return '8710';
    case 'distribution_costs':
    case 'admin_expenses':
    case 'other_expenses':
    case 'programme_expenses':
    case 'fundraising_costs':
      if (has(n, 'advertis', 'marketing', 'promotion')) return '8520';
      if (has(n, 'amorti[sz]ation of intangible', 'goodwill')) return '8570';
      if (has(n, 'depreciation', 'amorti[sz]ation')) return '8670';
      if (has(n, 'bad debt', 'doubtful')) return '8590';
      if (has(n, 'benefit', 'pension', 'cpp', '\\bei\\b', 'wsib', 'health')) return '8620';
      if (has(n, 'interest', 'bank charge', 'bank fee')) return '8710';
      if (has(n, 'licen[cs]e', 'membership', 'dues', 'business tax')) return '8760';
      if (has(n, 'property tax')) return '9180';
      if (has(n, 'office', 'stationery', 'postage', 'printing')) return '8810';
      if (has(n, 'professional', 'legal', 'accounting', 'audit', 'consult')) return '8860';
      if (has(n, 'rent', 'lease')) return '8910';
      if (has(n, 'repair', 'maintenance')) return '8960';
      if (has(n, 'salar', 'wage', 'payroll', 'staff cost')) return '9060';
      if (has(n, 'subcontract', 'sub-contract')) return '9110';
      if (has(n, 'computer', 'software', 'it support', 'internet', 'hosting')) return '9150';
      return '9270';
    default:
      return null;
  }
}

/** Which side of the T2 a code is on, and the sign its amount is shown with. */
function signOf(code: string): 1 | -1 {
  const c = Number(code);
  if (c < 2600) return 1; // assets: debits positive, contra-assets negative
  if (c < 3700 || (c > 3700 && c < 8000)) return -1; // liabilities and equity: credits positive
  if (c === 3700) return 1; // dividends: a debit, deducted
  if (c < 8300) return -1; // revenue: credits positive
  return 1; // cost of sales, expenses and taxes: debits positive
}

export interface GifiRow {
  code: string;
  description: string;
  cur: number;
  prior: number | null;
  total: boolean;
  /** The accounts behind a coded line. */
  accounts?: { lineId: string; name: string; cur: number }[];
}

export interface GifiResult {
  rows: GifiRow[];
  /** Accounts with a balance in either year and no code. */
  uncoded: TbLine[];
  /** Totals that do not agree with the statements: the code, the GIFI figure and the statements' figure. */
  disagreements: { code: string; label: string; gifi: number; statements: number }[];
}

const inRange = (code: string, lo: number, hi: number) => Number(code) >= lo && Number(code) <= hi;

/** The GIFI schedules for an engagement: coded lines, the required totals, and checks against the statements. */
export function gifiSchedules(lines: TbLine[], adjustments: Adjustment[], st: Statements): GifiResult {
  const curBal = adjustedBalances(lines, adjustments, 'current');
  const priorBal = st.hasPrior ? adjustedBalances(lines, adjustments, 'prior') : null;
  const by = new Map<string, GifiRow>();
  const uncoded: TbLine[] = [];
  for (const l of lines) {
    const c = curBal.get(l.id) ?? 0;
    const p = priorBal ? (priorBal.get(l.id) ?? 0) : 0;
    if (!l.gifi) {
      if (c !== 0 || p !== 0) uncoded.push(l);
      continue;
    }
    const s = signOf(l.gifi);
    const row = by.get(l.gifi) ?? { code: l.gifi, description: gifiDescription(l.gifi), cur: 0, prior: priorBal ? 0 : null, total: false, accounts: [] };
    row.cur += s * c;
    if (row.prior !== null) row.prior += s * p;
    row.accounts!.push({ lineId: l.id, name: `${l.code} ${l.name}`, cur: s * c });
    by.set(l.gifi, row);
  }
  const coded = [...by.values()].filter((r) => r.cur !== 0 || (r.prior ?? 0) !== 0);
  const sum = (pred: (code: string) => boolean, k: 'cur' | 'prior') => coded.filter((r) => pred(r.code)).reduce((a, r) => a + (r[k] ?? 0), 0);
  const isAcc = (code: string) => gifiDescription(code).startsWith('Accumulated amortization');
  const total = (code: string, f: (k: 'cur' | 'prior') => number): GifiRow => ({ code, description: gifiDescription(code), cur: f('cur'), prior: priorBal ? f('prior') : null, total: true });

  const t: Record<string, GifiRow> = {};
  t['1599'] = total('1599', (k) => sum((c) => inRange(c, 1000, 1598), k));
  t['2008'] = total('2008', (k) => sum((c) => inRange(c, 1600, 2007) && !isAcc(c), k));
  t['2009'] = total('2009', (k) => sum((c) => inRange(c, 1600, 2007) && isAcc(c), k));
  t['2178'] = total('2178', (k) => sum((c) => inRange(c, 2010, 2177) && !isAcc(c), k));
  t['2179'] = total('2179', (k) => sum((c) => inRange(c, 2010, 2177) && isAcc(c), k));
  t['2589'] = total('2589', (k) => sum((c) => inRange(c, 1600, 2588), k));
  t['2599'] = total('2599', (k) => t['1599'][k]! + t['2589'][k]!);
  t['3139'] = total('3139', (k) => sum((c) => inRange(c, 2600, 3138), k));
  t['3450'] = total('3450', (k) => sum((c) => inRange(c, 3140, 3449), k));
  t['3499'] = total('3499', (k) => t['3139'][k]! + t['3450'][k]!);
  // Revenue, costs and income.
  t['8299'] = total('8299', (k) => sum((c) => inRange(c, 8000, 8298), k));
  t['8518'] = total('8518', (k) => sum((c) => inRange(c, 8300, 8499), k) - sum((c) => c === '8500', k));
  t['8519'] = total('8519', (k) => sum((c) => inRange(c, 8000, 8088), k) - t['8518'][k]!);
  t['9367'] = total('9367', (k) => sum((c) => inRange(c, 8520, 9366), k));
  t['9368'] = total('9368', (k) => t['8518'][k]! + t['9367'][k]!);
  t['9369'] = total('9369', (k) => t['8299'][k]! - t['9368'][k]!);
  t['9970'] = total('9970', (k) => t['9369'][k]!);
  t['9999'] = total('9999', (k) => t['9970'][k]! - sum((c) => c === '9990' || c === '9995', k));
  // Retained earnings: opening, plus net income, less dividends, plus other items.
  t['3680'] = total('3680', (k) => t['9999'][k]!);
  t['3849'] = total('3849', (k) => sum((c) => c === '3660' || c === '3740', k) + t['3680'][k]! - sum((c) => c === '3700', k));
  t['3600'] = total('3600', (k) => t['3849'][k]!);
  t['3620'] = total('3620', (k) => sum((c) => inRange(c, 3500, 3599), k) + t['3600'][k]!);
  t['3640'] = total('3640', (k) => t['3499'][k]! + t['3620'][k]!);

  // Lay the schedules out in code order, each total after the lines it adds up.
  const after: [string, number][] = [
    ['1599', 1598], ['2008', 2007.1], ['2009', 2007.2], ['2178', 2177.1], ['2179', 2177.2], ['2589', 2588], ['2599', 2598],
    ['3139', 3138], ['3450', 3449], ['3499', 3449.5], ['3600', 3599], ['3620', 3619], ['3640', 3639],
    ['3680', 3679], ['3849', 3848], ['8299', 8298], ['8518', 8517], ['8519', 8518.5], ['9367', 9366], ['9368', 9367.5], ['9369', 9368.5], ['9970', 9969], ['9999', 9998],
  ];
  const keyed: [number, GifiRow][] = [
    ...coded.map((r): [number, GifiRow] => [Number(r.code), r]),
    ...after.map(([code, at]): [number, GifiRow] => [at + 0.001, t[code]]),
  ];
  const rows = keyed.sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  const disagreements: GifiResult['disagreements'] = [];
  const agree = (code: string, label: string, value: number) => {
    if (t[code].cur !== value) disagreements.push({ code, label, gifi: t[code].cur, statements: value });
  };
  agree('2599', 'Total assets', st.cur.totalAssets);
  agree('3499', 'Total liabilities', st.cur.totalLiabilities);
  agree('3640', 'Total liabilities and shareholder equity', st.cur.totalEquityAndLiabilities);
  agree('9999', 'Net income', st.cur.profit);
  return { rows, uncoded, disagreements };
}

/** The schedules as a CSV for the firm's tax software: code, description, this year, last year. */
export function gifiCsv(result: GifiResult, year: string, priorYear: string | null): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const amt = (minor: number | null) => (minor === null ? '' : (minor / 100).toFixed(2));
  const head = ['GIFI code', 'Description', year, ...(priorYear ? [priorYear] : [])];
  const body = result.rows.map((r) => [r.code, q(r.description), amt(r.cur), ...(priorYear ? [amt(r.prior)] : [])].join(','));
  return [head.join(','), ...body].join('\n') + '\n';
}
