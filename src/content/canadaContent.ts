import type { ChecklistItem } from './checklist';
import type { ProgrammeItem } from './programmes';
import type { EngagementType } from '../engine/types';

/**
 * Canadian work programmes and disclosure checklist.
 *
 * Programmes: audits under the Canadian Auditing Standards (CAS), reviews under CSRE 2400,
 * compilations under CSRS 4200. Checklist: ASPE (CPA Canada Handbook, Part II), with the ASNPO
 * sections of Part III for not-for-profits, by Handbook section.
 *
 * STATUS: starter content, version 0.1. Plain-language summaries to exercise the software. They
 * are not the text of the standards and not complete. A Canadian CPA must review them against
 * the Handbook in force, including CAS 240 and CAS 570 as revised for periods beginning on or
 * after 15 December 2026, before live use.
 */
export const CANADA_CONTENT_VERSION = '0.1-starter';

const audit: ProgrammeItem[] = [
  { id: 'ca-a-acc-1', area: 'Acceptance', text: 'Confirm independence and the other requirements of the CPA Code of Professional Conduct for the firm and the team.' },
  { id: 'ca-a-acc-2', area: 'Acceptance', text: 'Agree the terms of the engagement in an engagement letter (CAS 210).' },
  { id: 'ca-a-acc-3', area: 'Acceptance', text: 'Confirm the entity is not a reporting issuer, that ASPE or ASNPO is an acceptable framework for it, and that the engagement partner holds a public accounting licence that covers the audit in the province.' },
  { id: 'ca-a-pln-1', area: 'Planning', text: 'Document the understanding of the entity, its environment, the framework and its system of internal control (CAS 315).' },
  { id: 'ca-a-pln-2', area: 'Planning', text: 'Set materiality and performance materiality, and the clearly trivial threshold (CAS 320).' },
  { id: 'ca-a-pln-3', area: 'Planning', text: 'Identify and assess risks of material misstatement due to fraud, including management override and revenue recognition (CAS 240).' },
  { id: 'ca-a-pln-4', area: 'Planning', text: 'Obtain evidence on opening balances, or agree them to last year’s audited statements (CAS 510).' },
  { id: 'ca-a-pln-5', area: 'Planning', text: 'Identify related parties and transactions with them (CAS 550; ASPE Section 3840).' },
  { id: 'ca-a-cash-1', area: 'Cash', text: 'Obtain bank confirmations and agree them to the year-end bank reconciliations (CAS 505).' },
  { id: 'ca-a-cash-2', area: 'Cash', text: 'Test reconciling items to bank statements after the year end.' },
  { id: 'ca-a-rec-1', area: 'Receivables', text: 'Agree the aged receivables listing to the ledger, and test balances to confirmations or receipts after the year end.' },
  { id: 'ca-a-rec-2', area: 'Receivables', text: 'Assess the allowance for doubtful accounts and impairment of financial assets (Section 3856).' },
  { id: 'ca-a-inv-1', area: 'Inventory', text: 'Attend the inventory count, or perform alternative procedures, and test the lower of cost and net realizable value (CAS 501; Section 3031).' },
  { id: 'ca-a-ppe-1', area: 'Capital assets', text: 'Vouch additions and disposals, test ownership, recompute amortization and consider impairment (Sections 3061 and 3063).' },
  { id: 'ca-a-pay-1', area: 'Payables', text: 'Test payables to supplier statements and search for unrecorded liabilities.' },
  { id: 'ca-a-pay-2', area: 'Government remittances', text: 'Test GST/HST, payroll source deductions and workers’ compensation remittances for completeness and timeliness. Directors can be personally liable for unremitted amounts.' },
  { id: 'ca-a-tax-1', area: 'Income taxes', text: 'Recompute income taxes under the method the entity uses (taxes payable or future income taxes, Section 3465), and agree balances to notices of assessment and instalments.' },
  { id: 'ca-a-eq-1', area: 'Equity', text: 'Agree share capital and dividends to the minute book and to the corporate registry (Corporations Canada or the provincial registry).' },
  { id: 'ca-a-debt-1', area: 'Debt', text: 'Confirm long-term debt, test covenants at the year end and their effect on classification, and the principal repayments for the next five years (Section 3856).' },
  { id: 'ca-a-rev-1', area: 'Revenue', text: 'Test revenue for occurrence, accuracy and cut-off against the revenue recognition policy (Section 3400).' },
  { id: 'ca-a-exp-1', area: 'Expenses', text: 'Test expenses and payroll to supporting documents, and test cut-off.' },
  { id: 'ca-a-jnl-1', area: 'Journals', text: 'Test journal entries and other adjustments for evidence of management override (CAS 240).' },
  { id: 'ca-a-cmp-1', area: 'Completion', text: 'Evaluate management’s going concern assessment (CAS 570) and events after the reporting date (CAS 560; Section 3820).' },
  { id: 'ca-a-cmp-2', area: 'Completion', text: 'Accumulate misstatements and conclude on the uncorrected misstatements (CAS 450).' },
  { id: 'ca-a-cmp-3', area: 'Completion', text: 'Review the financial statements against ASPE or ASNPO disclosure requirements.' },
  { id: 'ca-a-cmp-4', area: 'Completion', text: 'Obtain the signed management representation letter (CAS 580), dated as near as practicable to the report date.' },
  { id: 'ca-a-cmp-5', area: 'Completion', text: 'Communicate with those charged with governance, including significant deficiencies in internal control (CAS 260 and CAS 265).' },
  { id: 'ca-a-cmp-6', area: 'Completion', text: 'Complete the engagement partner review, and an engagement quality review where the firm’s policies require one (CSQM 2).' },
];

