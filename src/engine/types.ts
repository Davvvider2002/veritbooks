/** All amounts are integer kobo. Balances are debit-positive (debit minus credit). */
export type Kobo = number;

export type Nature = 'staff' | 'depreciation' | 'other';
export type EngagementType = 'audit' | 'review' | 'compilation';
export type Role = 'partner' | 'manager' | 'staff';

export interface TbLine {
  id: string;
  code: string;
  name: string;
  balance: Kobo;
  prior: Kobo | null;
  mapCode: string | null;
  nature: Nature | null;
}

export interface JournalLine {
  lineId: string;
  amount: Kobo; // debit positive
}

export interface Adjustment {
  id: string;
  ref: string;
  description: string;
  posted: boolean; // false = proposed but not booked (unadjusted difference)
  lines: JournalLine[];
}

export interface Planning {
  benchmark?: 'revenue' | 'profit_before_tax' | 'total_assets' | 'equity';
  percent?: number;
  performancePercent?: number;
  trivialPercent?: number;
  rationale?: string;
}

export interface ProgrammeState {
  [itemId: string]: { done: boolean; by?: string; at?: string; note?: string };
}

export interface ReportSettings {
  opinion?: 'unmodified' | 'qualified' | 'adverse' | 'disclaimer';
  basis?: string;
  directors?: string;
  ceoName?: string;
  ceoFrc?: string;
  cfoName?: string;
  cfoFrc?: string;
  principalActivity?: string;
}

export interface Testing {
  /** Conclusion on each journal selected for testing, keyed by journal number. */
  journals?: Record<string, { status: 'clear' | 'exception'; note: string; by: string; at: string }>;
  /** Conclusion on each bank reconciliation, keyed by bank account id. */
  bank?: Record<string, { note: string; by: string; at: string }>;
}

export interface RelatedParty {
  name: string;
  relationship: string;
  nature: string;
  amount: Kobo;
  balance: Kobo;
}

export interface EarlierYear {
  year: string;
  revenue: Kobo;
  pbt: Kobo;
  tax: Kobo;
  nca: Kobo;
  ca: Kobo;
  liabilities: Kobo;
  capital: Kobo;
  reserves: Kobo;
}

/** Information the trial balance cannot supply, entered by the preparer for the notes and directors' pages. */
export interface Disclosures {
  directors?: string; // one name per line
  secretary?: string;
  registeredOffice?: string;
  /** Cost of assets disposed of (cost accounts) or depreciation eliminated on disposal (depreciation accounts), by account code. */
  ppeDisposals?: Record<string, Kobo>;
  taxRate?: number; // percent
  taxItems?: { label: string; amount: Kobo }[];
  relatedParties?: RelatedParty[];
  /** Ticked when the preparer confirms there is nothing to disclose beyond directors' remuneration. */
  noRelatedParties?: boolean;
  directorsRemuneration?: Kobo;
  employees?: number;
  goingConcern?: string;
  subsequentEvents?: string;
  contingencies?: string;
  commitments?: string;
  earlierYears?: EarlierYear[];
  /** The preparer's answer to each item of the disclosure checklist, by item id. */
  checklist?: Record<string, ChecklistAnswer>;
}

export interface ChecklistAnswer {
  status: 'disclosed' | 'na';
  /** Where it is disclosed, or why it does not apply. A reason is required when it does not apply. */
  note: string;
  by: string;
  at: string;
}
