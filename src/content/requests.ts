/**
 * A starting list of what an auditor asks a client for.
 * STATUS: starter content, version 0.1. Tailor it to the engagement. Not a reviewed methodology.
 */
export const STANDARD_REQUESTS: { title: string; detail: string }[] = [
  { title: 'Bank statements', detail: 'Every account, for the full year and the month after the year end, from the bank as PDF or Excel.' },
  { title: 'Bank reconciliations', detail: 'For every account at the year end, with the list of outstanding items.' },
  { title: 'General ledger and trial balance', detail: 'Exported from the accounting system for the full year, before closing entries.' },
  { title: 'Receivables listing', detail: 'Aged, by customer, agreeing to the trial balance at the year end.' },
  { title: 'Payables listing', detail: 'Aged, by supplier, agreeing to the trial balance, with supplier statements for the largest balances.' },
  { title: 'Inventory count sheets and valuation', detail: 'The year-end count records and the costed listing.' },
  { title: 'Fixed asset register', detail: 'With invoices for additions and details of any disposals in the year.' },
  { title: 'Payroll records', detail: 'Monthly payroll summaries, PAYE and pension remittance evidence.' },
  { title: 'Tax returns and assessments', detail: 'Company income tax, VAT and withholding tax filings for the year, with payment receipts and any assessments.' },
  { title: 'Loan and lease agreements', detail: 'Signed agreements, repayment schedules and lender statements at the year end.' },
  { title: 'Minutes of board and members’ meetings', detail: 'For the year and up to the date of approval of the accounts.' },
  { title: 'Statutory records', detail: 'Certificate of incorporation, memorandum and articles, and the latest annual return filed at the Corporate Affairs Commission.' },
  { title: 'Related party details', detail: 'A list of directors’ other businesses and any transactions with them in the year.' },
  { title: 'Prior year signed financial statements', detail: 'With the prior auditor’s report and management letter, if any.' },
];
