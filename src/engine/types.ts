import type { GroupSetup } from './consolidation';
import type { CipcDetails } from './ixbrl';
import type { TaxWorking } from './tax';

/** All amounts are integer kobo. Balances are debit-positive (debit minus credit). */
export type Kobo = number;

export type Nature = 'staff' | 'depreciation' | 'other';
export type EngagementType = 'audit' | 'review' | 'compilation';
export type Role = 'partner' | 'manager' | 'staff';
export type EntityKind = 'company' | 'npo';

export interface TbLine {
  id: string;
  code: string;
  name: string;
  balance: Kobo;
  prior: Kobo | null;
  /** The year before the prior year, when it has been imported. Used for trends and the financial summary. */
  prior2?: Kobo | null;
  /** Three and four years before the current year, when imported. Used for the cash flow comparatives, trends and the five-year summary. */
  prior3?: Kobo | null;
  prior4?: Kobo | null;
  mapCode: string | null;
  nature: Nature | null;
  /** Not-for-profit: the restricted fund (a grant, project or donor) the account belongs to. Null for unrestricted. */
  fund?: string | null;
  /** Canada: the account's GIFI code, for the T2 return. */
  gifi?: string | null;
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
  benchmark?: 'revenue' | 'profit_before_tax' | 'total_assets' | 'equity' | 'total_income' | 'total_expenditure';
  percent?: number;
  performancePercent?: number;
  trivialPercent?: number;
  rationale?: string;
  /** Subsidiaries and eliminations, when this engagement's client is the parent of a group. */
  group?: GroupSetup;
  /** Each team member's confirmation of independence from the client, by user id. */
  independence?: Record<string, { name: string; at: string; note: string }>;
  /** The industry pack that adds to the general programme, checklist and request list. */
  industry?: string;
  /** The kind of entity: a company (the default) or a not-for-profit organisation. */
  entity?: EntityKind;
  /** A not-for-profit's legal form, such as incorporated trustees. */
  legalForm?: string;
  /** Canada: the statute the client is incorporated under, by id from content/canada. */
  statute?: string;
  /** Canada, ASPE: how income taxes are accounted for (Section 3465). */
  taxMethod?: 'taxes-payable' | 'future';
  /** Canada, ASNPO: how contributions are recognised (Section 4410). */
  contributionMethod?: 'deferral' | 'restricted-fund';
  /** Canada: a soliciting corporation (federal) or public benefit corporation (Ontario): over $10,000 a year from public donations or grants. */
  soliciting?: boolean;
}

export interface ProgrammeState {
  [itemId: string]: {
    done: boolean;
    by?: string;
    at?: string;
    /** The working paper reference, or a note on the work. */
    note?: string;
    /** Evidence files already in the file that support this step, by id, besides those attached to it. */
    files?: string[];
    /** The manager or partner who reviewed the step, and when. */
    reviewedBy?: string;
    reviewedAt?: string;
  };
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
  /** The partner's description of a material uncertainty about going concern that is adequately disclosed. */
  goingConcern?: string;
  /** The partner's emphasis of matter: a matter properly disclosed that is fundamental to understanding the statements. */
  emphasis?: string;
  /** The partner's other matter: something not in the statements that helps a reader understand the audit or the report. */
  otherMatter?: string;
  /** The report exactly as it stood when the partner signed. A signed report is shown from this, never redrafted. */
  signedReport?: { title: string; addressee: string; sections: { heading: string; paragraphs: string[] }[] };
  /** A material misstatement the auditor found in the other information. Blank when there is nothing to report. */
  otherInformation?: string;
  /** Canada, compilation (CSRS 4200): the basis of accounting agreed with management. */
  compilationBasis?: 'aspe' | 'cash-accruals' | 'cash' | 'tax' | 'other';
  /** The accruals added to the cash basis, in words, for the basis note. */
  basisAccruals?: string;
  /** Another basis, described in full. */
  basisOther?: string;
  /** Who will use the compiled statements, and for what: "the bank, for the operating line covenant". */
  intendedUse?: string;
  /** The date the engagement letter for the year was signed. */
  engagementLetter?: string;
  /** Management has acknowledged its responsibility for the final compiled statements, and when. */
  managementAck?: string;
  /** Canada: the signing partner confirmed holding the public accounting licence the engagement needs. */
  licenceConfirmed?: { by: string; at: string; province: string };
}

export interface Testing {
  /** Conclusion on each journal selected for testing, keyed by journal number. */
  journals?: Record<string, { status: 'clear' | 'exception'; note: string; by: string; at: string }>;
  /** The explanation obtained for each significant movement against last year, keyed by statement line. */
  movements?: Record<string, { note: string; by: string; at: string }>;
  /** Conclusion on each bank reconciliation, keyed by bank account id. */
  bank?: Record<string, { note: string; by: string; at: string }>;
  /** Whether this year's opening balances agree with last year's audited closing balances. */
  opening?: { status: 'agreed' | 'explained' | 'first_year'; note: string; by: string; at: string; source: 'veritbooks' | 'manual' };
  /** Points for the letter to management. */
  managementLetter?: ManagementLetter;
}

export interface ManagementPoint {
  id: string;
  title: string;
  observation: string;
  implication: string;
  recommendation: string;
  response: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'agreed' | 'resolved';
}

export interface ManagementLetter {
  addressee?: string;
  date?: string;
  points: ManagementPoint[];
  /** The firm's own wording for any part of the letter. A part left out prints the standard wording. */
  wording?: Partial<Record<LetterPart, string>>;
  /** A letter the firm wrote itself and uploaded, issued in place of the drafted one. */
  ownLetter?: { evidenceId: string; fileName: string; by: string; at: string };
}

export type LetterPart = 'salutation' | 'title' | 'intro' | 'limitation' | 'closing' | 'signoff' | 'observation' | 'implication' | 'recommendation' | 'response' | 'awaiting';

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
  /** Accounting policy wording confirmed for this client, by statement line. A line with no entry prints the starter wording. */
  policies?: Record<string, { text: string; by: string; at: string }>;
  /** The preparer's answer to each item of the disclosure checklist, by item id. */
  checklist?: Record<string, ChecklistAnswer>;
  /** South Africa: the income tax computation, provisional tax and deferred tax working. */
  tax?: TaxWorking;
  /** South Africa: what the CIPC annual financial statements filing needs beyond the statements. */
  cipc?: CipcDetails;
}

export interface ChecklistAnswer {
  status: 'disclosed' | 'na';
  /** Where it is disclosed, or why it does not apply. A reason is required when it does not apply. */
  note: string;
  by: string;
  at: string;
}
