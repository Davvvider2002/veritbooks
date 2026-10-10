/**
 * Where the client keeps its books, and how to get the trial balance and the ledger out.
 *
 * STATUS: guidance, version 0.1. The Sage 50 ledger steps and the QuickBooks Desktop trial
 * balance steps were checked against published instructions. The rest is written from
 * knowledge of the products and has not been checked against each current version, so the
 * wording says what to look for rather than naming every menu. Menu names move between versions.
 */
export const SOURCES_VERSION = '0.1';

export interface Source {
  id: string;
  name: string;
  /** How to export the trial balance. */
  tb: string[];
  /** How to export the ledger for journal testing. */
  gl: string[];
  /** What to watch for in this package's files. */
  notes: string[];
}

export const SOURCES: Source[] = [
  {
    id: 'sage50',
    name: 'Sage 50 (Peachtree)',
    tb: [
      'Open Reports & Forms, then General Ledger, then General Ledger Trial Balance.',
      'Set the date to the year end.',
      'Click the Excel button and save the workbook.',
    ],
    gl: [
      'Open Reports & Forms, then General Ledger, then double-click General Ledger.',
      'Click Options, choose Specific Dates, and enter the first and last day of the year.',
      'Leave “Include accounts with zero amounts” unticked, then click OK.',
      'Click the Excel button, keep the default export options, and save the workbook.',
    ],
    notes: [
      'The ledger lists each account once, above its transactions. That is read correctly.',
      'Beginning Balance, Current Period Change and Ending Balance rows are left out.',
      'Journals are grouped by the Jrnl and Reference columns. Postings with no reference are grouped by day.',
    ],
  },
  {
    id: 'qbd',
    name: 'QuickBooks Desktop',
    tb: [
      'Open Reports, then Accountant & Taxes, then Trial Balance.',
      'Set the dates so the report ends on the year end.',
      'Click Excel (or Export), choose a new workbook, and save it.',
    ],
    gl: [
      'Open Reports, then Accountant & Taxes, then Journal.',
      'Set the dates to the first and last day of the year.',
      'Click Excel (or Export), choose a new workbook, and save it.',
    ],
    notes: [
      'Use the Journal report, not the General Ledger report. It keeps each transaction together with its number.',
      'Accounts printed as “1000 · Bank” are split into number and name.',
      'With account numbers switched off, accounts are matched to the trial balance by name.',
      'The trial balance shows sub-accounts by their own name. If a ledger account is not found, check for a renamed or merged account.',
    ],
  },
  {
    id: 'tally',
    name: 'Tally',
    tb: [
      'Open the Trial Balance and switch it to the detailed, ledger-wise view so every ledger account is listed, not just groups.',
      'Set the period to end on the year end.',
      'Export to Excel.',
    ],
    gl: [
      'Open the Day Book for the whole year in the detailed view, so every ledger line of each voucher is shown.',
      'Include the voucher number column.',
      'Export to Excel.',
    ],
    notes: [
      'A group-wise trial balance cannot be mapped. Each ledger account must be its own row.',
      'Amounts with a Dr or Cr suffix, and Indian digit grouping, are read correctly.',
      'This layout has had the least testing. Check the account count and the totals after import.',
    ],
  },
  {
    id: 'qbo',
    name: 'QuickBooks Online',
    tb: ['Open Reports and run the Trial Balance to the year end.', 'Export to Excel.'],
    gl: ['Open Reports and run the Journal report for the year.', 'Export to Excel.'],
    notes: ['Check which date format the company file uses. A US company file writes the month first.'],
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    tb: ['Open Reports, then the Trial Balance under the accountant reports, to the year end.', 'Export as XLSX or CSV.'],
    gl: ['Open Reports and run the Journal Report (or Account Transactions) for the year.', 'Export as XLSX or CSV.'],
    notes: ['Exports are capped at 25,000 rows. Split a larger ledger into two periods and combine the files before importing.'],
  },
  {
    id: 'xero',
    name: 'Xero',
    tb: ['Open Accounting, then Reports, then Trial Balance, to the year end.', 'Export to Excel.'],
    gl: ['Open Accounting, then Reports, then Journal Report (or Account Transactions) for the year.', 'Export to Excel.'],
    notes: [],
  },
  {
    id: 'other',
    name: 'Excel or another system',
    tb: [
      'Export or lay out the trial balance with one row per account.',
      'Give it a header row with the account name, and either Debit and Credit columns or one Balance column. An account code column helps.',
    ],
    gl: [
      'Export every posting for the year, one row per ledger line.',
      'Give it a header row with a date, an account, and Debit and Credit or one Amount column. Journal number, description and posted-by columns are used when present.',
    ],
    notes: [],
  },
];
