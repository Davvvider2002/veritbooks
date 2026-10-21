/**
 * Channel partners: the shapes the database returns, and the rules both the database and the
 * demo store follow. A partner earns a share of what a referred firm pays, net of VAT, in the
 * currency it paid, for a set number of months. Each commission is held before it can be paid.
 *
 * Programme design follows common SaaS practice, checked October 2026: a 60 to 90 day
 * attribution window for B2B, commissions on paid billing events only, a hold of 30 to 60 days
 * for refunds and disputes, a low payout minimum, recurring commission capped at 12 to 24 months,
 * and self-referral checks. https://getreditus.com/resources/glossary/commission-hold-period
 * https://cello.so/?p=18295
 */

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type CommissionStatus = 'review' | 'pending' | 'requested' | 'paid' | 'void';
export type PayoutStatus = 'requested' | 'paid' | 'rejected';
export type PartnerCurrency = 'NGN' | 'GHS' | 'USD' | 'ZAR';

export interface PartnerProgramme {
  open: boolean;
  percent: number;
  months: number | null;
  /** The rate after the first period, and for how many further months (null: as long as the firm pays). 0: nothing after the first period. */
  later_percent?: number;
  later_months?: number | null;
  hold_days: number;
  cookie_days: number;
  min_payout: Record<string, number>;
  terms_version: string;
}

export interface PayoutDetails {
  method?: 'bank' | 'mobile';
  bank?: string;
  account_name?: string;
  account_number?: string;
  branch_code?: string;
  swift?: string;
  mobile_number?: string;
  tax_number?: string;
}

