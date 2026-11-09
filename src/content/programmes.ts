import type { EngagementType } from '../engine/types';

/**
 * Work programmes, held as data so a standards change is a content release, not a code change.
 *
 * STATUS: starter content, version 0.1. These steps were drafted to exercise the software.
 * They are not a methodology. Before the product is used on a live engagement they must be
 * replaced or reviewed by a qualified technical author against the standards adopted by the
 * Financial Reporting Council of Nigeria (ISA, ISA for LCE, ISRE 2400, ISRS 4410).
 */
export const PROGRAMME_VERSION = '0.1-starter';

export interface ProgrammeItem {
  id: string;
  area: string;
  text: string;
  /**
   * Statement lines that call for the step. It applies when any of them has a balance in any year
   * of the trial balance. Omit for steps every engagement needs.
   */
  when?: string[];
}

const audit: ProgrammeItem[] = [
  { id: 'a-acc-1', area: 'Acceptance', text: 'Confirm independence and ethical requirements for the firm and the team.' },
  { id: 'a-acc-2', area: 'Acceptance', text: 'Agree the engagement letter with those charged with governance.' },
  { id: 'a-acc-3', area: 'Acceptance', text: 'Confirm the entity is not a public interest entity and that this methodology is appropriate for it.' },
  { id: 'a-pln-1', area: 'Planning', text: 'Document the understanding of the entity, its environment and its system of internal control.' },
  { id: 'a-pln-2', area: 'Planning', text: 'Set overall materiality, performance materiality and the clearly trivial threshold.' },
  { id: 'a-pln-3', area: 'Planning', text: 'Identify and assess risks of material misstatement, including fraud and management override.' },
  { id: 'a-pln-4', area: 'Planning', text: 'Agree opening balances to the prior year signed financial statements.' },
  { id: 'a-cash-1', area: 'Cash and bank', text: 'Obtain bank confirmations and agree them to the bank reconciliations.' },
  { id: 'a-cash-2', area: 'Cash and bank', text: 'Test reconciling items to after-date bank statements.' },
  { id: 'a-rec-1', area: 'Receivables', text: 'Test the receivables listing to the ledger and to after-date receipts or confirmations.', when: ['trade_receivables'] },
  { id: 'a-rec-2', area: 'Receivables', text: 'Assess the allowance for impairment of receivables.', when: ['trade_receivables'] },
  { id: 'a-orc-1', area: 'Other receivables and prepayments', text: 'Vouch other receivables and prepayments to supporting documents, assess recoverability, and recompute prepayments for the period they cover.', when: ['other_receivables'] },
  { id: 'a-inv-1', area: 'Inventories', text: 'Attend the inventory count, or perform alternative procedures, and test cost against net realisable value.', when: ['inventories'] },
  { id: 'a-ppe-1', area: 'Property, plant and equipment', text: 'Vouch additions and disposals, test ownership and recompute depreciation.', when: ['ppe'] },
  { id: 'a-int-1', area: 'Intangible assets', text: 'Vouch additions to supporting documents, confirm the entity controls each asset, and check that capitalised development costs meet the recognition criteria, with research costs expensed.', when: ['intangibles'] },
  { id: 'a-int-2', area: 'Intangible assets', text: 'Recompute amortisation, and review the useful life, residual value and method for each class.', when: ['intangibles'] },
  { id: 'a-int-3', area: 'Intangible assets', text: 'Assess indicators of impairment, and review management’s impairment assessment of goodwill.', when: ['intangibles'] },
  { id: 'a-ivt-1', area: 'Investments', text: 'Confirm the existence and ownership of each investment with share certificates, registrars, custodians or title documents.', when: ['investments'] },
  { id: 'a-ivt-2', area: 'Investments', text: 'Check that each investment is classified correctly (subsidiary, associate, joint venture, investment property or financial asset) and measured on the basis the framework requires for that class.', when: ['investments'] },
  { id: 'a-ivt-3', area: 'Investments', text: 'Test fair values and valuations to quoted prices or the valuer’s report, assess the valuer’s competence and independence, and assess impairment.', when: ['investments'] },
  { id: 'a-ivt-4', area: 'Investments', text: 'Agree dividend, interest and rental income from investments, and gains or losses on disposal, to supporting documents.', when: ['investments'] },
  { id: 'a-pay-1', area: 'Payables', text: 'Test payables to supplier statements and search for unrecorded liabilities.', when: ['trade_payables'] },
  { id: 'a-opy-1', area: 'Other payables and accruals', text: 'Test accruals and other payables to after-date payments and supporting documents.', when: ['other_payables'] },
  { id: 'a-bor-1', area: 'Borrowings', text: 'Confirm borrowings with lenders, agree terms to the loan agreements, recompute interest, and test the split between current and non-current.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 'a-bor-2', area: 'Borrowings', text: 'Review compliance with covenants at the year end, and identify assets pledged as security.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 'a-prv-1', area: 'Provisions', text: 'Check each provision meets the recognition criteria, test the estimate to evidence and after-date events, and identify contingent liabilities, including through confirmations from the entity’s lawyers.', when: ['provisions'] },
  { id: 'a-tax-1', area: 'Taxation', text: 'Recompute the income tax charge and agree balances to assessments and remittances.' },
  { id: 'a-tax-2', area: 'Taxation', text: 'Recompute deferred tax from the temporary differences, and assess whether any deferred tax asset is recoverable.', when: ['deferred_tax_asset', 'deferred_tax_liability'] },
  { id: 'a-eq-1', area: 'Equity', text: 'Agree share capital to the company records at the Corporate Affairs Commission.' },
  { id: 'a-rev-1', area: 'Revenue', text: 'Test revenue for occurrence, accuracy and cut-off.' },
  { id: 'a-exp-1', area: 'Expenses', text: 'Test expenses and payroll to supporting documents, and test cut-off.' },
  { id: 'a-jnl-1', area: 'Journals', text: 'Test journal entries and other adjustments for evidence of management override.' },
  { id: 'a-cmp-1', area: 'Completion', text: 'Evaluate going concern and events after the reporting date.' },
  { id: 'a-cmp-2', area: 'Completion', text: 'Evaluate misstatements and conclude on the schedule of unadjusted differences.' },
  { id: 'a-cmp-3', area: 'Completion', text: 'Review the financial statements against the disclosure requirements of the framework and the companies law of the client’s country.' },
  { id: 'a-cmp-4', area: 'Completion', text: 'Obtain the signed letter of representation and the directors’ approval of the financial statements.' },
  { id: 'a-cmp-5', area: 'Completion', text: 'Complete the engagement partner review of the file.' },
];

