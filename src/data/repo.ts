import type { BankLine } from '../engine/bank';
import type { GlEntry } from '../engine/ledger';
import type {
  Adjustment,
  Disclosures,
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
  disclosures: Disclosures;
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

export interface Invite {
  id: string;
  email: string;
  role: Role;
  accepted: boolean;
}

/** An invitation waiting for the signed-in user. */
export interface PendingInvite {
  id: string;
  firmName: string;
  role: Role;
}

export type LedgerPeriod = 'current' | 'prior';

/** True when the file opens in the browser at its recorded page, rather than downloading. */
export const opensAtPage = (e: { fileName: string; page: number | null }) => !!e.page && /\.pdf$/i.test(e.fileName);

export type EvidenceRef = 'general' | 'programme' | 'journal' | 'bank' | 'adjustment' | 'request' | 'account';

export interface Evidence {
  id: string;
  path: string;
  fileName: string;
  size: number;
  refType: EvidenceRef;
  refId: string;
  note: string;
  uploadedByName: string;
  createdAt: string;
  /** True when the client sent the file through an upload link. */
  fromClient: boolean;
  /** The page of the document that holds the support, when one was recorded. */
  page: number | null;
}

export type RequestStatus = 'open' | 'received' | 'accepted' | 'returned';

export interface ClientRequest {
  id: string;
  title: string;
  detail: string;
  dueDate: string | null;
  status: RequestStatus;
  /** The firm's message to the client when an item is returned. */
  note: string;
}

export interface RequestLink {
  id: string;
  label: string;
  expiresAt: string;
  revoked: boolean;
  lastUsedAt: string | null;
}

/** What a client sees through an upload link. */
export interface PortalView {
  firm: string;
  client: string;
  yearEnd: string;
  closed: boolean;
  folder: string;
  requests: (ClientRequest & { files: { name: string; at: string }[] })[];
}

/** A link token: 32 random bytes, written in 43 URL-safe characters. Only its hash is stored. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

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

  /** Partners only. */
  listInvites(): Promise<Invite[]>;
  createInvite(email: string, role: Role): Promise<void>;
  deleteInvite(id: string): Promise<void>;
  setMemberRole(userId: string, role: Role): Promise<void>;
  removeMember(userId: string): Promise<void>;
  myInvites(): Promise<PendingInvite[]>;
  acceptInvite(id: string, fullName: string, frcNumber: string): Promise<void>;

  listClients(): Promise<Client[]>;
  createClient(c: Omit<Client, 'id'>): Promise<Client>;
  listEngagements(): Promise<Engagement[]>;
  createEngagement(e: { clientId: string; type: EngagementType; yearEnd: string; programmeVersion: string }): Promise<Engagement>;
  getEngagement(id: string): Promise<Engagement | null>;
  updateEngagement(id: string, patch: Partial<Pick<Engagement, 'planning' | 'programme' | 'report' | 'testing' | 'disclosures'>>): Promise<void>;

  listLines(engagementId: string): Promise<TbLine[]>;
  /** Replaces the whole trial balance of an engagement. */
  replaceLines(engagementId: string, lines: ImportLine[]): Promise<void>;
  setMapping(engagementId: string, clientId: string, line: TbLine, mapCode: string | null, nature: Nature | null): Promise<void>;
  savedMappings(clientId: string): Promise<Map<string, { mapCode: string; nature: Nature | null }>>;

  listAdjustments(engagementId: string): Promise<Adjustment[]>;
  addAdjustment(engagementId: string, a: Omit<Adjustment, 'id'>): Promise<void>;
  deleteAdjustment(id: string): Promise<void>;

  /** The general ledger of the year under audit, or of the year before it. */
  listLedger(engagementId: string, period?: LedgerPeriod): Promise<GlEntry[]>;
  /** Replaces the whole general ledger of one year. An empty list removes it. */
  replaceLedger(engagementId: string, entries: GlEntry[], period?: LedgerPeriod): Promise<void>;

  listBankAccounts(engagementId: string): Promise<BankAccount[]>;
  listBankLines(engagementId: string): Promise<StoredBankLine[]>;
  addBankStatement(engagementId: string, account: Omit<BankAccount, 'id'>, lines: BankLine[]): Promise<void>;
  deleteBankAccount(id: string): Promise<void>;

  listEvidence(engagementId: string): Promise<Evidence[]>;
  addEvidence(engagementId: string, file: File, meta: { refType: EvidenceRef; refId: string; note: string; uploadedByName: string; page?: number | null }): Promise<void>;
  setEvidencePage(e: Evidence, page: number | null): Promise<void>;
  deleteEvidence(e: Evidence): Promise<void>;
  /** A short-lived link to open the file. */
  /** A short-lived link to the file. A PDF with a page recorded opens in the browser at that page. */
  evidenceUrl(e: Evidence): Promise<string>;

  listRequests(engagementId: string): Promise<ClientRequest[]>;
  addRequests(engagementId: string, items: { title: string; detail: string; dueDate: string | null }[]): Promise<void>;
  updateRequest(id: string, patch: Partial<Pick<ClientRequest, 'status' | 'note'>>): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  listLinks(engagementId: string): Promise<RequestLink[]>;
  /** Creates an upload link and returns its token. The token cannot be shown again. */
  createLink(engagementId: string, label: string, days: number): Promise<string>;
  revokeLink(id: string): Promise<void>;
  /** The client's side: no sign-in, only the token. Null when the link is unknown, expired or revoked. */
  portalView(token: string): Promise<PortalView | null>;
  portalUpload(token: string, view: PortalView, requestId: string, file: File): Promise<void>;

  sign(engagementId: string): Promise<void>;
  listLog(engagementId: string): Promise<LogEntry[]>;

  /** The firm's system of quality management. Everyone in the firm reads it; partners maintain it. */
  listQuality(): Promise<QualityItem[]>;
  addQuality(items: QualityDraft[]): Promise<void>;
  updateQuality(id: string, patch: Partial<Omit<QualityDraft, 'kind'>>): Promise<void>;
  /** Removes a risk. A finding is closed, never removed. */
  deleteQuality(id: string): Promise<void>;
  listEvaluations(): Promise<QualityEvaluation[]>;
  /** Records the annual evaluation. It cannot be changed afterwards. */
  addEvaluation(e: { asAt: string; conclusion: QualityEvaluation['conclusion']; basis: string }): Promise<void>;
}

/** A quality risk with the firm's response, or a finding from monitoring with its remedial action. */
export interface QualityItem {
  id: string;
  kind: 'risk' | 'finding';
  component: string;
  title: string;
  /** Risk: what could go wrong. Finding: what was found, and its root cause. */
  detail: string;
  /** Risk: the firm's response. Finding: the remedial action. */
  response: string;
  owner: string;
  /** Risk: open (response still needed) or in_place. Finding: open or closed. */
  status: 'open' | 'in_place' | 'closed';
  severity: string | null;
  dueDate: string | null;
  updatedAt: string;
}
export type QualityDraft = Omit<QualityItem, 'id' | 'updatedAt'>;

export interface QualityEvaluation {
  id: string;
  asAt: string;
  conclusion: 'effective' | 'effective_except' | 'not_effective';
  basis: string;
  concludedByName: string;
  createdAt: string;
}

export class LockedError extends Error {
  constructor() {
    super('This engagement is signed and locked.');
  }
}