export interface PartnerProfile {
  id: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  country: string;
  website: string;
  promotion: string;
  code: string;
  status: PartnerStatus;
  commission_percent: number;
  commission_months: number | null;
  later_percent?: number;
  later_months?: number | null;
  payout_details: PayoutDetails;
  terms_version: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface Commission {
  id: string;
  partner_id?: string;
  firm_id?: string;
  firm: string;
  currency: string;
  base_kobo: number;
  percent: number;
  amount_kobo: number;
  status: CommissionStatus;
  created_at: string;
  available_at: string;
  payout_id: string | null;
  void_reason: string;
  kind: string;
  /** Earned in the first period from the referral, or in the years after it. */
  period?: 'first' | 'later';
}

export interface Payout {
  id: string;
  partner_id?: string;
  currency: string;
  amount_kobo: number;
  status: PayoutStatus;
  requested_at: string;
  requested_by?: 'partner' | 'admin';
  payout_details?: PayoutDetails;
  decided_at: string | null;
  reference: string;
  method: string;
  note: string;
}

export interface Balance {
  review: number;
  held: number;
  available: number;
  requested: number;
  paid: number;
}

export interface Referral {
  firm_id: string;
  firm: string;
  country: string;
  referred_at: string;
  campaign: string;
  state: string;
  review: boolean;
  earned: Record<string, number>;
}

export interface PartnerAsset {
  id: string;
  title: string;
  kind: 'copy' | 'link';
  body: string;
  url: string;
  created_at?: string;
}

/** What a signed-in partner sees. */
export type PartnerMe =
  | { invited: true; name: string; company: string; programme: PartnerProgramme }
  | {
      invited?: false;
      partner: PartnerProfile;
      programme: PartnerProgramme;
      clicks: { total: number; last30: number; campaigns: { campaign: string; clicks: number }[]; days: { day: string; clicks: number }[] };
      referrals: Referral[];
      commissions: Commission[];
      payouts: Payout[];
      balances: Record<string, Balance>;
      assets: PartnerAsset[];
    };

export interface AdminPartner extends PartnerProfile {
  admin_notes: string;
  has_account: boolean;
  created_by_admin: boolean;
  clicks: number;
  clicks30: number;
  referred: number;
  paying: number;
  balances: Record<string, Balance>;
}

export interface AdminPartners {
  settings: {
    open: boolean;
    default_percent: number;
    default_months: number | null;
    default_later_percent?: number;
    default_later_months?: number | null;
    hold_days: number;
    cookie_days: number;
    min_payout: Record<string, number>;
    terms_version: string;
    updated_at: string;
  };
  partners: AdminPartner[];
  referrals: { firm_id: string; firm: string; country: string; partner_id: string; referred_at: string; campaign: string; review: string | null; state: string }[];
  commissions: Commission[];
  payouts: Payout[];
  clicks: { partner_id: string; month: string; campaign: string; clicks: number }[];
  assets: PartnerAsset[];
}

export const PARTNER_CURRENCIES: PartnerCurrency[] = ['NGN', 'GHS', 'USD', 'ZAR'];

export const DEFAULT_PROGRAMME: PartnerProgramme = {
  open: true,
  percent: 20,
  months: 12,
  later_percent: 0,
  later_months: null,
  hold_days: 45,
  cookie_days: 90,
  min_payout: { NGN: 2_000_000, GHS: 20_000, USD: 2_000, ZAR: 30_000 },
  terms_version: '2026-10',
};

/** A code: 4 to 20 capital letters and numbers. */
export const normaliseCode = (s: string) => s.trim().toUpperCase();
export const validCode = (s: string) => /^[A-Z0-9]{4,20}$/.test(normaliseCode(s));

/** A code from the first name, such as THANDI27. */
export function newCode(name: string, taken: (code: string) => boolean, random = Math.random): string {
  let stem = (name.trim().split(/\s+/)[0] ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  if (stem.length < 3) stem = 'VB' + stem;
  for (;;) {
    const code = stem + (10 + Math.floor(random() * 990));
    if (!taken(code)) return code;
  }
}

/** A campaign tag as stored: lower case, letters, numbers and dashes, up to 40 characters. */
export const campaignTag = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** The partner's link, optionally tagged with a campaign and opening on a country's prices. */
export function referralLink(code: string, opts: { campaign?: string; country?: string; base?: string } = {}): string {
  const u = new URL(opts.base ?? 'https://veritbooks.com/');
  u.searchParams.set('ref', normaliseCode(code));
  const c = campaignTag(opts.campaign ?? '');
  if (c) u.searchParams.set('c', c);
  if (opts.country) u.searchParams.set('country', opts.country);
  return u.toString();
}

/** What a commission is worth: the share of the payment net of VAT, rounded down to the minor unit. */
export const commissionOn = (baseKobo: number, percent: number) => Math.floor((baseKobo * percent) / 100);

/** Whether a payment falls inside the commission period that starts at the referral. */
export function withinPeriod(referredAt: string, paidAt: string, months: number | null): boolean {
  if (months === null) return true;
  const end = new Date(referredAt);
  end.setUTCMonth(end.getUTCMonth() + months);
  return new Date(paidAt) <= end;
}

export interface CommissionTerms {
  commission_percent: number;
  commission_months: number | null;
  later_percent?: number;
  later_months?: number | null;
}

/**
 * The rate a payment earns, and in which period, or null when it earns nothing. The first period
 * earns the partner's rate; after it, the later rate for as many further months as set (none set:
 * for as long as the firm pays). A later rate of 0 means nothing after the first period.
 */
export function rateFor(referredAt: string, paidAt: string, t: CommissionTerms): { percent: number; period: 'first' | 'later' } | null {
  if (t.commission_months === null || withinPeriod(referredAt, paidAt, t.commission_months)) return { percent: Number(t.commission_percent), period: 'first' };
  const later = Number(t.later_percent ?? 0);
  if (later <= 0) return null;
  if (t.later_months != null) {
    const end = new Date(referredAt);
    end.setUTCMonth(end.getUTCMonth() + t.commission_months + t.later_months);
    if (new Date(paidAt) > end) return null;
  }
  return { percent: later, period: 'later' };
}

/** The terms in words, for the partner and the admin. */
export function termsText(t: CommissionTerms): string {
  const first = `${Number(t.commission_percent)}% ${t.commission_months === null ? 'for as long as each firm pays' : `for the first ${t.commission_months} months`}`;
  if (t.commission_months === null || !Number(t.later_percent ?? 0)) return t.commission_months === null ? first : `${first}, then nothing`;
  return `${first}, then ${Number(t.later_percent)}% ${t.later_months == null ? 'for as long as the firm pays' : `for the next ${t.later_months} months`}`;
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

/** Balances by currency, as the database works them out. */
export function balancesOf(commissions: Pick<Commission, 'currency' | 'status' | 'amount_kobo' | 'available_at'>[], now = new Date()): Record<string, Balance> {
  const out: Record<string, Balance> = {};
  for (const c of commissions) {
    const b = (out[c.currency] ??= { review: 0, held: 0, available: 0, requested: 0, paid: 0 });
    if (c.status === 'review') b.review += c.amount_kobo;
    else if (c.status === 'pending') {
      if (new Date(c.available_at) > now) b.held += c.amount_kobo;
      else b.available += c.amount_kobo;
    } else if (c.status === 'requested') b.requested += c.amount_kobo;
    else if (c.status === 'paid') b.paid += c.amount_kobo;
  }
  return out;
}

/** A commission's state in words, for the partner and the platform owner. */
export function commissionState(c: Pick<Commission, 'status' | 'available_at'>, now = new Date()): string {
  switch (c.status) {
    case 'review':
      return 'Awaiting review';
    case 'pending':
      return new Date(c.available_at) > now ? 'Held' : 'Available';
    case 'requested':
      return 'In a payout';
    case 'paid':
      return 'Paid';
    case 'void':
      return 'Void';
  }
}

export const FIRM_STATE: Record<string, string> = { trial: 'On trial', active: 'Paying', expired: 'Lapsed', suspended: 'Suspended' };

/** Domains anyone can sign up with. A referral on any other domain shared with the partner is held for review. */
export const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com',
  'aol.com', 'proton.me', 'protonmail.com', 'mweb.co.za', 'webmail.co.za', 'ymail.com',
]);
export function sameCompanyDomain(a: string, b: string): boolean {
  const da = a.toLowerCase().split('@')[1] ?? '';
  const db = b.toLowerCase().split('@')[1] ?? '';
  return !!da && da === db && !FREE_MAIL.has(da);
}

/* ------------------------------------------------------------------------------------------------
 * Reports
 * ---------------------------------------------------------------------------------------------- */

export interface ReportRow {
  month: string;
  partnerId: string;
  partner: string;
  code: string;
  currency: string;
  clicks: number;
  referrals: number;
  sales: number; // what referred firms paid, net of VAT
  commission: number;
  paid: number;
}

/** One row per partner, month and currency: clicks, new referrals, sales, commission earned and payouts made. */
export function monthlyReport(d: Pick<AdminPartners, 'partners' | 'referrals' | 'commissions' | 'payouts' | 'clicks'>): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  const name = new Map(d.partners.map((p) => [p.id, p]));
  const row = (month: string, partnerId: string, currency: string) => {
    const k = `${month}|${partnerId}|${currency}`;
    let r = rows.get(k);
    if (!r) {
      const p = name.get(partnerId);
      r = { month, partnerId, partner: p ? p.company || p.name : 'Unknown', code: p?.code ?? '', currency, clicks: 0, referrals: 0, sales: 0, commission: 0, paid: 0 };
      rows.set(k, r);
    }
    return r;
  };
  const month = (iso: string) => iso.slice(0, 7);
  for (const k of d.clicks) row(k.month, k.partner_id, '').clicks += k.clicks;
  for (const f of d.referrals) if (f.referred_at) row(month(f.referred_at), f.partner_id, '').referrals += 1;
  for (const c of d.commissions) {
    if (c.status === 'void' || !c.partner_id) continue;
    const r = row(month(c.created_at), c.partner_id, c.currency);
    r.sales += c.base_kobo;
    r.commission += c.amount_kobo;
  }
  for (const o of d.payouts) if (o.status === 'paid' && o.partner_id && o.decided_at) row(month(o.decided_at), o.partner_id, o.currency).paid += o.amount_kobo;
  return [...rows.values()].sort((a, b) => b.month.localeCompare(a.month) || a.partner.localeCompare(b.partner) || a.currency.localeCompare(b.currency));
}

