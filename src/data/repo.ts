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
  /** The firm named in the invitation email this account was created from, if any. */
  invitedTo?: string | null;
}

export interface Firm {
  id: string;
  name: string;
  /** The regulator's registration or licence number, named for the firm's country: FRC in Nigeria, ICAG in Ghana. */
  frcNumber: string;
  address: string;
  /** Where the firm practises. Sets the law its reports cite, the licence it signs with, and its prices. */
  country: CountryCode;
  /** True when a partner has turned AI assistance on for the firm. Off unless they do. */
  aiEnabled: boolean;
  /** How the firm's reports look. Set by a partner or manager. */
  branding: Branding;
  /** How engagements are numbered. */
  fileNumbering: { mode: 'manual' | 'auto'; pattern: string };
  nextFileNo: number;
}

export interface Branding {
  /** The firm's logo, as a small data URL. */
  logo?: string;
  /** Show the firm's logo faintly across the cover page. */
  watermark?: boolean;
  /** Show the firm's logo at the top of the auditor's report and the management letter. */
  logoOnReport?: boolean;
  font?: 'serif' | 'sans';
  /** Printed at the foot of every page, for example the firm's name, address and telephone. */
  footer?: string;
  /** Print a cover page and a contents page before the directors' report. */
  cover?: boolean;
  contents?: boolean;
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
  /** The client's logo, as a small data URL, shown on the cover of its financial statements. */
  logo?: string | null;
  logoPlacement?: 'left' | 'centre' | 'right';
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
  /** The firm's audit file number. */
  fileNo: string;
  /** The currency the financial statements are presented in. */
  currency: CurrencyCode;
  /** Paid for on its own, so it stays open whatever the firm's plan is doing. */
  payPer: boolean;
  /** The consolidation add-on has been paid for this engagement. */
  groupAddon: boolean;
}

export interface LogEntry {
  id: string;
  at: string;
  table: string;
  action: string;
  userId: string | null;
  detail: Record<string, unknown> | null;
}

import type { PlanMode } from '../engine/billing';
import type { AdminPartners, PartnerMe, PartnerProfile, PartnerProgramme } from '../engine/partners';
import type { CountryCode, CurrencyCode } from '../content/jurisdictions';

export type PlanCode = 'solo' | 'practice' | 'firm';

export interface PlanOffer {
  code: PlanCode;
  name: string;
  maxUsers: number | null;
  maxEngagements: number;
  /** The full price for a year, in kobo. */
  listKobo: number;
  /** What this firm would pay today, in kobo. */
  amountKobo: number;
  /** True when amountKobo is the founding firm price. */
  founding: boolean;
  /** Credit for the unused part of the current plan, already taken off amountKobo. */
  creditKobo: number;
  mode: PlanMode;
}

/** What a partner is paying for. */
export type Checkout =
  | { kind: 'plan'; plan: PlanCode; founding_agreed?: boolean }
  | { kind: 'engagement'; type?: EngagementType; engagement?: string; with_group?: boolean }
  | { kind: 'group'; engagement: string };

export interface Seller {
  name: string;
  address: string;
  taxId: string;
  supportEmail: string;
}

export interface PaymentRecord {
  id: string;
  kind: 'plan' | 'engagement' | 'group';
  plan: string | null;
  engagementType: string | null;
  withGroup: boolean;
  /** The total charged, VAT included. */
  amountKobo: number;
  /** The VAT inside amountKobo. */
  vatKobo: number;
  currency: BillingCurrency;
  /** When collected in another currency: the price in the firm's own currency, its tax, and the rate used. */
  quotedCurrency?: BillingCurrency | null;
  quotedKobo?: number | null;
  quotedVatKobo?: number | null;
  fxRate?: number | null;
  creditKobo: number;
  founding: boolean;
  source: 'flutterwave' | 'manual';
  paidAt: string;
  coversUntil: string | null;
  reference: string;
  receiptNo: number | null;
}