const review: ProgrammeItem[] = [
  { id: 'r-acc-1', area: 'Acceptance', text: 'Confirm independence and ethical requirements, and agree the engagement letter.' },
  { id: 'r-pln-1', area: 'Planning', text: 'Document the understanding of the entity and determine materiality.' },
  { id: 'r-enq-1', area: 'Procedures', text: 'Make enquiries of management on each material item, estimates, related parties and unusual transactions.' },
  { id: 'r-ana-1', area: 'Procedures', text: 'Perform analytical procedures on each material item and investigate unexpected relationships.' },
  { id: 'r-add-1', area: 'Procedures', text: 'Perform additional procedures where a matter suggests the statements may be materially misstated.' },
  { id: 'r-cmp-1', area: 'Completion', text: 'Evaluate going concern and events after the reporting date.' },
  { id: 'r-cmp-2', area: 'Completion', text: 'Obtain written representations and complete the partner review.' },
];

const compilation: ProgrammeItem[] = [
  { id: 'c-acc-1', area: 'Acceptance', text: 'Confirm ethical requirements and agree the engagement letter.' },
  { id: 'c-und-1', area: 'Understanding', text: 'Document the understanding of the business, its records and the reporting framework.' },
  { id: 'c-cmp-1', area: 'Compilation', text: 'Compile the statements from the records, and discuss significant judgments with management.' },
  { id: 'c-cmp-2', area: 'Compilation', text: 'Read the compiled statements and raise anything that appears incomplete or misleading.' },
  { id: 'c-cmp-3', area: 'Completion', text: 'Obtain management’s acknowledgment of responsibility for the statements.' },
];

export const PROGRAMMES: Record<EngagementType, ProgrammeItem[]> = { audit, review, compilation };