/** A CSV file from rows of cells. Cells holding a comma, quote or line break are quoted. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // A leading = + - @ would run as a formula when opened in a spreadsheet.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------------------------------------
 * Ready-made messages for partners to share
 * ---------------------------------------------------------------------------------------------- */

export interface ShareMessage {
  channel: string;
  subject?: string;
  text: string;
}

/** Messages with the partner's link and code in them, ready to copy. */
export function shareMessages(p: { name: string; code: string }, link: (campaign: string) => string): ShareMessage[] {
  return [
    {
      channel: 'Email',
      subject: 'A faster way to run audits, reviews and compilations',
      text: `Hello,\n\nI wanted to share VeritBooks with you. It takes a client's trial balance, ledger and bank statements and carries an audit, independent review or compilation through to signed IFRS for SMEs financial statements and the report, in one file.\n\nEvery firm starts with a 14-day free trial. Sign up here: ${link('email')}\nOr enter my referral code ${p.code} when you set up your firm.\n\nKind regards,\n${p.name}`,
    },
    {
      channel: 'WhatsApp',
      text: `Have you tried VeritBooks? Trial balance in, signed IFRS for SMEs statements and audit report out, with the workpapers in between. 14-day free trial: ${link('whatsapp')} (referral code ${p.code})`,
    },
    {
      channel: 'LinkedIn',
      text: `Audit season is easier when the statements build themselves from the trial balance. VeritBooks takes a firm from import to signed IFRS for SMEs financial statements and the auditor's report, with journal testing, bank reconciliation and disclosures in one file. Free 14-day trial: ${link('linkedin')}`,
    },
    {
      channel: 'X',
      text: `From trial balance to signed IFRS for SMEs statements in one file. VeritBooks, for audit and accounting firms. 14-day free trial: ${link('x')}`,
    },
  ];
}