/** Where the firm stands: in its free trial, on a paid plan, or lapsed and read-only. */
export interface Billing {
  state: 'trial' | 'active' | 'expired' | 'suspended';
  suspendedReason: string;
  plan: 'trial' | PlanCode;
  planName: string;
  trialEndsAt: string;
  paidUntil: string | null;
  foundingNumber: number | null;
  priceLockUntil: string | null;
  foundingLeft: number;
  engagementsUsed: number;
  maxEngagements: number;
  users: number;
  maxUsers: number | null;
  foundingAgreedAt: string | null;
  foundingAgreedBy: string | null;
  plans: PlanOffer[];
  /** Prices for paying for one engagement at a time. 'group' is the consolidation add-on. */
  engagementPrices: { code: EngagementType | 'group'; name: string; priceKobo: number }[];
  /** Engagements paid for and not yet opened. */
  credits: { id: string; type: EngagementType; withGroup: boolean }[];
  openEngagements: { id: string; client: string; type: EngagementType; yearEnd: string; payPer: boolean; groupAddon: boolean }[];
  seller: Seller;
  /** Prices are stated before tax. This rate is added when a payment is started. */
  vatPercent: number;
  /** The firm's country, and the currency and tax it is charged in. */
  country: CountryCode;
  currency: BillingCurrency;
  /** The currency Flutterwave collects in, and how many of it make one unit of the price. Rate 1 when it is the price currency. */
  chargeCurrency: BillingCurrency;
  chargeRate: number;
  taxLabel: string;
  /** True until the firm has paid for anything. After that the platform owner changes the country. */
  canChangeCountry: boolean;
  payments: PaymentRecord[];
}

/** The currencies firms are charged in. Flutterwave collects naira and cedis locally, and US dollars elsewhere. */
export type BillingCurrency = 'NGN' | 'GHS' | 'USD' | 'ZAR';

/** The price list shown to visitors, for one country. Prices are before tax. */
export interface PublicPrices {
  country: CountryCode;
  currency: BillingCurrency;
  /** The currency Flutterwave collects in. */
  chargeCurrency: BillingCurrency;
  taxLabel: string;
  /** The countries a firm can sign up in. */
  countries: { code: CountryCode; name: string; currency: BillingCurrency }[];
  plans: { code: string; name: string; priceKobo: number; maxUsers: number | null; maxEngagements: number }[];
  engagementPrices: { code: string; name: string; priceKobo: number }[];
  vatPercent: number;
  foundingLeft: number;
  supportEmail: string;
}

/** What the platform owner's console shows. No client file data is in it. */
export interface AdminFirm {
  id: string; name: string; frc_number: string; address: string; created_at: string;
  state: Billing['state']; plan: string; trial_ends_at: string; paid_until: string | null;
  founding_number: number | null; founding_agreed_at: string | null; founding_agreed_by: string | null;
  suspended_reason: string; note: string; ai_enabled: boolean; country: CountryCode;
  engagements: number; signed: number; clients: number; credits: number; paid_kobo: number; last_activity: string | null;
  members: { name: string; role: string; email: string | null; joined: string }[];
}
export interface AdminData {
  founding_taken: number;
  revenue_kobo: number;
  revenue_month_kobo: number;
  vat_kobo: number;
  vat_month_kobo: number;
  firms: AdminFirm[];
  users: { id: string; email: string; created_at: string; confirmed: boolean; last_sign_in_at: string | null; firm: string | null; role: string | null; name: string | null; admin: boolean }[];
  revenue: { currency: BillingCurrency; total_kobo: number; month_kobo: number | null; vat_kobo: number; vat_month_kobo: number | null }[];
  countries: AdminCountry[];
  payments: { id: string; firm: string; firm_id: string; kind: string; currency: BillingCurrency; vat_kobo: number; quoted_currency?: BillingCurrency | null; quoted_kobo?: number | null; fx_rate?: number | null; plan: string | null; engagement_type: string | null; with_group: boolean; amount_kobo: number; credit_kobo: number; founding: boolean; status: string; source: string; note: string; tx_ref: string; provider_id: string | null; receipt_no: number | null; created_at: string; paid_at: string | null }[];
  plans: { code: string; name: string; price_kobo: number; max_users: number | null; max_engagements: number }[];
  engagement_prices: { code: string; name: string; price_kobo: number }[];
  settings: { seller_name: string; seller_address: string; tax_id: string; support_email: string; vat_percent: number };
  log: { at: string; action: string; detail: Record<string, unknown> | null; admin: string | null; firm: string | null }[];
}

/** A country as the platform owner manages it. Prices are in the minor unit of its currency. */
export interface AdminCountry {
  code: CountryCode; name: string; currency: BillingCurrency; vat_percent: number; tax_label: string;
  min_charge: number; enabled: boolean; firms: number;
  charge_currency: BillingCurrency; charge_rate: number | null; rate_set_at: string | null;
  plans: Record<string, number>; engagement_prices: Record<string, number>;
}