const review: ProgrammeItem[] = [
  { id: 'ca-r-acc-1', area: 'Acceptance', text: 'Confirm independence and ethical requirements, confirm the partner’s public accounting licence covers the review, and agree the engagement letter.' },
  { id: 'ca-r-pln-1', area: 'Planning', text: 'Document the understanding of the entity, its accounting system and records, and the framework, and determine materiality (CSRE 2400).' },
  { id: 'ca-r-pln-2', area: 'Planning', text: 'Identify the areas where material misstatement is likely, including items below materiality for qualitative reasons.' },
  { id: 'ca-r-enq-1', area: 'Inquiries', text: 'Inquire about related parties and transactions with them, and significant or unusual transactions.' },
  { id: 'ca-r-enq-2', area: 'Inquiries', text: 'Inquire about significant estimates, going concern, fraud and suspected fraud, and non-compliance with laws and regulations.' },
  { id: 'ca-r-enq-3', area: 'Inquiries', text: 'Inquire about events after the reporting date, commitments, contingencies and government remittances (GST/HST and payroll source deductions).' },
  { id: 'ca-r-ana-1', area: 'Analytical procedures', text: 'Perform analytical procedures on all material items, including disclosures, and investigate fluctuations that are not as expected.' },
  { id: 'ca-r-add-1', area: 'Additional procedures', text: 'Where a matter suggests the statements may be materially misstated, perform additional procedures until the matter is resolved.' },
  { id: 'ca-r-cmp-1', area: 'Completion', text: 'Communicate accumulated misstatements to management and request their correction.' },
  { id: 'ca-r-cmp-2', area: 'Completion', text: 'Obtain written representations, read the statements against ASPE or ASNPO, and complete the partner review.' },
];

const compilation: ProgrammeItem[] = [
  { id: 'ca-c-acc-1', area: 'Acceptance', text: 'Confirm the ethical requirements of the CPA Code of Professional Conduct. If third parties will rely on the statements in Ontario, confirm the licence requirement is met.' },
  { id: 'ca-c-acc-2', area: 'Acceptance', text: 'Agree an engagement letter for the year: the intended use and users, the basis of accounting, management’s responsibilities, and, where a third party will use the statements, management’s acknowledgment that the third party can ask for more information or has agreed the basis (CSRS 4200).' },
  { id: 'ca-c-und-1', area: 'Understanding', text: 'Document the business and its operations, the accounting system and records, the basis of accounting and the accounting policies.' },
  { id: 'ca-c-cmp-1', area: 'Compilation', text: 'Compile the statements from the records. Reconcile the records to the compiled statements, including adjustments.' },
  { id: 'ca-c-cmp-2', area: 'Compilation', text: 'Discuss significant judgments with management, and document them.' },
  { id: 'ca-c-cmp-3', area: 'Compilation', text: 'Read the compiled statements. If they appear false or misleading, propose changes, and withdraw if management does not make them.' },
  { id: 'ca-c-cmp-4', area: 'Compilation', text: 'Check that Note 1 describes the basis of accounting, and that ASPE or ASNPO is named only if the statements comply with it in full.' },
  { id: 'ca-c-cmp-5', area: 'Completion', text: 'Obtain management’s acknowledgment of responsibility for the final compiled statements, and date the report on or after it.' },
];

export const PROGRAMMES_CA: Record<EngagementType, ProgrammeItem[]> = { audit, review, compilation };

