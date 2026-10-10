/**
 * Accounting policy wording for the notes, by statement line.
 * STATUS: starter wording, version 0.1. Short generic policies that the preparer must tailor
 * to the entity. To be reviewed by a qualified technical author before live use.
 */
export const POLICY_VERSION = '0.1-starter';

export const POLICIES: Record<string, { title: string; text: string }> = {
  revenue: {
    title: 'Revenue',
    text: 'Revenue is measured at the fair value of the consideration received or receivable, net of value added tax, discounts and returns. Revenue from the sale of goods is recognised when the significant risks and rewards of ownership pass to the buyer. Revenue from services is recognised by reference to the stage of completion.',
  },
  ppe: {
    title: 'Property, plant and equipment',
    text: 'Property, plant and equipment is stated at cost less accumulated depreciation and accumulated impairment losses. Depreciation is charged on a straight-line basis over the estimated useful lives of the assets. Land is not depreciated.',
  },
  intangibles: {
    title: 'Intangible assets',
    text: 'Intangible assets are stated at cost less accumulated amortisation and accumulated impairment losses, and are amortised on a straight-line basis over their estimated useful lives.',
  },
  inventories: {
    title: 'Inventories',
    text: 'Inventories are stated at the lower of cost and estimated selling price less costs to complete and sell.',
  },
  trade_receivables: {
    title: 'Trade and other receivables',
    text: 'Receivables are recognised at the transaction price. At each reporting date their carrying amounts are reviewed for objective evidence of impairment, and any impairment loss is recognised in profit or loss.',
  },
  cash: {
    title: 'Cash and cash equivalents',
    text: 'Cash and cash equivalents comprise cash in hand and demand deposits with banks.',
  },
  trade_payables: {
    title: 'Trade and other payables',
    text: 'Payables are obligations on normal credit terms and are recognised at the transaction price.',
  },
  borrowings_nc: {
    title: 'Borrowings',
    text: 'Borrowings are recognised initially at the transaction price and subsequently at amortised cost using the effective interest method. Interest expense is recognised in profit or loss as finance costs.',
  },
  income_tax_expense: {
    title: 'Income tax',
    text: 'Income tax expense comprises current and deferred tax. Current tax is the expected tax payable on the taxable profit for the year under the tax laws enacted at the reporting date. Deferred tax is recognised on temporary differences between the carrying amounts of assets and liabilities and their tax bases.',
  },
  provisions: {
    title: 'Provisions',
    text: 'A provision is recognised when the company has a present obligation as a result of a past event, it is probable that an outflow of economic benefits will be required to settle it, and the amount can be estimated reliably.',
  },
};