export interface Workspace {
  billing: Billing;
  firm: Firm;
  me: Member;
  members: Member[];
}

export interface NewFirm {
  country: CountryCode;
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
  /** The firm's details, so the person invited joins it without entering them. */
  country?: string;
  address?: string;
  firmLicence?: string;
  invitedBy?: string;
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

export type ImportLine = Pick<TbLine, 'code' | 'name' | 'balance' | 'prior' | 'prior2' | 'prior3' | 'prior4' | 'mapCode' | 'nature'>;

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
  /** Emails a link for choosing a new password. Says nothing about whether the address has an account. */
  requestPasswordReset(email: string): Promise<void>;
  /** True when the visitor arrived from a password reset link and must choose a new password. */
  recovering(): boolean;
  /** Sets a new password for the signed-in user, and ends the reset. */
  setPassword(password: string): Promise<void>;

  workspace(): Promise<Workspace | null>;
  createFirm(f: NewFirm): Promise<void>;
  updateFirm(patch: Pick<Firm, 'name' | 'frcNumber' | 'address'>): Promise<void>;
  updateMyProfile(patch: Pick<Member, 'fullName' | 'frcNumber'>): Promise<void>;

  /** Partners only. */
  listInvites(): Promise<Invite[]>;
  /** Records an invitation and returns its id. */
  createInvite(email: string, role: Role): Promise<string>;
  deleteInvite(id: string): Promise<void>;
  /** Emails the invitation. Returns what was sent, in words. */
  sendInvite(id: string): Promise<string>;
  setMemberRole(userId: string, role: Role): Promise<void>;
  removeMember(userId: string): Promise<void>;
  myInvites(): Promise<PendingInvite[]>;
  acceptInvite(id: string, fullName: string, frcNumber: string): Promise<void>;

  listClients(): Promise<Client[]>;
  createClient(c: Omit<Client, 'id'>): Promise<Client>;
  listEngagements(): Promise<Engagement[]>;
  createEngagement(e: { clientId: string; type: EngagementType; yearEnd: string; programmeVersion: string; fileNo?: string; currency?: CurrencyCode }): Promise<Engagement>;
  getEngagement(id: string): Promise<Engagement | null>;
  updateEngagement(id: string, patch: Partial<Pick<Engagement, 'planning' | 'programme' | 'report' | 'testing' | 'disclosures' | 'fileNo' | 'currency'>>): Promise<void>;
  /** Changes a client's details. */
  updateClient(id: string, patch: Partial<Omit<Client, 'id'>>): Promise<void>;
  /** Sets how the firm's reports look. Partners and managers. */
  setBranding(b: Branding): Promise<void>;
  /** Sets how new engagements are numbered. Partners only. */
  setFileNumbering(mode: 'manual' | 'auto', pattern: string, next: number): Promise<void>;

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

  /** Starts payment for a year of a plan. Partners only. Returns the checkout page to send the partner to, or a message when there is nowhere to go (demo mode). */
  startCheckout(checkout: Checkout): Promise<{ link?: string; message?: string }>;
  /** Checks a payment with the payment provider after the partner is sent back, and activates the plan if it was paid. */
  confirmPayment(transactionId: string): Promise<string>;

  /** The public price list, for the landing page. No sign-in needed. */
  /** The price list for one country. Nigeria when none is given. */
  publicPrices(country?: CountryCode): Promise<PublicPrices>;
  /** Moves the firm to another country, before it has paid for anything. Partners only. */
  setFirmCountry(country: CountryCode): Promise<void>;
  /** Where the signed-in user stands as an admin: not one, or one who has or has not passed the second factor. */
  adminStatus(): Promise<{ admin: boolean; verified: boolean; enrolled: boolean }>;
  /** Starts setting up an authenticator app. Returns a QR code (as an image source, when available) and the secret to type in. */
  mfaEnroll(): Promise<{ factorId: string; qr: string | null; secret: string }>;
  /** Checks a six-digit code from the authenticator app, which completes set-up or sign-in. */
  mfaVerify(factorId: string | null, code: string): Promise<void>;
  /** Whether the signed-in user has an authenticator, and whether this session has passed it. */
  mfaStatus(): Promise<{ enrolled: boolean; verified: boolean }>;
  /** Removes the user's own authenticator. Needs a session that has passed it. */
  mfaDisable(): Promise<void>;
  /** Makes ten new backup codes, shown once. Needs a session that has passed the second factor. */
  createBackupCodes(): Promise<string[]>;
  backupCodesLeft(): Promise<number>;
  /** Uses a backup code to remove a lost authenticator. Returns what happened, in words. */
  recoverWithBackupCode(code: string): Promise<string>;
  /** Clears another admin's authenticator so they can set up a new one. */
  adminResetTwoFactor(userId: string): Promise<void>;
  /** True when the signed-in user is a platform admin. */
  isAdmin(): Promise<boolean>;
  adminOverview(): Promise<AdminData>;