const S = {
  h1400: 'Section 1400: General standards of financial statement presentation',
  h1505: 'Section 1505: Disclosure of accounting policies',
  h1506: 'Section 1506: Accounting changes',
  h1510: 'Section 1510: Current assets and current liabilities',
  h1520: 'Section 1520: Income statement',
  h1521: 'Section 1521: Balance sheet',
  h1540: 'Section 1540: Cash flow statement',
  h3031: 'Section 3031: Inventories',
  h3061: 'Section 3061: Property, plant and equipment',
  h3063: 'Section 3063: Impairment of long-lived assets',
  h3064: 'Section 3064: Goodwill and intangible assets',
  h3065: 'Section 3065: Leases',
  h3240: 'Section 3240: Share capital',
  h3251: 'Section 3251: Equity',
  h3280: 'Section 3280: Contractual obligations',
  h3290: 'Section 3290: Contingencies',
  h3400: 'Section 3400: Revenue',
  h3462: 'Section 3462: Employee future benefits',
  h3465: 'Section 3465: Income taxes',
  h3820: 'Section 3820: Subsequent events',
  h3840: 'Section 3840: Related party transactions',
  h3856: 'Section 3856: Financial instruments',
  h4400: 'Section 4400: Financial statement presentation by not-for-profit organizations',
  h4410: 'Section 4410: Contributions, revenue recognition',
  h4433: 'Section 4433: Tangible capital assets held by not-for-profit organizations',
  h4460: 'Section 4460: Disclosure of related party transactions by not-for-profit organizations',
  h4470: 'Section 4470: Disclosure of allocated expenses by not-for-profit organizations',
};

const ASPE: ChecklistItem[] = [
  { id: 'ca-1400-compliance', section: S.h1400, text: 'The statements state that they are prepared in accordance with Canadian accounting standards for private enterprises (or ASNPO), and comply with it in full.', auto: 'compliance_statement' },
  { id: 'ca-1400-going-concern', section: S.h1400, text: 'Management’s going concern assessment is reflected, and material uncertainties are disclosed.', auto: 'going_concern' },
  { id: 'ca-1400-comparatives', section: S.h1400, text: 'Comparative figures are given for the prior period.', auto: 'comparatives' },
  { id: 'ca-1400-nature', section: S.h1400, text: 'The nature of operations and the statute the entity is incorporated under are described.', auto: 'general_information' },
  { id: 'ca-1505-policies', section: S.h1505, text: 'The significant accounting policies are disclosed, including the choices ASPE allows: the income tax method, and the policies for revenue, inventory and capital assets.', auto: 'policies_tailored' },
  { id: 'ca-1506-changes', section: S.h1506, text: 'Any change in accounting policy, change in estimate or correction of an error is disclosed, with its nature, its effect and how the comparatives were restated.' },
  { id: 'ca-1510-classification', section: S.h1510, text: 'Current assets and current liabilities are shown separately, and amounts due after one year are classified as long-term.', auto: 'identification' },
  { id: 'ca-1520-items', section: S.h1520, text: 'Revenue, amortization, interest expense, income taxes and unusual items are shown separately, on the face or in the notes.', auto: 'line_breakdown' },
  { id: 'ca-1521-items', section: S.h1521, text: 'The balance sheet presents the required items, including amounts due from and to related parties shown separately.', auto: 'line_breakdown' },
  { id: 'ca-1540-cash', section: S.h1540, text: 'The components of cash and cash equivalents, and the policy for determining them, are disclosed.', auto: 'cash_components' },
  { id: 'ca-3031-inventories', section: S.h3031, text: 'The policy and cost formula, the carrying amount by classification, the amount expensed, any write-downs and reversals, and inventory pledged as security are disclosed.', when: ['inventories'] },
  { id: 'ca-3061-ppe', section: S.h3061, text: 'For each major category: cost, accumulated amortization, the amortization method and the period or rate, and the amortization charged in the year.', when: ['ppe'], auto: 'ppe_reconciliation' },
  { id: 'ca-3063-impairment', section: S.h3063, text: 'Any impairment of long-lived assets is described, with the amount and the facts that led to it.', when: ['ppe', 'intangibles'] },
  { id: 'ca-3064-intangibles', section: S.h3064, text: 'Intangible assets and goodwill are disclosed, with the amortization method and period, and any impairment.', when: ['intangibles'] },
  { id: 'ca-3065-leases', section: S.h3065, text: 'For capital leases: the assets and obligations, interest, and future minimum lease payments. For operating leases: future minimum payments for each of the next five years.' },
  { id: 'ca-3240-shares', section: S.h3240, text: 'For each class of shares: the number authorized and issued, the rights and privileges, and changes in the year.', when: ['share_capital', 'share_premium'] },
  { id: 'ca-3251-equity', section: S.h3251, text: 'Changes in each component of equity in the year are presented, including dividends.', auto: 'equity_statement' },
  { id: 'ca-3280-obligations', section: S.h3280, text: 'Significant contractual obligations, and commitments to acquire assets, are disclosed.', auto: 'commitments' },
  { id: 'ca-3290-contingencies', section: S.h3290, text: 'Contingent liabilities and guarantees are described, with an estimate of the amount or a statement that it cannot be made.', auto: 'contingencies' },
  { id: 'ca-3400-revenue', section: S.h3400, text: 'The revenue recognition policy for each major category is disclosed, with the amount of each category where significant.', when: ['revenue', 'other_income'] },
  { id: 'ca-3462-benefits', section: S.h3462, text: 'For defined benefit plans: the obligation, plan assets and the expense. For defined contribution plans: the expense.' },
  { id: 'ca-3465-taxes', section: S.h3465, text: 'The income tax method is disclosed. Under the taxes payable method, the expense is reconciled to the statutory rate. Under the future income taxes method, current and future tax are shown separately, with the future tax balances.', when: ['income_tax_expense', 'current_tax_payable', 'deferred_tax_asset', 'deferred_tax_liability'], auto: 'tax_reconciliation' },
  { id: 'ca-3820-events', section: S.h3820, text: 'Events after the balance sheet date that did not require adjustment are described, with their financial effect where it can be estimated.', auto: 'subsequent_events' },
  { id: 'ca-3840-related', section: S.h3840, text: 'For related party transactions: the relationship, a description, the amounts, the measurement basis, amounts due with their terms, and contractual obligations and contingencies.', auto: 'related_parties' },
  { id: 'ca-3856-instruments', section: S.h3856, text: 'The carrying amounts of financial assets and liabilities by category, and any impairment, are disclosed.', when: ['trade_receivables', 'other_receivables', 'investments', 'trade_payables', 'other_payables', 'borrowings_nc', 'borrowings_c'] },
  { id: 'ca-3856-debt', section: S.h3856, text: 'For long-term debt: the terms, interest rates, security, and the principal repayments in each of the next five years. Any default or covenant breach, and how it was resolved, is disclosed.', when: ['borrowings_nc', 'borrowings_c'] },
  { id: 'ca-3856-risks', section: S.h3856, text: 'The significant risks from financial instruments (credit, liquidity, market, currency and interest rate) are described, with any change since last year.', when: ['trade_receivables', 'investments', 'borrowings_nc', 'borrowings_c'] },
];

