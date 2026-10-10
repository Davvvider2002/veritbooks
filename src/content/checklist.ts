/**
 * Disclosure checklist for financial statements prepared under the IFRS for SMEs Accounting Standard.
 *
 * STATUS: starter content, version 0.1. Each item is a plain-language summary of a disclosure
 * area, grouped by the section of the Standard it comes from. It is not the text of the Standard
 * and it is not complete. It must be reviewed against the edition of the Standard in force for
 * the period, and against FRC Nigeria and CAMA 2020 requirements, by a qualified technical
 * author before live use. Section numbers follow the second edition (2015).
 */
export const CHECKLIST_VERSION = '0.1-starter';

/** A fact the software can see for itself, so the preparer is not asked. */
export type AutoKey =
  | 'complete_set'
  | 'comparatives'
  | 'identification'
  | 'compliance_statement'
  | 'general_information'
  | 'going_concern'
  | 'equity_statement'
  | 'cash_components'
  | 'ppe_reconciliation'
  | 'tax_reconciliation'
  | 'related_parties'
  | 'key_management'
  | 'subsequent_events'
  | 'contingencies'
  | 'commitments'
  | 'line_breakdown'
  | 'policies_tailored';

export interface ChecklistItem {
  id: string;
  section: string;
  text: string;
  /** Statement lines that make the item relevant. It applies when any of them has a balance in either year. Omit for items that always apply. */
  when?: string[];
  auto?: AutoKey;
}

const S = {
  s3: 'Section 3: Financial statement presentation',
  s4: 'Section 4: Statement of financial position',
  s5: 'Section 5: Statement of comprehensive income',
  s6: 'Section 6: Statement of changes in equity',
  s7: 'Section 7: Statement of cash flows',
  s8: 'Section 8: Notes',
  s10: 'Section 10: Accounting policies, estimates and errors',
  s11: 'Section 11: Basic financial instruments',
  s13: 'Section 13: Inventories',
  s17: 'Section 17: Property, plant and equipment',
  s18: 'Section 18: Intangible assets',
  s20: 'Section 20: Leases',
  s21: 'Section 21: Provisions and contingencies',
  s23: 'Section 23: Revenue',
  s25: 'Section 25: Borrowing costs',
  s27: 'Section 27: Impairment of assets',
  s28: 'Section 28: Employee benefits',
  s29: 'Section 29: Income tax',
  s32: 'Section 32: Events after the end of the reporting period',
  s33: 'Section 33: Related party disclosures',
};