  /** The partner programme's terms. No sign-in needed. */
  partnerProgramme(): Promise<PartnerProgramme>;
  /** Counts a visit through a partner's link. Says only whether the code is live. No sign-in needed. */
  partnerClick(code: string, campaign: string, path: string, country: string): Promise<boolean>;
  /** The name behind a live code, so a firm knows it typed it right. Null when the code is not live. */
  partnerLookup(code: string): Promise<{ name: string } | null>;
  /** Credits the signed-in partner's new firm to the partner whose code brought it in. */
  claimReferral(code: string, campaign: string): Promise<{ name: string }>;
  /** Applies to the partner programme, or takes up a partner account the platform owner set up. */
  partnerApply(p: { name: string; company: string; phone: string; country: string; website: string; promotion: string; accept_terms: boolean }): Promise<void>;
  /** The signed-in partner's portal. Null when the account is not a partner. */
  partnerMe(): Promise<PartnerMe | null>;
  partnerUpdate(p: Partial<Pick<PartnerProfile, 'company' | 'phone' | 'website' | 'promotion' | 'payout_details'>>): Promise<void>;
  partnerRequestPayout(currency: string): Promise<void>;
  adminPartners(): Promise<AdminPartners>;
  adminPartnerAct(action: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  adminAct(action: string, args: Record<string, unknown>): Promise<void>;
  /** Flutterwave's rate today: how many of `charge` it takes to make one of `price`. Admins only. */
  adminFxRate(price: BillingCurrency, charge: BillingCurrency): Promise<number>;

  /** Turns AI assistance on or off for the firm. Partners only. */
  setAssist(enabled: boolean): Promise<void>;
  /** Asks the AI service where accounts belong. Balances in naira, debit positive. Nothing is saved. */
  suggestMappings(engagementId: string, accounts: { code: string; name: string; balance: number }[]): Promise<{ suggestions: MappingSuggestion[]; model: string }>;
  /** Asks the AI service to explain one flagged journal. Nothing is saved. */
  explainJournal(engagementId: string, journal: JournalForAssist, context: { yearEnd: string; performanceMateriality: number | null }): Promise<JournalExplanation & { model: string }>;

  /** Asks the AI service for causes to consider and questions to ask about one movement. Nothing is saved. */
  explainMovement(engagementId: string, input: MovementForAssist): Promise<MovementPoints & { model: string }>;

  /** Asks the AI service to tailor one accounting policy. Nothing is saved. */
  draftPolicy(engagementId: string, input: { title: string; starter: string; accounts: string[]; industry: string }): Promise<PolicyDraft & { model: string }>;

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

/** A suggestion from the AI service for where an account belongs. The accountant accepts or rejects it. */
export interface MappingSuggestion {
  code: string;
  line: string;
  nature: 'staff' | 'depreciation' | 'other' | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/** A plain-language reading of one flagged journal, written without sight of any evidence. */
export interface JournalExplanation {
  whatItDoes: string;
  whyFlagged: string[];
  tests: string[];
  questions: string[];
}

/** Points to help plan enquiries about a line that moved against last year. It does not say which cause is true. */
export interface MovementPoints {
  consistency: string;
  causes: string[];
  questions: string[];
  corroboration: string[];
}

export interface MovementForAssist {
  /** Amounts in naira. */
  movement: { label: string; section: string; cur: number; prior: number; change: number; percent: number | null };
  lines: { label: string; cur: number; prior: number }[];
  ratios: { label: string; cur: number | null; prior: number | null; unit: string }[];
  industry: string;
}

/** A draft of one accounting policy for this client, with the facts the accountant must confirm. */
export interface PolicyDraft {
  text: string;
  toConfirm: string[];
}

export interface JournalForAssist {
  entryNo: string;
  date: string;
  description: string;
  user: string;
  flags: string[];
  /** Amounts in naira, debit positive. */
  lines: { account: string; line: string; amount: number }[];
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
