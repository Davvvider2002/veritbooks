/**
 * Standard classification chart for the IFRS for SMEs general trading and services template.
 * Client accounts are mapped to these line items; every statement is computed from the mapping.
 */
export type Section =
  | 'nca' // non-current assets
  | 'ca' // current assets
  | 'equity'
  | 'ncl' // non-current liabilities
  | 'cl' // current liabilities
  | 'income'
  | 'expense'
  | 'distribution'; // dividends

export interface LineItem {
  code: string;
  label: string;
  section: Section;
}

export const CHART: LineItem[] = [
  { code: 'ppe', label: 'Property, plant and equipment', section: 'nca' },
  { code: 'intangibles', label: 'Intangible assets', section: 'nca' },
  { code: 'investments', label: 'Investments', section: 'nca' },
  { code: 'deferred_tax_asset', label: 'Deferred tax asset', section: 'nca' },

  { code: 'inventories', label: 'Inventories', section: 'ca' },
  { code: 'trade_receivables', label: 'Trade receivables', section: 'ca' },
  { code: 'other_receivables', label: 'Other receivables and prepayments', section: 'ca' },
  { code: 'cash', label: 'Cash and cash equivalents', section: 'ca' },

  { code: 'share_capital', label: 'Share capital', section: 'equity' },
  { code: 'share_premium', label: 'Share premium', section: 'equity' },
  { code: 'other_reserves', label: 'Other reserves', section: 'equity' },
  { code: 'retained_earnings', label: 'Retained earnings', section: 'equity' },
  // Not-for-profit funds. Unrestricted funds are the retained surplus, on retained_earnings.
  { code: 'restricted_funds', label: 'Restricted funds', section: 'equity' },
  { code: 'endowment_funds', label: 'Endowment funds', section: 'equity' },

  { code: 'borrowings_nc', label: 'Borrowings', section: 'ncl' },
  { code: 'deferred_tax_liability', label: 'Deferred tax liability', section: 'ncl' },
  { code: 'provisions', label: 'Provisions', section: 'ncl' },

  { code: 'trade_payables', label: 'Trade payables', section: 'cl' },
  { code: 'other_payables', label: 'Other payables and accruals', section: 'cl' },
  { code: 'borrowings_c', label: 'Borrowings and bank overdrafts', section: 'cl' },
  { code: 'current_tax_payable', label: 'Current tax payable', section: 'cl' },

  { code: 'revenue', label: 'Revenue', section: 'income' },
  { code: 'other_income', label: 'Other income', section: 'income' },
  { code: 'grant_income', label: 'Grants', section: 'income' },
  { code: 'donations', label: 'Donations and gifts', section: 'income' },
  { code: 'finance_income', label: 'Finance income', section: 'income' },

  { code: 'cost_of_sales', label: 'Cost of sales', section: 'expense' },
  { code: 'distribution_costs', label: 'Selling and distribution costs', section: 'expense' },
  { code: 'admin_expenses', label: 'Administrative expenses', section: 'expense' },
  { code: 'other_expenses', label: 'Other operating expenses', section: 'expense' },
  { code: 'programme_expenses', label: 'Programme and charitable activities', section: 'expense' },
  { code: 'fundraising_costs', label: 'Fundraising costs', section: 'expense' },
  { code: 'finance_costs', label: 'Finance costs', section: 'expense' },
  { code: 'income_tax_expense', label: 'Income tax expense', section: 'expense' },

  { code: 'dividends', label: 'Dividends declared', section: 'distribution' },
];

export const ITEM = new Map(CHART.map((i) => [i.code, i]));

export const SECTION_LABEL: Record<Section, string> = {
  nca: 'Non-current assets',
  ca: 'Current assets',
  equity: 'Equity',
  ncl: 'Non-current liabilities',
  cl: 'Current liabilities',
  income: 'Income',
  expense: 'Expenses',
  distribution: 'Distributions',
};

/** Operating expense lines that carry a nature tag for the value added statement and cash flow. */
export const NATURE_CODES = new Set([
  'cost_of_sales',
  'distribution_costs',
  'admin_expenses',
  'other_expenses',
  'programme_expenses',
  'fundraising_costs',
]);

/** Lines used only by not-for-profit entities. Offered in mapping only for them. */
export const NPO_CODES = new Set(['grant_income', 'donations', 'programme_expenses', 'fundraising_costs', 'restricted_funds', 'endowment_funds']);

/** How a not-for-profit entity names some company lines. */
export const NPO_LABEL: Record<string, string> = {
  retained_earnings: 'Unrestricted funds',
  revenue: 'Income from activities and services',
  admin_expenses: 'Administration and governance',
  cost_of_sales: 'Cost of goods and services provided',
  other_expenses: 'Other expenditure',
};

export const isBalanceSheet = (s: Section) =>
  s === 'nca' || s === 'ca' || s === 'equity' || s === 'ncl' || s === 'cl';
