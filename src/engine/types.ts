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
