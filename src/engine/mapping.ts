import { NATURE_CODES } from './chart';
import type { Nature } from './types';

type Rule = [RegExp, string, Nature?];

/**
 * Keyword rules, most specific first. These only suggest a mapping.
 * The auditor confirms every line, and confirmed mappings are remembered per client.
 */
const RULES: Rule[] = [
  [/accum\w*\.? (depr|amort)|provision for depr/, 'ppe'],
  [/depreciation|amorti[sz]ation/, 'admin_expenses', 'depreciation'],
  [/overdraft/, 'borrowings_c'],
  [/interest (income|receiv|earned)|investment income/, 'finance_income'],
  [/interest (expense|paid|payable|on)|finance (cost|charge)|loan interest/, 'finance_costs'],
  [/(allowance|provision) for (doubtful|bad|impairment)/, 'trade_receivables'],
  [/bad debt/, 'admin_expenses', 'other'],
  [/prepa(y|id)|staff (loan|advance)|other (receivable|debtor)|deposit paid|(wht|withholding).*(receiv|credit|asset)|input vat|vat receiv/, 'other_receivables'],
  [/accru|output vat|vat pay|\bvat\b|paye|pension (pay|contribution pay)|\bnhf\b|nsitf|\bitf\b|(wht|withholding)|other (payable|creditor)|customer deposit|deferred income|director'?s?'? (current|loan)/, 'other_payables'],
  [/deferred tax(ation)? asset/, 'deferred_tax_asset'],
  [/deferred tax/, 'deferred_tax_liability'],
  [/tax(ation)? (payable|liabilit)|(income|company|education|tertiary).*tax pay/, 'current_tax_payable'],
  [/(income|company|companies|education|tertiary).*tax|tax(ation)? (expense|charge)|^taxation$/, 'income_tax_expense'],
  [/share premium/, 'share_premium'],
  [/share capital|ordinary share|paid.?up capital|issued capital/, 'share_capital'],
  [/retained|accumulated (profit|loss|surplus|deficit)|revenue reserve|general reserve|profit and loss account/, 'retained_earnings'],
  [/reserve/, 'other_reserves'],
  // Dividends the company receives are income. Only those it pays are distributions.
  [/dividends? (income|received)|income from (subsidiar|associate|investment)/, 'other_income'],
  [/dividends? receivable/, 'other_receivables'],
  [/dividend/, 'dividends'],
  [/cost of (sales|goods)|purchases|carriage in|freight in|direct (cost|labou?r|material|expense)|(opening|closing) (stock|inventor)/, 'cost_of_sales', 'other'],
  [/sales|revenue|turnover|fees (earned|income)|service income|contract income/, 'revenue'],
  [/other income|sundry income|gain on|profit on disposal|discount received|exchange gain|rental income/, 'other_income'],
  [/salar|wages|staff|pension|payroll|bonus|director'?s?'? (remuneration|fee|emolument)|medical|training|welfare/, 'admin_expenses', 'staff'],
  [/advert|marketing|selling|distribution|delivery|carriage out|freight out|commission|promotion/, 'distribution_costs', 'other'],
  [/\brent\b|\brates\b|electric|diesel|\bfuel|\bpower\b|telephone|internet|printing|stationer|insurance|repair|maintenance|\baudit|legal|professional|consult|travel|transport|bank charge|subscription|donation|security (expense|cost|service)|cleaning|office (expense|suppl|running|cost)|general exp|sundry exp|miscellaneous|entertainment|utilit|licen[cs]e fee|\bhire\b|exchange loss|loss on/, 'admin_expenses', 'other'],
  [/trade (debtor|receivable)|accounts? receivable|debtors|receivables/, 'trade_receivables'],
  [/trade (creditor|payable)|accounts? payable|creditors|payables/, 'trade_payables'],
  [/inventor|stock\b|work in progress|raw material|finished goods/, 'inventories'],
  [/cash|bank|petty|\bimprest\b/, 'cash'],
  [/goodwill|intangible|software/, 'intangibles'],
  [/investment/, 'investments'],
  [/land|building|plant|machine|vehicle|furniture|fitting|fixture|equipment|computer|capital work|leasehold/, 'ppe'],
  [/short.?term (loan|borrowing)|current portion/, 'borrowings_c'],
  [/loan|borrowing|debenture|lease liabilit|mortgage/, 'borrowings_nc'],
  [/provision/, 'provisions'],
  [/expense|cost/, 'admin_expenses', 'other'],
];

export interface Suggestion {
  mapCode: string | null;
  nature: Nature | null;
}

export function suggestMapping(name: string): Suggestion {
  const n = name.toLowerCase();
  for (const [re, code, nature] of RULES) {
    if (re.test(n)) {
      return { mapCode: code, nature: NATURE_CODES.has(code) ? (nature ?? 'other') : null };
    }
  }
  return { mapCode: null, nature: null };
}

/** Keep the nature tag consistent with the line item it sits on. */
export function normaliseNature(mapCode: string | null, nature: Nature | null): Nature | null {
  if (!mapCode || !NATURE_CODES.has(mapCode)) return null;
  return nature ?? 'other';
}