export const CHECKLIST: ChecklistItem[] = [
  { id: 's3-set', section: S.s3, text: 'A complete set of financial statements is presented: financial position, comprehensive income, changes in equity, cash flows and notes.', auto: 'complete_set' },
  { id: 's3-compliance', section: S.s3, text: 'The notes state, explicitly and without reservation, that the financial statements comply with the IFRS for SMEs.', auto: 'compliance_statement' },
  { id: 's3-going-concern', section: S.s3, text: 'Management’s going concern assessment is reflected, and any material uncertainty is disclosed.', auto: 'going_concern' },
  { id: 's3-comparatives', section: S.s3, text: 'Comparative information is given for all amounts, and for narrative where it is relevant.', auto: 'comparatives' },
  { id: 's3-identification', section: S.s3, text: 'Each statement names the entity, the period or date, the presentation currency and the level of rounding.', auto: 'identification' },
  { id: 's3-general', section: S.s3, text: 'The notes give the entity’s domicile, legal form, registered office address and the nature of its operations and principal activities.', auto: 'general_information' },
  { id: 's3-consistency', section: S.s3, text: 'Presentation and classification are the same as last year, or the change and its reason are disclosed and comparatives reclassified.' },

  { id: 's4-current', section: S.s4, text: 'Current and non-current assets and liabilities are shown as separate classifications.', auto: 'identification' },
  { id: 's4-subclasses', section: S.s4, text: 'The line items are broken down further, on the face or in the notes, in a way that suits the entity’s operations.', auto: 'line_breakdown' },
  { id: 's4-share-capital', section: S.s4, text: 'For each class of share capital: shares authorised, issued and fully paid, par value, a reconciliation of shares outstanding, and the rights and restrictions attached.', when: ['share_capital', 'share_premium'] },
  { id: 's4-reserves', section: S.s4, text: 'Each reserve within equity is described.', when: ['other_reserves'] },

  { id: 's5-expenses', section: S.s5, text: 'Expenses are analysed by nature or by function, whichever is reliable and more relevant.', auto: 'identification' },
  { id: 's5-material-items', section: S.s5, text: 'The nature and amount of material items of income and expense are disclosed separately.' },

  { id: 's6-statement', section: S.s6, text: 'Changes in equity show, for each component, a reconciliation of opening to closing amounts, with profit, dividends and transactions with owners shown separately.', auto: 'equity_statement' },
  { id: 's6-dividends', section: S.s6, text: 'Dividends declared and paid in the period are disclosed, with the amount for each share where relevant.', when: ['dividends'] },

  { id: 's7-components', section: S.s7, text: 'The components of cash and cash equivalents are given and reconciled to the statement of financial position.', auto: 'cash_components' },
  { id: 's7-restricted', section: S.s7, text: 'Significant cash balances that are not available for use by the entity are disclosed, with an explanation.', when: ['cash'] },
  { id: 's7-non-cash', section: S.s7, text: 'Investing and financing transactions that did not use cash are excluded from the statement and disclosed elsewhere.' },

  { id: 's8-policies', section: S.s8, text: 'The significant accounting policies are disclosed and have been tailored to this entity: the measurement bases and the other policies needed to understand the statements.', auto: 'policies_tailored' },
  { id: 's8-judgements', section: S.s8, text: 'The judgements management made in applying the accounting policies that most affect the amounts recognised are disclosed.' },
  { id: 's8-estimates', section: S.s8, text: 'The key assumptions about the future and other main sources of estimation uncertainty are disclosed, with the assets and liabilities affected.' },

  { id: 's10-changes', section: S.s10, text: 'Any change in accounting policy, change in estimate or correction of a prior period error is disclosed, with its nature and effect.' },

  { id: 's11-policies', section: S.s11, text: 'The measurement bases used for financial instruments are disclosed, and the carrying amounts are given by category.', when: ['trade_receivables', 'other_receivables', 'investments', 'trade_payables', 'other_payables', 'borrowings_nc', 'borrowings_c'] },
  { id: 's11-borrowings', section: S.s11, text: 'For borrowings: the terms and conditions, interest rate, maturity, repayment schedule and any restrictions.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 's11-security', section: S.s11, text: 'The carrying amount of assets pledged as security, and the terms of the pledge, are disclosed.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 's11-defaults', section: S.s11, text: 'Any default or breach on loans payable during the period that was not remedied by the reporting date is disclosed.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 's11-impairment', section: S.s11, text: 'Impairment losses on receivables, and the income, expense, gains and losses on financial instruments, are disclosed.', when: ['trade_receivables', 'other_receivables', 'investments'] },

  { id: 's13-policy', section: S.s13, text: 'The policy for measuring inventories, including the cost formula, is disclosed, with the carrying amount by classification.', when: ['inventories'] },
  { id: 's13-expense', section: S.s13, text: 'The amount of inventories recognised as an expense, any write-downs or reversals, and inventories pledged as security are disclosed.', when: ['inventories'] },

  { id: 's17-bases', section: S.s17, text: 'For each class: the measurement basis, the depreciation method and the useful lives or rates.', when: ['ppe'] },
  { id: 's17-reconciliation', section: S.s17, text: 'For each class: cost and accumulated depreciation at the start and end of the period, with additions, disposals and depreciation reconciled.', when: ['ppe'], auto: 'ppe_reconciliation' },
  { id: 's17-pledged', section: S.s17, text: 'Property pledged as security, restrictions on title, and contractual commitments to acquire property, plant and equipment are disclosed.', when: ['ppe'] },

  { id: 's18-intangibles', section: S.s18, text: 'For each class: useful lives or amortisation rates, the method, a reconciliation of the carrying amount, and where amortisation is charged.', when: ['intangibles'] },

  { id: 's20-leases', section: S.s20, text: 'Lease payments recognised as an expense, and the total of future minimum lease payments by period, are disclosed, with a general description of significant leasing arrangements.' },

  { id: 's21-provisions', section: S.s21, text: 'For each class of provision: a reconciliation of the movement, the nature of the obligation, and the expected timing and uncertainties.', when: ['provisions'] },
  { id: 's21-contingent', section: S.s21, text: 'Contingent liabilities are described, with an estimate of their financial effect, unless the possibility of an outflow is remote.', auto: 'contingencies' },
  { id: 's21-commitments', section: S.s21, text: 'Capital commitments at the reporting date are disclosed.', auto: 'commitments' },

  { id: 's23-revenue', section: S.s23, text: 'The policy for recognising revenue is disclosed, with the amount of each category of revenue: goods, services, interest, and any others.', when: ['revenue', 'other_income', 'finance_income'] },

  { id: 's25-borrowing-costs', section: S.s25, text: 'Finance costs for the period are disclosed, covering total interest expense on liabilities not at fair value through profit or loss.', when: ['finance_costs'] },

  { id: 's27-impairment', section: S.s27, text: 'Impairment losses and reversals recognised in the period are disclosed by class of asset, with the line item in which they are included.' },

  { id: 's28-benefits', section: S.s28, text: 'The amount recognised as an expense for defined contribution plans, including the statutory pension scheme, is disclosed, with any other long-term or termination benefits.' },

  { id: 's29-components', section: S.s29, text: 'The major components of the tax expense are disclosed separately: current tax, adjustments for prior periods, and deferred tax.', when: ['income_tax_expense', 'current_tax_payable', 'deferred_tax_asset', 'deferred_tax_liability'] },
  { id: 's29-reconciliation', section: S.s29, text: 'The difference between the tax expense and accounting profit multiplied by the applicable tax rate is explained.', when: ['income_tax_expense'], auto: 'tax_reconciliation' },
  { id: 's29-deferred', section: S.s29, text: 'For each type of temporary difference and unused tax loss: the deferred tax balance and its movement, and any amounts not recognised.', when: ['deferred_tax_asset', 'deferred_tax_liability'] },

  { id: 's32-authorisation', section: S.s32, text: 'The date the financial statements were authorised for issue, and who gave the authorisation, are disclosed.' },
  { id: 's32-events', section: S.s32, text: 'Each material non-adjusting event after the reporting date is described, with an estimate of its financial effect.', auto: 'subsequent_events' },

  { id: 's33-control', section: S.s33, text: 'Any parent and ultimate controlling party is named, whether or not there were transactions with them.' },
  { id: 's33-key-management', section: S.s33, text: 'Key management personnel compensation is disclosed in total.', auto: 'key_management' },
  { id: 's33-transactions', section: S.s33, text: 'For related party transactions: the relationship, the amounts, outstanding balances with their terms, and any provision for doubtful amounts.', auto: 'related_parties' },
];
