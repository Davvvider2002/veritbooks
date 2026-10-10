import type { BankLine } from '../engine/bank';
import type { GlEntry } from '../engine/ledger';
import type {
  Adjustment,
  EngagementType,
  Nature,
  Planning,
  ProgrammeState,
  ReportSettings,
  Role,
  TbLine,
  Testing,
} from '../engine/types';

export interface User {
  id: string;
  email: string;
}

export interface Firm {
  id: string;
  name: string;
  frcNumber: string;
  address: string;
}

export interface Member {
  userId: string;
  role: Role;
  fullName: string;
  frcNumber: string;
}

export interface Client {
  id: string;
  name: string;
  rcNumber: string;
  sector: string;
}

export interface Engagement {
  id: string;
  clientId: string;
  type: EngagementType;
  yearEnd: string;
  status: 'in_progress' | 'locked';
  planning: Planning;
  programme: ProgrammeState;
  programmeVersion: string;
  report: ReportSettings;
  testing: Testing;
  signedByName: string | null;
  signedByFrc: string | null;
  firmFrc: string | null;
  signedAt: string | null;
}

export interface LogEntry {
  id: string;
  at: string;
  table: string;
  action: string;
  userId: string | null;
  detail: Record<string, unknown> | null;
}

export interface Workspace {
  firm: Firm;
  me: Member;
  members: Member[];
}

export interface NewFirm {
  name: string;
  frcNumber: string;
  address: string;
  fullName: string;
  memberFrc: string;
}

export interface BankAccount {
  id: string;
  name: string;
  /** Code of the trial balance account this statement supports. */
  accountCode: string;
  opening: number | null;
  /** Balance per statement at the year end. */
  closing: number;
  breaks: number;
  fileName: string;
}

export type StoredBankLine = BankLine & { accountId: string };

export type ImportLine = Pick<TbLine, 'code' | 'name' | 'balance' | 'prior' | 'mapCode' | 'nature'>;

/**
 * Everything the app needs from storage. Two implementations exist:
 * Supabase (production) and browser storage (demo mode, used when no Supabase keys are set).
 */
export interface Repo {
  readonly mode: 'supabase' | 'demo';
  currentUser(): Promise<User | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Returns true when the account still needs email confirmation before sign-in. */
  signUp(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;

  workspace(): Promise<Workspace | null>;
  createFirm(f: NewFirm): Promise<void>;
  updateFirm(patch: Pick<Firm, 'name' | 'frcNumber' | 'address'>): Promise<void>;
  updateMyProfile(patch: Pick<Member, 'fullName' | 'frcNumber'>): Promise<void>;

  listClients(): Promise<Client[]>;
  createClient(c: Omit<Client, 'id'>): Promise<Client>;
  listEngagements(): Promise<Engagement[]>;
  createEngagement(e: { clientId: string; type: EngagementType; yearEnd: string; programmeVersion: string }): Promise<Engagement>;
  getEngagement(id: string): Promise<Engagement | null>;
  updateEngagement(id: string, patch: Partial<Pick<Engagement, 'planning' | 'programme' | 'report' | 'testing'>>): Promise<void>;

  listLines(engagementId: string): Promise<TbLine[]>;
  /** Replaces the whole trial balance of an engagement. */
  replaceLines(engagementId: string, lines: ImportLine[]): Promise<void>;
  setMapping(engagementId: string, clientId: string, line: TbLine, mapCode: string | null, nature: Nature | null): Promise<void>;
  savedMappings(clientId: string): Promise<Map<string, { mapCode: string; nature: Nature | null }>>;

  listAdjustments(engagementId: string): Promise<Adjustment[]>;
  addAdjustment(engagementId: string, a: Omit<Adjustment, 'id'>): Promise<void>;
  deleteAdjustment(id: string): Promise<void>;

  listLedger(engagementId: string): Promise<GlEntry[]>;
  /** Replaces the whole general ledger of an engagement. An empty list removes it. */
  replaceLedger(engagementId: string, entries: GlEntry[]): Promise<void>;

  listBankAccounts(engagementId: string): Promise<BankAccount[]>;
  listBankLines(engagementId: string): Promise<StoredBankLine[]>;
  addBankStatement(engagementId: string, account: Omit<BankAccount, 'id'>, lines: BankLine[]): Promise<void>;
  deleteBankAccount(id: string): Promise<void>;

  sign(engagementId: string): Promise<void>;
  listLog(engagementId: string): Promise<LogEntry[]>;
}

export class LockedError extends Error {
  constructor() {
    super('This engagement is signed and locked.');
  }
}
