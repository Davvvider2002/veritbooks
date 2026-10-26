/**
 * Accounting policy wording for Canadian statements: ASPE (CPA Canada Handbook, Part II) and,
 * for not-for-profits, ASNPO (Part III). Canadian spelling, Handbook section references.
 * STATUS: starter wording, version 0.1. A Canadian CPA must review it against the Handbook in
 * force and tailor it to the entity before live use.
 */
import type { ContributionMethod } from '../engine/frameworks';

export const ASPE_POLICY_VERSION = '0.1-starter';

export function aspePolicies(opts: { taxMethod?: 'taxes-payable' | 'future'; npo: boolean; method?: ContributionMethod }): Record<string, { title: string; text: string }> {
  const Entity = opts.npo ? 'The Organization' : 'The Company';
  return {
    revenue: opts.npo
      ? {
          title: 'Revenue recognition',
          text:
            opts.method === 'restricted-fund'
              ? `${Entity} follows the restricted fund method of accounting for contributions. Restricted contributions related to the purpose of a restricted fund are recognized as revenue of that fund in the year received or receivable. Unrestricted contributions are recognized as revenue of the general fund in the year received or receivable if the amount can be reasonably estimated and collection is reasonably assured. Revenue from services and goods is recognized when the service is provided or the goods are delivered.`
              : `${Entity} follows the deferral method of accounting for contributions. Restricted contributions are recognized as revenue in the year in which the related expenses are incurred. Unrestricted contributions are recognized as revenue when received or receivable if the amount can be reasonably estimated and collection is reasonably assured. Endowment contributions are recognized as direct increases in net assets. Revenue from services and goods is recognized when the service is provided or the goods are delivered.`,
        }
      : {
          title: 'Revenue recognition',
          text: `${Entity} recognizes revenue when persuasive evidence of an arrangement exists, the goods have been delivered or the services rendered, the price is fixed or determinable, and collection is reasonably assured (Section 3400). Revenue is recorded net of sales taxes, discounts and returns.`,
        },
    ppe: {
      title: opts.npo ? 'Capital assets' : 'Property and equipment',
      text: `${opts.npo ? 'Capital assets are' : 'Property and equipment are'} recorded at cost less accumulated amortization. Amortization is provided on the straight-line basis over the estimated useful lives of the assets. An asset is tested for impairment when events or changes in circumstances indicate that its carrying amount may not be recoverable, and is written down when its carrying amount exceeds its fair value${opts.npo ? ' or replacement cost' : ''} (Section ${opts.npo ? '4433' : '3063'}).`,
    },
    intangibles: {
      title: 'Intangible assets',
      text: 'Intangible assets with finite useful lives are recorded at cost less accumulated amortization, and are amortized on the straight-line basis over their estimated useful lives (Section 3064).',
    },
    inventories: {
      title: 'Inventory',
      text: 'Inventory is measured at the lower of cost and net realizable value. Cost is determined on the [first-in, first-out / weighted average cost] basis (Section 3031).',
    },
    trade_receivables: {
      title: 'Financial instruments',
      text: `${Entity} initially measures its financial assets and financial liabilities at fair value, adjusted for transaction costs where they are subsequently measured at amortized cost. It subsequently measures its financial assets and financial liabilities at amortized cost, except for investments in equity instruments quoted in an active market, which are measured at fair value. Financial assets measured at amortized cost are tested for impairment when there are indicators of impairment (Section 3856).`,
    },
    cash: {
      title: 'Cash and cash equivalents',
      text: 'Cash and cash equivalents consist of cash on hand and balances with banks, and short-term investments with maturities of three months or less from the date of acquisition.',
    },
    trade_payables: {
      title: 'Accounts payable and accrued liabilities',
      text: 'Accounts payable and accrued liabilities are financial liabilities measured at amortized cost.',
    },
    borrowings_nc: {
      title: 'Long-term debt',
      text: 'Long-term debt is a financial liability measured at amortized cost. Interest is recognized in income as it accrues.',
    },
    income_tax_expense: opts.npo
      ? { title: 'Income taxes', text: `${Entity} is a not-for-profit organization under the Income Tax Act and is exempt from income taxes.` }
      : opts.taxMethod === 'future'
        ? {
            title: 'Income taxes',
            text: `${Entity} uses the future income taxes method (Section 3465). Future income tax assets and liabilities are recognized for temporary differences between the carrying amounts of assets and liabilities and their tax bases, measured at the substantively enacted rates expected to apply when the differences reverse.`,
          }
        : {
            title: 'Income taxes',
            text: `${Entity} uses the taxes payable method (Section 3465). Under this method, only the cost of current income taxes for the year, determined in accordance with the Income Tax Act and provincial income tax legislation, is recognized as an expense.`,
          },
    provisions: {
      title: 'Contingencies and provisions',
      text: `A liability is recognized when it is likely that a future event will confirm that an asset has been impaired or a liability incurred at the date of the financial statements, and the amount can be reasonably estimated (Section 3290). ${Entity} reviews its estimates at each year end.`,
    },
  };
}

/** Note 2's opening paragraph: the framework, and the policies every Canadian set carries. */
export function aspeBasis(opts: { npo: boolean; currency: string }): string[] {
  return [
    opts.npo
      ? `These financial statements have been prepared in accordance with Canadian accounting standards for not-for-profit organizations (ASNPO) in Part III of the CPA Canada Handbook – Accounting.`
      : `These financial statements have been prepared in accordance with Canadian accounting standards for private enterprises (ASPE) in Part II of the CPA Canada Handbook – Accounting.`,
    `They are presented in ${opts.currency}.`,
    'Use of estimates. The preparation of financial statements requires management to make estimates and assumptions that affect the reported amounts of assets and liabilities, the disclosure of contingent assets and liabilities at the date of the financial statements, and the reported amounts of revenue and expenses during the year. Actual results could differ from those estimates.',
  ];
}