const ASNPO: ChecklistItem[] = [
  { id: 'ca-4400-presentation', section: S.h4400, text: 'The statements of financial position, operations, changes in net assets and cash flows are presented, with net assets shown as unrestricted, internally restricted, restricted for endowment and invested in capital assets, as applies.', auto: 'complete_set' },
  { id: 'ca-4400-purpose', section: S.h4400, text: 'The organization’s purpose, its legal form, and its status under the Income Tax Act are described.', auto: 'general_information' },
  { id: 'ca-4410-method', section: S.h4410, text: 'The method used for contributions (deferral or restricted fund) is disclosed, with the policy for each type of contribution, including contributed materials and services.' },
  { id: 'ca-4410-deferred', section: S.h4410, text: 'Deferred contributions and their movement in the year, or for the restricted fund method each restricted fund, are disclosed.', when: ['restricted_funds', 'grant_income', 'donations'] },
  { id: 'ca-4410-endowment', section: S.h4410, text: 'Endowment contributions and net assets restricted for endowment are disclosed, with the restrictions.', when: ['endowment_funds'] },
  { id: 'ca-4433-capital', section: S.h4433, text: 'For each major category of tangible capital assets: cost, accumulated amortization, the amortization method and period, and any write-down.', when: ['ppe'] },
  { id: 'ca-4460-related', section: S.h4460, text: 'Related party transactions, and economic interest in other organizations, are disclosed.', auto: 'related_parties' },
  { id: 'ca-4470-allocated', section: S.h4470, text: 'Where fundraising and general support expenses are allocated to other functions, the policy, the amounts allocated and the functions they were allocated to are disclosed.', when: ['fundraising_costs', 'admin_expenses'] },
];

/** The Canadian checklist: ASPE, and for a not-for-profit the ASNPO sections first. */
export const checklistCanada = (npo: boolean): ChecklistItem[] => (npo ? [...ASNPO, ...ASPE.filter((x) => x.id !== 'ca-1400-nature' && x.id !== 'ca-3240-shares')] : ASPE);
