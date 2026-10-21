import type { GlEntry } from '../engine/ledger';
import { chargeOf, COUNTRY_PRICING, DEFAULT_VAT_PERCENT, ENGAGEMENT_PRICES, FOUNDING_PLACES, PLANS, PRICE_HOLD_YEARS, TRIAL_DAYS, addYears, firmState, planQuote, vatOn, vatWithin, type CountryPricing, type Plan, type Subscription } from '../engine/billing';
import { checkCode, newSecret } from '../totp';
import { jurisdictionOf, type CountryCode } from '../content/jurisdictions';
import { suggestMapping } from '../engine/mapping';
import type { Adjustment, Nature, TbLine } from '../engine/types';
import {
  LockedError,
  newToken,
  opensAtPage,
  type BankAccount,
  type ClientRequest,
  type PortalView,
  type RequestLink,
  type QualityEvaluation,
  type QualityItem,
  type Client,
  type Engagement,
  type Evidence,
  type Invite,
  type AdminData,
  type Billing,
  type Firm,
  type PaymentRecord,
  type PlanCode,
  type LogEntry,
  type Member,
  type Repo,
  type StoredBankLine,
  type User,
  type Amendment,
} from './repo';

/**
 * Demo mode: everything is kept in this browser only. It exists so the product can be tried
 * before Supabase is connected. It applies the same lock and sign-off rules as the database,
 * but it is not a secure store and must not hold real client data.
 */
type DemoSub = Subscription & {
  payments: PaymentRecord[];
  yearStart: string | null;
  credits?: { id: string; type: 'audit' | 'review' | 'compilation'; withGroup: boolean }[];
  suspendedAt?: string | null;
  suspendedReason?: string;
  note?: string;
  foundingAgreedAt?: string | null;
  foundingAgreedBy?: string | null;
  createdAt?: string;
};
/** What the platform owner controls. In demo mode, admin@veritbooks.demo is the owner. */
interface Platform {
  plans: Plan[];
  prices: { code: 'compilation' | 'review' | 'audit' | 'group'; name: string; priceKobo: number }[];
  settings: { seller_name: string; seller_address: string; tax_id: string; support_email: string; vat_percent?: number };
  admins: string[];
  /** Each admin's authenticator secret, by email, once set up. */
  mfa?: Record<string, { secret: string; verified: boolean; backup?: string[] }>;
  log: AdminData['log'];
  receipt: number;
  /** Each country's prices and tax. Added after the first stores were saved, so it may be missing. */
  countries?: CountryPricing[];
}
export const DEMO_ADMIN = 'admin@veritbooks.demo';

/** The partner programme in demo mode. */
interface DemoPartners {
  settings: AdminPartners['settings'];
  partners: (PartnerProfile & { user_id: string | null; admin_notes: string; created_by_admin: boolean })[];
  clicks: { partner_id: string; at: string; campaign: string; path: string; country: string }[];
  commissions: (Commission & { partner_id: string; firm_id: string; payment_id: string })[];
  payouts: (Payout & { partner_id: string })[];
  assets: PartnerAsset[];
  /** Firm id -> its referral. */
  referrals: Record<string, { partner_id: string; referred_at: string; campaign: string; review: string | null }>;
}

interface Store {
  partnerProgramme?: DemoPartners;
  user: User | null;
  accounts: Record<string, { id: string; password: string }>;
  firms: Record<string, { firm: Firm; members: Member[]; sub?: DemoSub }>; // keyed by firm id
  platform?: Platform;
  memberOf: Record<string, string>; // user id -> firm id
  clients: (Client & { firmId: string })[];
  engagements: (Engagement & { firmId: string })[];
  lines: Record<string, TbLine[]>;
  adjustments: Record<string, Adjustment[]>;
  maps: Record<string, Record<string, { mapCode: string; nature: Nature | null }>>;
  log: Record<string, LogEntry[]>;
  ledger: Record<string, GlEntry[]>;
  priorLedger: Record<string, GlEntry[]>;
  bankAccounts: Record<string, BankAccount[]>;
  bankLines: Record<string, StoredBankLine[]>;
  invites: (Invite & { firmId: string })[];
  evidence: Record<string, Evidence[]>;
  requests: Record<string, ClientRequest[]>;
  links: Record<string, (RequestLink & { token: string })[]>;
  quality: (QualityItem & { firmId: string })[];
  evaluations: (QualityEvaluation & { firmId: string })[];
}

const KEY = 'veritbooks.demo.v1';
const empty = (): Store => ({
  user: null,
  accounts: {},
  firms: {},
  memberOf: {},
  clients: [],
  engagements: [],
  lines: {},
  adjustments: {},
  maps: {},
  log: {},
  ledger: {},
  priorLedger: {},
  bankAccounts: {},
  bankLines: {},
  invites: [],
  evidence: {},
  requests: {},
  links: {},
  quality: [],
  evaluations: [],
});

let memory: Store | null = null;
function load(): Store {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    memory = empty();
  }
  return memory!;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Storage unavailable: the session continues in memory only.
  }
}
import {
  DEFAULT_PROGRAMME,
  addDays,
  balancesOf,
  commissionOn,
  newCode,
  normaliseCode,
  sameCompanyDomain,
  rateFor,
  type AdminPartners,
  type Commission,
  type PartnerAsset,
  type PartnerProfile,
  type Payout,
} from '../engine/partners';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// File contents are held in memory for this visit only. Demo mode does not keep them.
const blobs = new Map<string, string>();

export function createDemoRepo(): Repo {
  const listeners = new Set<() => void>();
  const s = load();
  const me = () => {
    if (!s.user) throw new Error('Sign in first.');
    return s.user;
  };
  const firmId = () => {
    const id = s.memberOf[me().id];
    if (!id) throw new Error('Set up your firm first.');
    return id;
  };
  const platform = (): Platform =>
    (s.platform ??= {
      plans: PLANS.map((p) => ({ ...p })),
      prices: ENGAGEMENT_PRICES.map((p) => ({ ...p })),
      settings: { seller_name: 'VeritBooks', seller_address: '', tax_id: '', support_email: '' },
      admins: [],
      log: [],
      receipt: 1000,
    });
  const vatRate = () => platform().settings.vat_percent ?? DEFAULT_VAT_PERCENT;
  /** The country price lists. A store saved before countries existed keeps its Nigerian prices. */
  const countries = (): CountryPricing[] => {
    const pl = platform();
    if (!pl.countries) {
      pl.countries = COUNTRY_PRICING.map((c) => ({ ...c, plans: { ...c.plans }, engagements: { ...c.engagements } }));
      const ng = pl.countries[0];
      ng.vatPercent = vatRate();
      for (const x of pl.plans) if (x.code !== 'trial') ng.plans[x.code] = x.priceKobo;
      for (const x of pl.prices) ng.engagements[x.code] = x.priceKobo;
    }
    // Countries added since this browser's store was made.
    for (const c of COUNTRY_PRICING) if (!pl.countries.some((x) => x.code === c.code)) pl.countries.push({ ...c, plans: { ...c.plans }, engagements: { ...c.engagements } });
    return pl.countries;
  };
  const countryBy = (code: string | undefined): CountryPricing => countries().find((c) => c.code === (code ?? 'NG')) ?? countries()[0];
  const countryOfFirm = (id: string): CountryPricing => countryBy(s.firms[id]?.firm.country);
  const countryOfSub = (sub: DemoSub): CountryPricing => countryBy(Object.values(s.firms).find((f) => f.sub === sub)?.firm.country);
  /** The plans with this country's prices. */
  const plansFor = (c: CountryPricing): Plan[] => platform().plans.map((p) => ({ ...p, priceKobo: p.code === 'trial' ? 0 : c.plans[p.code] }));
  const enginePrices = (c: CountryPricing) => platform().prices.map((p) => ({ code: p.code, name: p.name, priceKobo: c.engagements[p.code] }));
  const planBy = (code: string): Plan => platform().plans.find((p) => p.code === code) ?? platform().plans[0];
  /** The firm's trial and plan. Firms saved before plans existed start their trial now. */
  const subOf = (id: string): DemoSub =>
    (s.firms[id].sub ??= { trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(), plan: 'trial', paidUntil: null, foundingNumber: null, priceLockUntil: null, lockedPrices: null, hasPaid: false, payments: [], yearStart: null, createdAt: new Date().toISOString() });
  const stateOf = (id: string): Billing['state'] => (subOf(id).suspendedAt ? 'suspended' : firmState(subOf(id), new Date()));
  const limitsOf = (id: string): Plan => (stateOf(id) === 'active' ? planBy(subOf(id).plan) : planBy('trial'));
  const foundingTaken = () => Object.values(s.firms).filter((f) => f.sub?.foundingNumber != null).length;
  const nextFounding = () => {
    const taken = new Set(Object.values(s.firms).map((f) => f.sub?.foundingNumber));
    for (let n = 1; n <= FOUNDING_PLACES; n++) if (!taken.has(n)) return n;
    return null;
  };
  const SUSPENDED = "This firm's account is suspended, so nothing can be changed. Please contact VeritBooks support.";
  const requireOpen = (payPer = false) => {
    const state = stateOf(firmId());
    if (state === 'suspended') throw new Error(SUSPENDED);
    if (state === 'expired' && !payPer)
      throw new Error("Your firm's plan is not active, so the file is read-only. A partner can choose a plan, or pay for this one engagement, under Billing.");
  };
  const used = (id: string) => {
    const sub = subOf(id);
    const since = stateOf(id) === 'active' ? (sub.yearStart ?? '') : '';
    return s.engagements.filter((e) => e.firmId === id && !(e as { payPer?: boolean }).payPer && ((e as { createdAt?: string }).createdAt ?? '9') >= since).length;
  };
  const planPayments = (sub: DemoSub) => sub.payments.filter((p) => p.kind === 'plan' && p.coversUntil).map((p) => ({ valueKobo: p.amountKobo - p.vatKobo + p.creditKobo, coversUntil: p.coversUntil! }));
  const billingOf = (id: string): Billing => {
    const sub = subOf(id);
    const now = new Date();
    const plan = limitsOf(id);
    const pl = platform();
    const c = countryOfFirm(id);
    const plans = plansFor(c);
    return {
      state: stateOf(id),
      country: c.code,
      currency: c.currency,
      taxLabel: c.taxLabel,
      chargeCurrency: chargeOf(c).currency,
      chargeRate: chargeOf(c).rate,
      canChangeCountry: !sub.payments.length && !(sub.credits ?? []).length,
      suspendedReason: sub.suspendedReason ?? '',
      plan: plan.code,
      planName: plan.name,
      trialEndsAt: sub.trialEndsAt,
      paidUntil: sub.paidUntil,
      foundingNumber: sub.foundingNumber,
      priceLockUntil: sub.priceLockUntil,
      foundingAgreedAt: sub.foundingAgreedAt ?? null,
      foundingAgreedBy: sub.foundingAgreedBy ?? null,
      foundingLeft: Math.max(FOUNDING_PLACES - foundingTaken(), 0),
      engagementsUsed: used(id),
      maxEngagements: plan.maxEngagements,
      users: s.firms[id].members.length,
      maxUsers: plan.maxUsers,
      plans: plans.filter((p) => p.code !== 'trial').map((p) => ({ code: p.code as PlanCode, name: p.name, maxUsers: p.maxUsers, maxEngagements: p.maxEngagements, ...planQuote(sub, p, plans, foundingTaken(), planPayments(sub), now, c.minCharge) })),
      engagementPrices: enginePrices(c),
      credits: sub.credits ?? [],
      openEngagements: s.engagements
        .filter((e) => e.firmId === id && e.status === 'in_progress')
        .map((e) => ({ id: e.id, client: s.clients.find((c) => c.id === e.clientId)?.name ?? '', type: e.type, yearEnd: e.yearEnd, payPer: !!(e as any).payPer, groupAddon: !!(e as any).groupAddon })),
      vatPercent: c.vatPercent,
      seller: { name: pl.settings.seller_name, address: pl.settings.seller_address, taxId: pl.settings.tax_id, supportEmail: pl.settings.support_email },
      payments: [...sub.payments].reverse(),
    };
  };
  /** The next automatic file number, or blank when numbering is by hand. */
  const nextFileNo = (yearEnd: string): string => {
    const f = s.firms[firmId()].firm;
    if (f.fileNumbering?.mode !== 'auto') return '';
    for (;;) {
      const n = f.nextFileNo ?? 1;
      f.nextFileNo = n + 1;
      const no = f.fileNumbering.pattern.replace('{YYYY}', yearEnd.slice(0, 4)).replace('{YY}', yearEnd.slice(2, 4)).replace('{N}', String(n).padStart(3, '0'));
      if (!s.engagements.some((x) => x.firmId === firmId() && (x as any).fileNo?.toLowerCase() === no.toLowerCase())) return no;
    }
  };
  // In demo mode the second factor lasts as long as this browser tab's sign-in.
  const MFA_KEY = 'veritbooks.demo.aal2';
  const verifiedNow = () => !!s.user && sessionStorage.getItem(MFA_KEY) === s.user.email;
  const isAdminAccount = () => !!s.user && (s.user.email === DEMO_ADMIN || platform().admins.includes(s.user.email));
  const isAdminUser = () => isAdminAccount() && verifiedNow();

  /** Records a payment. The amount given is before VAT, unless it was received another way, when it includes VAT. */
  const receipt = (sub: DemoSub, p: Omit<PaymentRecord, 'id' | 'paidAt' | 'reference' | 'receiptNo' | 'source' | 'vatKobo' | 'currency'> & { source?: PaymentRecord['source']; reference?: string }) => {
    const c = countryOfSub(sub);
    const ch = chargeOf(c);
    const converted = ch.currency !== c.currency;
    // A recorded transfer is what was received, in the collected currency, tax included. A checkout amount is the price before tax.
    const gross = p.source === 'manual' ? (converted ? Math.round(p.amountKobo / ch.rate) : p.amountKobo) : p.amountKobo + vatOn(p.amountKobo, c.vatPercent);
    const vat = p.source === 'manual' ? vatWithin(gross, c.vatPercent) : vatOn(p.amountKobo, c.vatPercent);
    const amountKobo = p.source === 'manual' ? p.amountKobo : converted ? Math.round((gross - vat) * ch.rate) + Math.round(vat * ch.rate) : gross;
    const vatKobo = converted ? Math.round(vat * ch.rate) : vat;
    sub.payments.push({
      id: uid(), paidAt: new Date().toISOString(), reference: 'demo-' + uid().slice(0, 8), source: 'flutterwave', ...p,
      vatKobo, currency: ch.currency, amountKobo, receiptNo: ++platform().receipt,
      ...(converted ? { quotedCurrency: c.currency, quotedKobo: gross, quotedVatKobo: vat, fxRate: ch.rate } : {}),
    });
    accrue(sub, sub.payments[sub.payments.length - 1]);
  };
  /** A payment by a referred firm earns its partner a commission, as the database's trigger does. */
  const accrue = (sub: DemoSub, pay: PaymentRecord) => {
    const firm = Object.entries(s.firms).find(([, f]) => f.sub === sub)?.[0];
    const pp = programme();
    const ref = firm ? pp.referrals[firm] : undefined;
    if (!firm || !ref) return;
    const p = pp.partners.find((x) => x.id === ref.partner_id);
    if (!p || p.status !== 'active') return;
    const rate = rateFor(ref.referred_at, pay.paidAt, p);
    if (!rate) return;
    const base = pay.amountKobo - pay.vatKobo;
    if (base <= 0) return;
    pp.commissions.push({
      id: uid(), partner_id: p.id, firm_id: firm, payment_id: pay.id, firm: s.firms[firm].firm.name, currency: pay.currency ?? 'NGN', base_kobo: base,
      percent: rate.percent, amount_kobo: commissionOn(base, rate.percent), status: ref.review ? 'review' : 'pending',
      created_at: pay.paidAt, available_at: addDays(pay.paidAt, pp.settings.hold_days), payout_id: null, void_reason: '', kind: pay.kind, period: rate.period,
    });
  };
  const programme = (): DemoPartners =>
    (s.partnerProgramme ??= {
      settings: {
        open: DEFAULT_PROGRAMME.open, default_percent: DEFAULT_PROGRAMME.percent, default_months: DEFAULT_PROGRAMME.months, default_later_percent: 0, default_later_months: null, hold_days: DEFAULT_PROGRAMME.hold_days,
        cookie_days: DEFAULT_PROGRAMME.cookie_days, min_payout: { ...DEFAULT_PROGRAMME.min_payout }, terms_version: DEFAULT_PROGRAMME.terms_version, updated_at: new Date().toISOString(),
      },
      partners: [], clicks: [], commissions: [], payouts: [], assets: [], referrals: {},
    });
  const publicProgramme = () => {
    const x = programme().settings;
    return { open: x.open, percent: x.default_percent, months: x.default_months, later_percent: x.default_later_percent ?? 0, later_months: x.default_later_months ?? null, hold_days: x.hold_days, cookie_days: x.cookie_days, min_payout: x.min_payout, terms_version: x.terms_version };
  };
  const liveCode = (code: string) => programme().partners.find((p) => p.code === normaliseCode(code) && p.status === 'active');
  const shownName = (p: { company: string; name: string }) => p.company || p.name;
  const makePayout = (partnerId: string, currency: string, by: 'partner' | 'admin') => {
    const pp = programme();
    const p = pp.partners.find((x) => x.id === partnerId);
    if (!p || p.status !== 'active') throw new Error('Payouts are open only to active partners.');
    const now = new Date();
    const due = pp.commissions.filter((c) => c.partner_id === partnerId && c.currency === currency && c.status === 'pending' && new Date(c.available_at) <= now);
    const total = due.reduce((a, c) => a + c.amount_kobo, 0);
    if (total <= 0) throw new Error(`Nothing is available to pay out in ${currency}.`);
    if (!p.payout_details.account_number && !p.payout_details.mobile_number) throw new Error('Add payout details first.');
    const min = pp.settings.min_payout[currency] ?? 0;
    if (by === 'partner' && total < min) throw new Error(`The least that can be paid out in ${currency} is ${(min / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
    const o: Payout & { partner_id: string } = { id: uid(), partner_id: partnerId, currency, amount_kobo: total, status: 'requested', requested_at: now.toISOString(), requested_by: by, payout_details: { ...p.payout_details }, decided_at: null, reference: '', method: '', note: '' };
    pp.payouts.push(o);
    for (const c of due) Object.assign(c, { status: 'requested', payout_id: o.id });
    return o.id;
  };
  const makeFounding = (sub: DemoSub) => {
    const now = new Date();
    sub.foundingNumber = nextFounding();
    sub.priceLockUntil = addYears(now, PRICE_HOLD_YEARS);
    sub.lockedPrices = { ...countryOfSub(sub).plans };
  };
  /** Puts a plan payment into effect. */
  const payPlan = (sub: DemoSub, code: PlanCode, amountKobo: number, opts: { creditKobo?: number; restart?: boolean; founding?: boolean; source?: PaymentRecord['source']; reference?: string } = {}) => {
    const now = new Date();
    const active = !!sub.paidUntil && new Date(sub.paidUntil) > now;
    if (opts.restart) for (const p of sub.payments) if (p.kind === 'plan' && p.coversUntil && new Date(p.coversUntil) > now) p.coversUntil = now.toISOString();
    if (!active || opts.restart) sub.yearStart = now.toISOString();
    sub.plan = code;
    sub.paidUntil = addYears(active && !opts.restart ? new Date(sub.paidUntil!) : now, 1);
    sub.hasPaid = true;
    receipt(sub, { kind: 'plan', plan: code, engagementType: null, withGroup: false, amountKobo, creditKobo: opts.creditKobo ?? 0, founding: !!opts.founding, coversUntil: sub.paidUntil, source: opts.source, ...(opts.reference ? { reference: opts.reference } : {}) });
  };
  const eng = (id: string) => {
    const e = s.engagements.find((x) => x.id === id && x.firmId === firmId());
    if (!e) throw new Error('Engagement not found.');
    return e;
  };
  const open = (id: string) => {
    const e = eng(id);
    if (e.status === 'locked') throw new LockedError();
    requireOpen(!!(e as any).payPer);
    return e;
  };
  const log = (engagementId: string, table: string, action: string, detail: Record<string, unknown> | null = null) => {
    (s.log[engagementId] ??= []).push({
      id: uid(),
      at: new Date().toISOString(),
      table,
      action,
      userId: s.user?.id ?? null,
      detail,
    });
  };
  const partner = () => {
    const m = s.firms[firmId()].members.find((x) => x.userId === me().id);
    if (m?.role !== 'partner') throw new Error('Only a partner can change the firm’s quality records.');
    return m;
  };
  const strip = <T extends { firmId: string }>(x: T) => {
    const { firmId: _f, ...rest } = x;
    return rest as Omit<T, 'firmId'>;
  };

  return {
    mode: 'demo',
    async currentUser() {
      return s.user;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn(email, password) {
      // The demo has one built-in platform owner, so the admin console can be tried.
      if (email.toLowerCase() === DEMO_ADMIN && !s.accounts[DEMO_ADMIN] && password.length >= 8) s.accounts[DEMO_ADMIN] = { id: uid(), password };
      const a = s.accounts[email.toLowerCase()];
      if (!a || a.password !== password) throw new Error('Email or password is incorrect.');
      s.user = { id: a.id, email: email.toLowerCase() };
      save();
      listeners.forEach((l) => l());
    },
    async signUp(email, password) {
      const key = email.toLowerCase();
      if (s.accounts[key]) throw new Error('An account with this email already exists.');
      if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
      s.accounts[key] = { id: uid(), password, createdAt: new Date().toISOString() } as { id: string; password: string };
      s.user = { id: s.accounts[key].id, email: key };
      save();
      listeners.forEach((l) => l());
      return false;
    },
    // The demo cannot send email, so the reset link is skipped: the account is opened to choose a new password.
    async requestPasswordReset(email) {
      const a = s.accounts[email.trim().toLowerCase()];
      if (!a) return;
      s.user = { id: a.id, email: email.trim().toLowerCase() };
      sessionStorage.setItem('veritbooks.demo.recovering', '1');
      save();
      listeners.forEach((l) => l());
    },
    recovering() {
      return sessionStorage.getItem('veritbooks.demo.recovering') === '1';
    },
    async setPassword(password) {
      if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
      s.accounts[me().email].password = password;
      sessionStorage.removeItem('veritbooks.demo.recovering');
      save();
    },
    async signOut() {
      sessionStorage.removeItem('veritbooks.demo.recovering');
      sessionStorage.removeItem('veritbooks.demo.aal2');
      s.user = null;
      save();
      listeners.forEach((l) => l());
    },

    async workspace() {
      if (!s.user) return null;
      const f = s.firms[s.memberOf[s.user.id]];
      if (!f) return null;
      f.firm.branding ??= {};
      f.firm.fileNumbering ??= { mode: 'manual', pattern: '' };
      f.firm.nextFileNo ??= 1;
      f.firm.country ??= 'NG';
      return { billing: billingOf(s.memberOf[s.user.id]), firm: f.firm, members: f.members, me: f.members.find((m) => m.userId === s.user!.id)! };
    },
    async createFirm(f) {
      if (s.memberOf[me().id]) throw new Error('You already belong to a firm.');
      const invited = s.invites.find((i) => !i.accepted && i.email === me().email);
      if (invited) throw new Error(`You have been invited to join ${s.firms[invited.firmId]?.firm.name ?? 'a firm'}. Accept that invitation instead of setting up a new firm.`);
      const countryForNew = (code: string) => {
        if (!countries().some((c) => c.code === code && c.enabled)) throw new Error('Choose the country where your firm practises.');
        return code as CountryCode;
      };
      const id = uid();
      s.firms[id] = {
        firm: { id, name: f.name.trim(), frcNumber: f.frcNumber.trim(), address: f.address.trim(), country: countryForNew(f.country), aiEnabled: false, branding: {}, fileNumbering: { mode: 'manual', pattern: '' }, nextFileNo: 1 },
        members: [{ userId: me().id, role: 'partner', fullName: f.fullName.trim(), frcNumber: f.memberFrc.trim() }],
      };
      s.memberOf[me().id] = id;
      save();
    },
    async updateFirm(patch) {
      const f = s.firms[firmId()];
      if (f.members.find((m) => m.userId === me().id)?.role !== 'partner')
        throw new Error('Only a partner can change firm details.');
      Object.assign(f.firm, patch);
      save();
    },
    async updateMyProfile(patch) {
      const m = s.firms[firmId()].members.find((x) => x.userId === me().id)!;
      Object.assign(m, patch);
      save();
    },

    async listInvites() {
      return s.invites.filter((i) => i.firmId === firmId()).map(({ firmId: _f, ...i }) => i);
    },
    async createInvite(email, role) {
      const f = s.firms[firmId()];
      if (f.members.find((m) => m.userId === me().id)?.role !== 'partner') throw new Error('Only a partner can invite.');
      const e = email.trim().toLowerCase();
      if (s.invites.some((i) => i.firmId === firmId() && i.email === e)) throw new Error('This email has already been invited.');
      const id = uid();
      s.invites.push({ id, firmId: firmId(), email: e, role, accepted: false });
      save();
      return id;
    },
    async sendInvite(id) {
      const i = s.invites.find((x) => x.id === id);
      return `Demo mode: no email is sent. In the live app, ${i?.email ?? 'your colleague'} gets an email with a link to join.`;
    },
    async deleteInvite(id) {
      s.invites = s.invites.filter((i) => !(i.id === id && i.firmId === firmId()));
      save();
    },
    async setMemberRole(userId, role) {
      const f = s.firms[firmId()];
      if (f.members.find((m) => m.userId === me().id)?.role !== 'partner') throw new Error('Only a partner can change roles.');
      const m = f.members.find((x) => x.userId === userId)!;
      if (m.role === 'partner' && role !== 'partner' && f.members.filter((x) => x.role === 'partner').length === 1)
        throw new Error('A firm must keep at least one partner.');
      m.role = role;
      save();
    },
    async removeMember(userId) {
      const f = s.firms[firmId()];
      if (f.members.find((m) => m.userId === me().id)?.role !== 'partner') throw new Error('Only a partner can remove a member.');
      const m = f.members.find((x) => x.userId === userId)!;
      if (m.role === 'partner' && f.members.filter((x) => x.role === 'partner').length === 1)
        throw new Error('A firm must keep at least one partner.');
      f.members = f.members.filter((x) => x.userId !== userId);
      delete s.memberOf[userId];
      save();
    },
    async myInvites() {
      if (!s.user) return [];
      return s.invites
        .filter((i) => !i.accepted && i.email === s.user!.email)
        .map((i) => {
          const f = s.firms[i.firmId];
          const by = f?.members.find((m) => m.role === 'partner');
          return { id: i.id, firmName: f?.firm.name ?? '', role: i.role, country: f?.firm.country ?? 'NG', address: f?.firm.address ?? '', firmLicence: f?.firm.frcNumber ?? '', invitedBy: by?.fullName ?? '' };
        });
    },
    async acceptInvite(id, fullName, frcNumber) {
      const i = s.invites.find((x) => x.id === id && !x.accepted && x.email === me().email);
      if (!i) throw new Error('This invitation is not available.');
      if (s.memberOf[me().id]) throw new Error('You already belong to a firm.');
      const limit = limitsOf(i.firmId);
      if (limit.maxUsers !== null && s.firms[i.firmId].members.length >= limit.maxUsers)
        throw new Error(`This firm's ${limit.name} plan allows ${limit.maxUsers} users. A partner can change the plan under Billing.`);
      s.firms[i.firmId].members.push({ userId: me().id, role: i.role, fullName: fullName.trim(), frcNumber: frcNumber.trim() });
      s.memberOf[me().id] = i.firmId;
      i.accepted = true;
      save();
    },

    async listClients() {
      return s.clients.filter((c) => c.firmId === firmId()).map(strip) as Client[];
    },
    async createClient(c) {
      const row = { ...c, id: uid(), firmId: firmId() };
      s.clients.push(row);
      save();
      return strip(row) as Client;
    },
    async listEngagements() {
      return s.engagements.filter((e) => e.firmId === firmId()).map(strip) as Engagement[];
    },
    async createEngagement(e) {
      const state = stateOf(firmId());
      if (state === 'suspended') throw new Error(SUSPENDED);
      const limit = limitsOf(firmId());
      let payPer = false;
      let groupAddon = false;
      if (state === 'expired' || used(firmId()) >= limit.maxEngagements) {
        // Outside a plan, or past its allowance: use an engagement that was paid for on its own.
        const credits = (subOf(firmId()).credits ??= []);
        const i = credits.findIndex((c) => c.type === e.type);
        if (i < 0)
          throw new Error(
            state === 'expired'
              ? `Your firm's plan is not active. A partner can choose a plan, or pay for one ${e.type} engagement, under Billing.`
              : `Your ${limit.name} plan allows ${limit.maxEngagements} engagements. A partner can change the plan, or pay for one more ${e.type} engagement, under Billing.`,
          );
        payPer = true;
        groupAddon = credits[i].withGroup;
        credits.splice(i, 1);
      }
      const row = {
        id: uid(),
        createdAt: new Date().toISOString(),
        firmId: firmId(),
        clientId: e.clientId,
        type: e.type,
        yearEnd: e.yearEnd,
        status: 'in_progress' as const,
        planning: {},
        programme: {},
        programmeVersion: e.programmeVersion,
        report: {},
        testing: {},
        disclosures: {},
        signedByName: null,
        signedByFrc: null,
        firmFrc: null,
        signedAt: null,
        fileNo: e.fileNo?.trim() || nextFileNo(e.yearEnd),
        currency: e.currency ?? jurisdictionOf(s.firms[firmId()].firm.country).currencies[0],
        payPer,
        groupAddon,
      };
      s.engagements.push(row);
      log(row.id, 'engagements', 'insert');
      save();
      return strip(row) as Engagement;
    },
    async getEngagement(id) {
      if (!s.user || !s.memberOf[s.user.id]) return null;
      const e = s.engagements.find((x) => x.id === id && x.firmId === firmId());
      return e ? ({ ...strip(e), testing: e.testing ?? {}, disclosures: e.disclosures ?? {}, currency: e.currency ?? 'NGN' } as Engagement) : null;
    },
    async updateClient(id, patch) {
      const c = s.clients.find((x) => x.id === id && x.firmId === firmId());
      if (!c) throw new Error('The client could not be changed.');
      Object.assign(c, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      if (patch.name !== undefined) c.name = patch.name.trim();
      save();
    },
    async setBranding(b) {
      const f = s.firms[firmId()];
      if (!['partner', 'manager'].includes(f.members.find((m) => m.userId === me().id)?.role ?? '')) throw new Error('Only a partner or manager can change the report branding.');
      f.firm.branding = b;
      save();
    },
    async setFileNumbering(mode, pattern, next) {
      partner();
      if (mode === 'auto' && !pattern.includes('{N}')) throw new Error('An automatic pattern needs {N} where the number goes, for example VB/{YYYY}/{N}.');
      if (!(next >= 1)) throw new Error('The next number must be 1 or more.');
      Object.assign(s.firms[firmId()].firm, { fileNumbering: { mode, pattern: pattern.trim() }, nextFileNo: next });
      save();
    },
    async updateEngagement(id, patch) {
      const e = open(id);
      if (patch.fileNo !== undefined) {
        const no = patch.fileNo.trim();
        if (no && s.engagements.some((x) => x.id !== id && x.firmId === e.firmId && (x as any).fileNo?.toLowerCase() === no.toLowerCase()))
          throw new Error('Another engagement in your firm already uses that file number.');
        patch = { ...patch, fileNo: no };
      }
      const had = (e.planning as any)?.group?.subsidiaries?.length > 0;
      if ((e as any).payPer && !(e as any).groupAddon && !had && (patch as any).planning?.group?.subsidiaries?.length > 0)
        throw new Error('Group consolidation is an add-on for an engagement paid for on its own. A partner can add it under Billing.');
      Object.assign(e, patch);
      log(id, 'engagements', 'update', { changed: Object.keys(patch) });
      save();
    },

    async listLines(id) {
      eng(id);
      return (s.lines[id] ?? []).map((l) => ({ ...l }));
    },
    async replaceLines(id, lines) {
      open(id);
      // Accounts keep their id from one import to the next, so journals stay attached.
      const ids = new Map((s.lines[id] ?? []).map((l) => [l.code, l.id]));
      s.lines[id] = lines.map((l) => ({ ...l, id: ids.get(l.code) ?? uid() }));
      log(id, 'tb_lines', 'import', { accounts: lines.length });
      save();
    },
    async setMapping(id, clientId, line, mapCode, nature) {
      open(id);
      const l = (s.lines[id] ?? []).find((x) => x.id === line.id);
      if (!l) throw new Error('Account not found.');
      l.mapCode = mapCode;
      l.nature = nature;
      if (mapCode) (s.maps[clientId] ??= {})[l.code] = { mapCode, nature };
      log(id, 'tb_lines', 'update', { code: l.code, map_code: mapCode, nature });
      save();
    },
    async savedMappings(clientId) {
      return new Map(Object.entries(s.maps[clientId] ?? {}));
    },

    async listAdjustments(id) {
      eng(id);
      return (s.adjustments[id] ?? []).map((a) => ({ ...a }));
    },
    async addAdjustment(id, a) {
      open(id);
      // The same rules as the database (migration 0023).
      if ((s.adjustments[id] ?? []).some((x) => x.ref.trim().toUpperCase() === a.ref.trim().toUpperCase())) throw new Error('Another journal on this file already uses that reference. Choose a different reference.');
      if (a.lines.length < 2) throw new Error('A journal needs at least two lines.');
      if (a.lines.reduce((t, l) => t + l.amount, 0) !== 0) throw new Error('The journal does not balance.');
      (s.adjustments[id] ??= []).push({ ...a, id: uid() });
      log(id, 'adjustments', 'insert', { ref: a.ref, posted: a.posted });
      save();
    },
    async deleteAdjustment(adjId) {
      for (const [engId, list] of Object.entries(s.adjustments)) {
        const i = list.findIndex((a) => a.id === adjId);
        if (i >= 0) {
          open(engId);
          const [gone] = list.splice(i, 1);
          log(engId, 'adjustments', 'delete', { ref: gone.ref });
          save();
          return;
        }
      }
    },

    async listLedger(id, period = 'current') {
      eng(id);
      return (period === 'prior' ? s.priorLedger : s.ledger)[id] ?? [];
    },
    async replaceLedger(id, entries, period = 'current') {
      open(id);
      const store = period === 'prior' ? s.priorLedger : s.ledger;
      if (store[id]?.length) log(id, 'gl_entries', 'remove', { rows: store[id].length });
      store[id] = entries;
      if (entries.length) log(id, 'gl_entries', 'import', { rows: entries.length });
      save();
    },
    async listBankAccounts(id) {
      eng(id);
      return (s.bankAccounts[id] ?? []).map((a) => ({ ...a }));
    },
    async listBankLines(id) {
      eng(id);
      return s.bankLines[id] ?? [];
    },
    async addBankStatement(id, account, lines) {
      open(id);
      const row = { ...account, id: uid() };
      (s.bankAccounts[id] ??= []).push(row);
      (s.bankLines[id] ??= []).push(...lines.map((l) => ({ ...l, accountId: row.id })));
      log(id, 'bank_accounts', 'insert', { name: account.name, account_code: account.accountCode, closing: account.closing });
      log(id, 'bank_lines', 'import', { rows: lines.length });
      save();
    },
    async deleteBankAccount(accountId) {
      for (const [engId, list] of Object.entries(s.bankAccounts)) {
        const i = list.findIndex((a) => a.id === accountId);
        if (i < 0) continue;
        open(engId);
        const [gone] = list.splice(i, 1);
        s.bankLines[engId] = (s.bankLines[engId] ?? []).filter((l) => l.accountId !== accountId);
        log(engId, 'bank_accounts', 'delete', { name: gone.name });
        save();
        return;
      }
    },

    async listEvidence(id) {
      eng(id);
      return (s.evidence[id] ?? []).map((e) => ({ ...e }));
    },
    async addEvidence(id, file, meta) {
      open(id);
      const path = `${firmId()}/${id}/${uid()}`;
      blobs.set(path, URL.createObjectURL(file));
      (s.evidence[id] ??= []).push({
        id: uid(),
        path,
        fileName: file.name,
        size: file.size,
        refType: meta.refType,
        refId: meta.refId,
        note: meta.note,
        uploadedByName: meta.uploadedByName,
        createdAt: new Date().toISOString(),
        fromClient: false,
        page: meta.page ?? null,
      });
      log(id, 'evidence', 'insert', { file: file.name, ref_type: meta.refType, ref_id: meta.refId });
      save();
    },
    async deleteEvidence(e) {
      for (const [engId, list] of Object.entries(s.evidence)) {
        const i = list.findIndex((x) => x.id === e.id);
        if (i < 0) continue;
        open(engId);
        list.splice(i, 1);
        blobs.delete(e.path);
        log(engId, 'evidence', 'delete', { file: e.fileName });
        save();
        return;
      }
    },
    async setEvidencePage(e, page) {
      for (const [engId, list] of Object.entries(s.evidence)) {
        const x = list.find((y) => y.id === e.id);
        if (!x) continue;
        open(engId);
        x.page = page;
        log(engId, 'evidence', 'update', { file: x.fileName, page });
        save();
        return;
      }
    },
    async evidenceUrl(e) {
      const url = blobs.get(e.path);
      if (!url) throw new Error('Demo mode keeps file contents only until the page is reloaded. Upload the file again.');
      return opensAtPage(e) ? `${url}#page=${e.page}` : url;
    },

    // There is no payment provider in demo mode, so the payment is treated as made.
    async startCheckout(c) {
      const f = s.firms[firmId()];
      const m = f.members.find((x) => x.userId === me().id);
      if (m?.role !== 'partner') throw new Error('Only a partner can make a payment.');
      if (stateOf(firmId()) === 'suspended') throw new Error("This firm's account is suspended. Please contact VeritBooks support.");
      const sub = subOf(firmId());
      const cp = countryOfFirm(firmId());
      const plans = plansFor(cp);
      const done = { message: 'Demo mode: no money was taken. The payment is treated as made so you can see how it works.' };
      if (c.kind === 'plan') {
        const q = planQuote(sub, plans.find((x) => x.code === c.plan)!, plans, foundingTaken(), planPayments(sub), new Date(), cp.minCharge);
        if (q.mode === 'later') throw new Error('You can move to a smaller plan in the last 30 days of your paid year.');
        if (q.founding && !c.founding_agreed) throw new Error('Please confirm the founding firm commitment first.');
        if (q.founding) {
          makeFounding(sub);
          sub.foundingAgreedAt = new Date().toISOString();
          sub.foundingAgreedBy = m.fullName;
        }
        payPlan(sub, c.plan, q.amountKobo, { creditKobo: q.creditKobo, restart: q.mode === 'upgrade', founding: q.founding });
        save();
        return done;
      }
      const target = c.engagement ? s.engagements.find((x) => x.id === c.engagement && x.firmId === firmId() && x.status === 'in_progress') : null;
      if (c.engagement && !target) throw new Error('That engagement cannot be paid for.');
      const price = (code: 'audit' | 'review' | 'compilation' | 'group') => cp.engagements[code];
      if (c.kind === 'group') {
        if (!target || !(target as any).payPer || (target as any).groupAddon) throw new Error('The consolidation add-on is for an engagement paid for on its own.');
        (target as any).groupAddon = true;
        receipt(sub, { kind: 'group', plan: null, engagementType: target.type, withGroup: true, amountKobo: price('group'), creditKobo: 0, founding: false, coversUntil: null });
      } else {
        const type = target?.type ?? c.type;
        if (!type) throw new Error('Choose audit, review or compilation.');
        if (target && (target as any).payPer) throw new Error('That engagement is already paid for.');
        if (target) {
          (target as any).payPer = true;
          (target as any).groupAddon = (target as any).groupAddon || !!c.with_group;
        } else (sub.credits ??= []).push({ id: uid(), type, withGroup: !!c.with_group });
        receipt(sub, { kind: 'engagement', plan: null, engagementType: type, withGroup: !!c.with_group, amountKobo: price(type) + (c.with_group ? price('group') : 0), creditKobo: 0, founding: false, coversUntil: null });
      }
      save();
      return done;
    },
    async confirmPayment() {
      return 'Demo mode: there is no payment to confirm.';
    },

    async publicPrices(country) {
      const pl = platform();
      const c = countries().find((x) => x.code === (country ?? 'NG') && x.enabled);
      if (!c) throw new Error('That country is not open for new firms yet.');
      return {
        country: c.code,
        currency: c.currency,
        chargeCurrency: chargeOf(c).currency,
        taxLabel: c.taxLabel,
        countries: countries().filter((x) => x.enabled).map((x) => ({ code: x.code, name: x.name, currency: x.currency })),
        plans: plansFor(c).filter((p) => p.code !== 'trial').map((p) => ({ code: p.code, name: p.name, priceKobo: p.priceKobo, maxUsers: p.maxUsers, maxEngagements: p.maxEngagements })),
        engagementPrices: enginePrices(c),
        vatPercent: c.vatPercent,
        foundingLeft: Math.max(FOUNDING_PLACES - foundingTaken(), 0),
        supportEmail: pl.settings.support_email,
      };
    },
    async setFirmCountry(code) {
      partner();
      const sub = subOf(firmId());
      if (sub.payments.length || (sub.credits ?? []).length)
        throw new Error('Your firm has already paid in its current currency. Please contact VeritBooks support to change the country.');
      const c = countries().find((x) => x.code === code && x.enabled);
      if (!c) throw new Error('That country is not available.');
      s.firms[firmId()].firm.country = c.code;
      save();
    },
    async isAdmin() {
      return isAdminUser();
    },
    async adminStatus() {
      if (!isAdminAccount()) return { admin: false, verified: false, enrolled: false };
      return { admin: true, verified: verifiedNow(), enrolled: !!platform().mfa?.[me().email]?.verified };
    },
    async mfaEnroll() {
      const secret = newSecret();
      (platform().mfa ??= {})[me().email] = { secret, verified: false };
      save();
      return { factorId: 'demo', qr: null, secret };
    },
    async mfaVerify(_factorId, code) {
      const f = platform().mfa?.[me().email];
      if (!f) throw new Error('No authenticator is set up for this account.');
      if (!(await checkCode(f.secret, code))) throw new Error('That code is not right. Codes change every 30 seconds: check the clock on your phone and try the current one.');
      f.verified = true;
      sessionStorage.setItem(MFA_KEY, me().email);
      save();
    },
    async mfaStatus() {
      if (!s.user) return { enrolled: false, verified: false };
      return { enrolled: !!platform().mfa?.[me().email]?.verified, verified: verifiedNow() };
    },
    async mfaDisable() {
      if (!verifiedNow()) throw new Error('Enter the code from your authenticator app first.');
      if (platform().mfa) delete platform().mfa![me().email];
      save();
    },
    async createBackupCodes() {
      const f = platform().mfa?.[me().email];
      if (!f?.verified || !verifiedNow()) throw new Error('Enter the code from your authenticator app first.');
      const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const codes = Array.from({ length: 10 }, () => `${hex()}-${hex()}`);
      f.backup = codes.map((c) => c.replace('-', ''));
      save();
      return codes;
    },
    async backupCodesLeft() {
      return platform().mfa?.[me().email]?.backup?.length ?? 0;
    },
    async recoverWithBackupCode(code) {
      const f = platform().mfa?.[me().email];
      const c = code.toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (!f?.backup?.includes(c)) throw new Error('That backup code is not right, or has been used.');
      delete platform().mfa![me().email];
      save();
      return 'Two-factor authentication has been turned off for your account. Turn it on again with your new phone in Firm details.';
    },
    async adminResetTwoFactor(userId) {
      if (!isAdminUser()) throw new Error('Not found.');
      if (userId === me().id) throw new Error('You cannot reset your own two-factor authentication. Ask another admin.');
      const email = Object.entries(s.accounts).find(([, a]) => a.id === userId)?.[0];
      if (email && platform().mfa) delete platform().mfa![email];
      platform().log.push({ at: new Date().toISOString(), action: 'reset_two_factor', detail: { admin: email ?? '' }, admin: me().email, firm: null });
      save();
    },
    async partnerProgramme() {
      return publicProgramme();
    },
    async partnerClick(code, campaign, path, country) {
      const p = liveCode(code);
      if (!p) return false;
      programme().clicks.push({ partner_id: p.id, at: new Date().toISOString(), campaign: campaign.slice(0, 60), path: path.slice(0, 120), country: country.slice(0, 2).toUpperCase() });
      save();
      return true;
    },
    async partnerLookup(code) {
      const p = liveCode(code);
      return p ? { name: shownName(p) } : null;
    },
    async claimReferral(code, campaign) {
      const id = firmId();
      if (s.firms[id].members.find((m) => m.userId === me().id)?.role !== 'partner') throw new Error('Only a partner of the firm can enter a referral code.');
      const pp = programme();
      if (pp.referrals[id]) throw new Error('This firm already has a referral.');
      if (subOf(id).payments.length) throw new Error('A referral code can only be added in the first 30 days, before the firm has paid.');
      const p = liveCode(code);
      if (!p) throw new Error('That referral code was not found.');
      if (p.user_id === me().id || p.email.toLowerCase() === me().email.toLowerCase()) throw new Error('A partner cannot refer their own firm.');
      pp.referrals[id] = { partner_id: p.id, referred_at: new Date().toISOString(), campaign: campaign.slice(0, 60), review: sameCompanyDomain(me().email, p.email) ? "The firm's email domain is the same as the partner's." : null };
      save();
      return { name: shownName(p) };
    },
    async partnerApply(a) {
      const pp = programme();
      const u = me();
      if (pp.partners.some((p) => p.user_id === u.id)) throw new Error('You have already applied.');
      if (!a.accept_terms) throw new Error('Accept the partner terms to apply.');
      if (!a.name.trim()) throw new Error('Enter your name.');
      const invited = pp.partners.find((p) => !p.user_id && p.email.toLowerCase() === u.email.toLowerCase());
      if (invited) {
        Object.assign(invited, { user_id: u.id, terms_version: pp.settings.terms_version, terms_accepted_at: new Date().toISOString(), phone: a.phone, website: a.website, promotion: a.promotion });
      } else {
        if (!pp.settings.open) throw new Error('The partner programme is not taking applications at the moment.');
        pp.partners.push({
          id: uid(), user_id: u.id, email: u.email.toLowerCase(), name: a.name.trim(), company: a.company.trim(), phone: a.phone, country: a.country || 'NG', website: a.website,
          promotion: a.promotion, code: newCode(a.name, (c) => pp.partners.some((p) => p.code === c)), status: 'pending', commission_percent: pp.settings.default_percent,
          commission_months: pp.settings.default_months, later_percent: pp.settings.default_later_percent ?? 0, later_months: pp.settings.default_later_months ?? null, payout_details: {}, admin_notes: '', created_by_admin: false, terms_version: pp.settings.terms_version,
          terms_accepted_at: new Date().toISOString(), created_at: new Date().toISOString(), approved_at: null,
        });
      }
      save();
    },
    async partnerMe() {
      if (!s.user) return null;
      const pp = programme();
      const u = s.user;
      const p = pp.partners.find((x) => x.user_id === u.id);
      if (!p) {
        const inv = pp.partners.find((x) => !x.user_id && x.email.toLowerCase() === u.email.toLowerCase());
        return inv ? { invited: true as const, name: inv.name, company: inv.company, programme: publicProgramme() } : null;
      }
      const since = Date.now() - 30 * 86_400_000;
      const clicks = pp.clicks.filter((k) => k.partner_id === p.id);
      const byCampaign = new Map<string, number>();
      for (const k of clicks) byCampaign.set(k.campaign, (byCampaign.get(k.campaign) ?? 0) + 1);
      const byDay = new Map<string, number>();
      for (const k of clicks) if (Date.parse(k.at) > since) byDay.set(k.at.slice(0, 10), (byDay.get(k.at.slice(0, 10)) ?? 0) + 1);
      const mine = pp.commissions.filter((c) => c.partner_id === p.id);
      const { user_id: _u, admin_notes: _n, created_by_admin: _c, ...profile } = p;
      return {
        partner: profile,
        programme: publicProgramme(),
        clicks: {
          total: clicks.length,
          last30: clicks.filter((k) => Date.parse(k.at) > since).length,
          campaigns: [...byCampaign].map(([campaign, n]) => ({ campaign, clicks: n })).sort((a, b) => b.clicks - a.clicks),
          days: [...byDay].map(([day, n]) => ({ day, clicks: n })).sort((a, b) => a.day.localeCompare(b.day)),
        },
        referrals: Object.entries(pp.referrals)
          .filter(([fid, r]) => r.partner_id === p.id && !!s.firms[fid])
          .map(([fid, r]) => {
            const earned: Record<string, number> = {};
            for (const c of mine) if (c.firm_id === fid && c.status !== 'void') earned[c.currency] = (earned[c.currency] ?? 0) + c.amount_kobo;
            return { firm_id: fid, firm: s.firms[fid]?.firm.name ?? '', country: s.firms[fid]?.firm.country ?? 'NG', referred_at: r.referred_at, campaign: r.campaign, state: s.firms[fid] ? stateOf(fid) : 'expired', review: !!r.review, earned };
          })
          .sort((a, b) => b.referred_at.localeCompare(a.referred_at)),
        commissions: mine.map(({ partner_id: _p, firm_id: _f, payment_id: _y, ...c }) => c).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        payouts: pp.payouts.filter((o) => o.partner_id === p.id).map(({ partner_id: _p, payout_details: _d, requested_by: _b, ...o }) => o).sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
        balances: balancesOf(mine),
        assets: p.status === 'active' ? pp.assets : [],
      };
    },
    async partnerUpdate(patch) {
      const p = programme().partners.find((x) => x.user_id === me().id);
      if (!p) throw new Error('No partner account.');
      for (const k of ['company', 'phone', 'website', 'promotion'] as const) if (patch[k] !== undefined) p[k] = String(patch[k]);
      if (patch.payout_details) p.payout_details = { ...patch.payout_details };
      save();
    },
    async partnerRequestPayout(currency) {
      const p = programme().partners.find((x) => x.user_id === me().id);
      if (!p) throw new Error('No partner account.');
      makePayout(p.id, currency.toUpperCase(), 'partner');
      save();
    },
    async adminPartners() {
      if (!isAdminUser()) throw new Error('Not found.');
      const pp = programme();
      const since = Date.now() - 30 * 86_400_000;
      const paying = (fid: string) => (s.firms[fid] ? subOf(fid).payments.length > 0 : false);
      const months = new Map<string, number>();
      for (const k of pp.clicks) {
        const key = `${k.partner_id}|${k.at.slice(0, 7)}|${k.campaign}`;
        months.set(key, (months.get(key) ?? 0) + 1);
      }
      return {
        settings: { ...pp.settings },
        partners: pp.partners.map(({ user_id, ...p }) => {
          const refs = Object.entries(pp.referrals).filter(([, r]) => r.partner_id === p.id);
          return {
            ...p, has_account: !!user_id,
            clicks: pp.clicks.filter((k) => k.partner_id === p.id).length,
            clicks30: pp.clicks.filter((k) => k.partner_id === p.id && Date.parse(k.at) > since).length,
            referred: refs.length, paying: refs.filter(([fid]) => paying(fid)).length,
            balances: balancesOf(pp.commissions.filter((c) => c.partner_id === p.id)),
          };
        }).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        referrals: Object.entries(pp.referrals).map(([fid, r]) => ({ firm_id: fid, firm: s.firms[fid]?.firm.name ?? '', country: s.firms[fid]?.firm.country ?? 'NG', partner_id: r.partner_id, referred_at: r.referred_at, campaign: r.campaign, review: r.review, state: s.firms[fid] ? stateOf(fid) : 'expired' })),
        commissions: pp.commissions.map(({ payment_id: _y, ...c }) => c).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        payouts: [...pp.payouts].sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
        clicks: [...months].map(([k, n]) => {
          const [partner_id, month, campaign] = k.split('|');
          return { partner_id, month, campaign, clicks: n };
        }),
        assets: [...pp.assets],
      };
    },
    async adminPartnerAct(action, a) {
      if (!isAdminUser()) throw new Error('Not found.');
      const pp = programme();
      const str = (k: string) => (a[k] === undefined || a[k] === null ? undefined : String(a[k]));
      const p = str('id') ? pp.partners.find((x) => x.id === str('id')) : undefined;
      const code = str('code') ? normaliseCode(str('code')!) : undefined;
      if (code !== undefined && !/^[A-Z0-9]{4,20}$/.test(code)) throw new Error('A code is 4 to 20 letters and numbers.');
      if (code && pp.partners.some((x) => x.code === code && x.id !== str('id'))) throw new Error('Another partner already uses that code.');
      const months = (v: unknown, fallback: number | null) => (v === undefined ? fallback : v === '' || v === null ? null : Number(v));
      const now = new Date().toISOString();
      let out: Record<string, unknown> = {};
      const need = () => {
        if (!p) throw new Error('Partner not found.');
        return p;
      };
      const commission = () => pp.commissions.find((c) => c.id === str('id'));
      const payout = () => pp.payouts.find((o) => o.id === str('id'));
      switch (action) {
        case 'create': {
          const email = (str('email') ?? '').trim().toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter the partner's email address.");
          if (pp.partners.some((x) => x.email.toLowerCase() === email)) throw new Error('A partner with that email already exists.');
          const np = {
            id: uid(), user_id: null, email, name: (str('name') ?? '').trim(), company: str('company') ?? '', phone: str('phone') ?? '', country: (str('country') || 'NG').toUpperCase(),
            website: '', promotion: '', code: code ?? newCode(str('name') ?? '', (c) => pp.partners.some((x) => x.code === c)), status: 'active' as const,
            commission_percent: a.percent !== undefined && a.percent !== '' ? Number(a.percent) : pp.settings.default_percent, commission_months: months(a.months, pp.settings.default_months),
            later_percent: a.later_percent !== undefined && a.later_percent !== '' ? Number(a.later_percent) : (pp.settings.default_later_percent ?? 0),
            later_months: months(a.later_months, pp.settings.default_later_months ?? null),
            payout_details: {}, admin_notes: str('admin_notes') ?? '', created_by_admin: true, terms_version: null, terms_accepted_at: null, created_at: now, approved_at: now,
          };
          if (!np.name) throw new Error("Enter the partner's name.");
          pp.partners.push(np);
          out = { id: np.id, code: np.code };
          break;
        }
        case 'update': {
          const x = need();
          if (str('name')?.trim()) x.name = str('name')!.trim();
          for (const k of ['company', 'phone', 'admin_notes'] as const) if (str(k) !== undefined) x[k] = str(k)!;
          if (str('country')) x.country = str('country')!.toUpperCase();
          if (code) x.code = code;
          if (a.percent !== undefined && a.percent !== '') x.commission_percent = Number(a.percent);
          if ('months' in a) x.commission_months = months(a.months, x.commission_months);
          if (a.later_percent !== undefined && a.later_percent !== '') x.later_percent = Number(a.later_percent);
          if ('later_months' in a) x.later_months = months(a.later_months, x.later_months ?? null);
          break;
        }
        case 'status': {
          const x = need();
          const st = str('status') as PartnerProfile['status'];
          if (!['active', 'suspended', 'rejected', 'pending'].includes(st)) throw new Error('Unknown status.');
          x.status = st;
          if (st === 'active') x.approved_at ??= now;
          break;
        }
        case 'commission_approve': {
          const c = commission();
          if (!c || c.status !== 'review') throw new Error('That commission is not awaiting review.');
          c.status = 'pending';
          if (pp.referrals[c.firm_id]) pp.referrals[c.firm_id].review = null;
          break;
        }
        case 'commission_void': {
          if (!str('reason')?.trim()) throw new Error('Give the reason, such as a refund.');
          const c = commission();
          if (!c || !['review', 'pending'].includes(c.status)) throw new Error('Only a commission not yet in a payout can be voided.');
          Object.assign(c, { status: 'void', void_reason: str('reason')!.trim(), payout_id: null });
          break;
        }
        case 'payout_create':
          out = { id: makePayout(need().id, (str('currency') ?? '').toUpperCase(), 'admin') };
          break;
        case 'payout_paid': {
          if (!str('reference')?.trim()) throw new Error('Enter the transfer reference.');
          const o = payout();
          if (!o || o.status !== 'requested') throw new Error('That payout is not awaiting payment.');
          Object.assign(o, { status: 'paid', decided_at: str('paid_at') ? new Date(str('paid_at')!).toISOString() : now, reference: str('reference')!.trim(), method: str('method') || 'Bank transfer', note: str('note') ?? '' });
          for (const c of pp.commissions) if (c.payout_id === o.id) c.status = 'paid';
          break;
        }
        case 'payout_reject': {
          if (!str('note')?.trim()) throw new Error('Tell the partner why.');
          const o = payout();
          if (!o || o.status !== 'requested') throw new Error('That payout is not awaiting payment.');
          Object.assign(o, { status: 'rejected', decided_at: now, note: str('note')!.trim() });
          for (const c of pp.commissions) if (c.payout_id === o.id) Object.assign(c, { status: 'pending', payout_id: null });
          break;
        }
        case 'assign_referral': {
          const fid = str('firm') ?? '';
          if (!s.firms[fid]) throw new Error('Firm not found.');
          const pid = str('partner');
          if (pid && !pp.partners.some((x) => x.id === pid)) throw new Error('Partner not found.');
          if (pid) pp.referrals[fid] = { partner_id: pid, referred_at: pp.referrals[fid]?.referred_at ?? now, campaign: pp.referrals[fid]?.campaign ?? '', review: null };
          else delete pp.referrals[fid];
          break;
        }
        case 'settings': {
          const st = pp.settings;
          if (a.open !== undefined) st.open = !!a.open;
          if (a.default_percent !== undefined) st.default_percent = Number(a.default_percent);
          if ('default_months' in a) st.default_months = months(a.default_months, st.default_months);
          if (a.default_later_percent !== undefined && a.default_later_percent !== '') st.default_later_percent = Number(a.default_later_percent);
          if ('default_later_months' in a) st.default_later_months = months(a.default_later_months, st.default_later_months ?? null);
          if (a.hold_days !== undefined) st.hold_days = Number(a.hold_days);
          if (a.cookie_days !== undefined) st.cookie_days = Number(a.cookie_days);
          if (a.min_payout && typeof a.min_payout === 'object') st.min_payout = { ...st.min_payout, ...(a.min_payout as Record<string, number>) };
          if (str('terms_version')?.trim()) st.terms_version = str('terms_version')!.trim();
          st.updated_at = now;
          break;
        }
        case 'asset_add':
          if (!str('title')?.trim()) throw new Error('Give the resource a title.');
          pp.assets.push({ id: uid(), title: str('title')!.trim(), kind: str('kind') === 'link' ? 'link' : 'copy', body: str('body') ?? '', url: str('url') ?? '', created_at: now });
          break;
        case 'asset_delete':
          pp.assets = pp.assets.filter((x) => x.id !== str('id'));
          break;
        default:
          throw new Error('Unknown action.');
      }
      platform().log.push({ at: now, action: 'partner_' + action, detail: a, admin: me().email, firm: null });
      save();
      return out;
    },
    async adminOverview() {
      if (!isAdminUser()) throw new Error('Not found.');
      const pl = platform();
      const emailOf = (id: string) => Object.entries(s.accounts).find(([, a]) => a.id === id)?.[0] ?? null;
      const firms = Object.entries(s.firms).map(([id, f]) => {
        const sub = subOf(id);
        const engs = s.engagements.filter((e) => e.firmId === id);
        return {
          id, name: f.firm.name, frc_number: f.firm.frcNumber, address: f.firm.address, created_at: sub.createdAt ?? sub.trialEndsAt,
          state: stateOf(id), plan: sub.plan, trial_ends_at: sub.trialEndsAt, paid_until: sub.paidUntil,
          founding_number: sub.foundingNumber, founding_agreed_at: sub.foundingAgreedAt ?? null, founding_agreed_by: sub.foundingAgreedBy ?? null,
          suspended_reason: sub.suspendedReason ?? '', note: sub.note ?? '', ai_enabled: f.firm.aiEnabled, country: f.firm.country ?? 'NG',
          engagements: engs.length, signed: engs.filter((e) => e.status === 'locked').length, clients: s.clients.filter((c) => (c as any).firmId === id).length,
          credits: (sub.credits ?? []).length, paid_kobo: sub.payments.reduce((t, p) => t + p.amountKobo, 0), last_activity: null,
          members: f.members.map((m) => ({ name: m.fullName, role: m.role, email: emailOf(m.userId), joined: sub.createdAt ?? '' })),
        };
      });
      const payments = Object.entries(s.firms).flatMap(([id, f]) =>
        subOf(id).payments.map((p) => ({ id: p.id, firm: f.firm.name, firm_id: id, kind: p.kind, plan: p.plan, engagement_type: p.engagementType, with_group: p.withGroup, amount_kobo: p.amountKobo, currency: p.currency ?? 'NGN', vat_kobo: p.vatKobo, quoted_currency: p.quotedCurrency ?? null, quoted_kobo: p.quotedKobo ?? null, fx_rate: p.fxRate ?? null, credit_kobo: p.creditKobo, founding: p.founding, status: 'paid', source: p.source, note: p.source === 'manual' ? p.reference : '', tx_ref: p.reference, provider_id: null, receipt_no: p.receiptNo, created_at: p.paidAt, paid_at: p.paidAt })),
      ).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const month = new Date().toISOString().slice(0, 7);
      const allPaid = Object.keys(s.firms).flatMap((id) => subOf(id).payments);
      return {
        founding_taken: foundingTaken(),
        revenue_kobo: payments.reduce((t, p) => t + p.amount_kobo, 0),
        revenue_month_kobo: payments.filter((p) => p.created_at.startsWith(month)).reduce((t, p) => t + p.amount_kobo, 0),
        vat_kobo: allPaid.reduce((t, p) => t + p.vatKobo, 0),
        vat_month_kobo: allPaid.filter((p) => p.paidAt.startsWith(month)).reduce((t, p) => t + p.vatKobo, 0),
        firms: firms.reverse(),
        revenue: (['GHS', 'NGN', 'USD'] as const)
          .map((currency) => {
            const mine = allPaid.filter((p) => (p.currency ?? 'NGN') === currency);
            const sum = (xs: PaymentRecord[], k: 'amountKobo' | 'vatKobo') => xs.reduce((t, p) => t + p[k], 0);
            const thisMonth = mine.filter((p) => p.paidAt.startsWith(month));
            return { currency, total_kobo: sum(mine, 'amountKobo'), month_kobo: sum(thisMonth, 'amountKobo'), vat_kobo: sum(mine, 'vatKobo'), vat_month_kobo: sum(thisMonth, 'vatKobo'), n: mine.length };
          })
          .filter((r) => r.n > 0)
          .map(({ n: _n, ...r }) => r),
        countries: countries().map((c) => ({
          code: c.code, name: c.name, currency: c.currency, vat_percent: c.vatPercent, tax_label: c.taxLabel, min_charge: c.minCharge, enabled: c.enabled,
          charge_currency: chargeOf(c).currency, charge_rate: c.chargeRate ?? null, rate_set_at: (c as { rateSetAt?: string }).rateSetAt ?? null,
          firms: Object.values(s.firms).filter((f) => (f.firm.country ?? 'NG') === c.code).length,
          plans: { ...c.plans }, engagement_prices: { ...c.engagements },
        })),
        users: Object.entries(s.accounts).map(([email, a]) => {
          const fid = s.memberOf[a.id];
          const m = fid ? s.firms[fid].members.find((x) => x.userId === a.id) : null;
          return { id: a.id, email, created_at: (a as any).createdAt ?? '', confirmed: true, last_sign_in_at: null, firm: fid ? s.firms[fid].firm.name : null, role: m?.role ?? null, name: m?.fullName ?? null, admin: email === DEMO_ADMIN || pl.admins.includes(email) };
        }).reverse(),
        payments,
        plans: pl.plans.map((p) => ({ code: p.code, name: p.name, price_kobo: p.priceKobo, max_users: p.maxUsers, max_engagements: p.maxEngagements })),
        engagement_prices: pl.prices.map((p) => ({ code: p.code, name: p.name, price_kobo: p.priceKobo })),
        settings: { ...pl.settings, vat_percent: vatRate() },
        log: [...pl.log].reverse(),
      };
    },
    async adminFxRate() {
      if (!isAdminUser()) throw new Error('Not found.');
      throw new Error('Demo mode has no Flutterwave connection. Enter the rate yourself.');
    },
    async adminAct(action, p) {
      if (!isAdminUser()) throw new Error('Not found.');
      const pl = platform();
      const firm = typeof p.firm === 'string' ? s.firms[p.firm] : undefined;
      const sub = firm ? subOf(p.firm as string) : undefined;
      const need = () => {
        if (!sub) throw new Error('Firm not found.');
        return sub;
      };
      const now = new Date();
      const country = () => {
        const c = countries().find((x) => x.code === String(p.country ?? '').toUpperCase());
        if (!c) throw new Error('Country not found.');
        return c;
      };
      const priceOf = () => {
        const v = Math.round(Number(p.price) * 100);
        if (!(v > 0)) throw new Error('Give a price above zero.');
        return v;
      };
      if (action === 'country_price') {
        const c = country();
        if (!['solo', 'practice', 'firm'].includes(String(p.plan))) throw new Error('Plan not found.');
        c.plans[p.plan as 'solo'] = priceOf();
        if (c.code === 'NG') planBy(String(p.plan)).priceKobo = c.plans[p.plan as 'solo'];
      } else if (action === 'country_engagement_price') {
        const c = country();
        const row = pl.prices.find((x) => x.code === p.code);
        if (!row) throw new Error('Price not found.');
        c.engagements[row.code] = priceOf();
        if (c.code === 'NG') row.priceKobo = c.engagements[row.code];
      } else if (action === 'country_settings') {
        const c = country();
        const rate = Number(p.vat_percent);
        if (!(rate >= 0 && rate <= 50)) throw new Error('Give a tax rate between 0 and 50.');
        const label = String(p.tax_label ?? '').trim();
        if (!label || label.length > 30) throw new Error('Name the tax, for example VAT.');
        if (c.code === 'NG' && p.enabled === false) throw new Error('Nigeria cannot be closed to new firms.');
        Object.assign(c, { vatPercent: rate, taxLabel: label, enabled: p.enabled === undefined ? c.enabled : !!p.enabled });
        if (c.code === 'NG') pl.settings.vat_percent = rate;
      } else if (action === 'country_charge') {
        const c = country();
        const cur = String(p.charge_currency ?? '').toUpperCase();
        if (!['NGN', 'GHS', 'USD', 'ZAR'].includes(cur)) throw new Error('Choose naira, cedis, US dollars or rand.');
        if (cur === c.currency) Object.assign(c, { chargeCurrency: null, chargeRate: null, rateSetAt: null });
        else {
          const rate = Number(p.rate);
          if (!(rate > 0 && rate <= 1_000_000)) throw new Error('Give the exchange rate: how many of the collected currency make one of the price currency.');
          Object.assign(c, { chargeCurrency: cur, chargeRate: rate, rateSetAt: now.toISOString() });
        }
      } else if (action === 'set_country') {
        const c = country();
        if (!firm) throw new Error('Firm not found.');
        firm.firm.country = c.code;
        if (need().foundingNumber != null) need().lockedPrices = { ...c.plans };
      } else if (action === 'plan_limits') {
        const plan = pl.plans.find((x) => x.code === p.plan && x.code !== 'trial');
        if (!plan) throw new Error('Plan not found.');
        const users = p.max_users === '' || p.max_users == null ? null : Number(p.max_users);
        if (!(Number(p.max_engagements) >= 1) || (users !== null && !(users >= 1))) throw new Error('Give allowances above zero.');
        Object.assign(plan, { maxEngagements: Number(p.max_engagements), maxUsers: users });
      } else if (action === 'extend_trial') {
        const days = Number(p.days);
        if (!(days >= 1 && days <= 90)) throw new Error('Extend by 1 to 90 days.');
        need().trialEndsAt = new Date(Math.max(now.getTime(), new Date(need().trialEndsAt).getTime()) + days * 86_400_000).toISOString();
      } else if (action === 'set_plan') {
        const until = new Date(`${p.until}T23:59:59`);
        if (!pl.plans.some((x) => x.code === p.plan && x.code !== 'trial') || !(until > now)) throw new Error('Choose a plan and a date in the future.');
        if (stateOf(p.firm as string) !== 'active') need().yearStart = now.toISOString();
        need().plan = p.plan as PlanCode;
        need().paidUntil = until.toISOString();
      } else if (action === 'end_plan') {
        if (need().paidUntil && new Date(need().paidUntil!) > now) need().paidUntil = now.toISOString();
      } else if (action === 'record_payment') {
        const amount = Math.round(Number(p.amount_naira) * 100);
        if (!pl.plans.some((x) => x.code === p.plan && x.code !== 'trial') || !(amount > 0) || !String(p.reference ?? '').trim()) throw new Error('Give the plan, the amount received and a reference.');
        payPlan(need(), p.plan as PlanCode, amount, { source: 'manual', reference: String(p.reference).trim() });
      } else if (action === 'suspend') {
        need().suspendedAt = now.toISOString();
        need().suspendedReason = String(p.reason ?? '').trim();
      } else if (action === 'unsuspend') {
        need().suspendedAt = null;
        need().suspendedReason = '';
      } else if (action === 'founding') {
        if (p.on) {
          if (need().foundingNumber == null) {
            if (foundingTaken() >= FOUNDING_PLACES) throw new Error('All 20 founding places are taken.');
            makeFounding(need());
          }
        } else Object.assign(need(), { foundingNumber: null, priceLockUntil: null, lockedPrices: null });
      } else if (action === 'grant_credit') {
        if (!['audit', 'review', 'compilation'].includes(String(p.type))) throw new Error('Choose audit, review or compilation.');
        (need().credits ??= []).push({ id: uid(), type: p.type as 'audit', withGroup: !!p.with_group });
      } else if (action === 'note') {
        need().note = String(p.text ?? '');
      } else if (action === 'set_price') {
        const plan = pl.plans.find((x) => x.code === p.plan && x.code !== 'trial');
        const price = Math.round(Number(p.price_naira) * 100);
        if (!plan) throw new Error('Plan not found.');
        if (!(price > 0) || !(Number(p.max_engagements) >= 1)) throw new Error('Give a price and an engagement allowance above zero.');
        Object.assign(plan, { priceKobo: price, maxEngagements: Number(p.max_engagements), maxUsers: p.max_users === '' || p.max_users == null ? null : Number(p.max_users) });
        countries()[0].plans[plan.code as 'solo'] = price;
      } else if (action === 'set_engagement_price') {
        const row = pl.prices.find((x) => x.code === p.code);
        const price = Math.round(Number(p.price_naira) * 100);
        if (!row) throw new Error('Price not found.');
        if (!(price > 0)) throw new Error('Give a price above zero.');
        row.priceKobo = price;
        countries()[0].engagements[row.code] = price;
      } else if (action === 'settings') {
        const rate = p.vat_percent === undefined ? vatRate() : Number(p.vat_percent);
        if (!(rate >= 0 && rate <= 50)) throw new Error('Give a VAT rate between 0 and 50.');
        countries()[0].vatPercent = rate;
        pl.settings = { vat_percent: rate, seller_name: String(p.seller_name ?? '').trim(), seller_address: String(p.seller_address ?? '').trim(), tax_id: String(p.tax_id ?? '').trim(), support_email: String(p.support_email ?? '').trim() };
      } else if (action === 'add_admin') {
        const email = String(p.email ?? '').trim().toLowerCase();
        if (!s.accounts[email]) throw new Error('No confirmed account uses that email address. They need to create an account first.');
        if (!pl.admins.includes(email)) pl.admins.push(email);
      } else if (action === 'remove_admin') {
        const email = Object.entries(s.accounts).find(([, a]) => a.id === p.user)?.[0];
        if (p.user === me().id) throw new Error('You cannot remove yourself.');
        pl.admins = pl.admins.filter((x) => x !== email);
      } else throw new Error('Unknown action.');
      const { firm: _f, ...detail } = p;
      pl.log.push({ at: now.toISOString(), action, detail, admin: me().email, firm: firm?.firm.name ?? null });
      save();
    },

    async setAssist(enabled) {
      partner();
      s.firms[firmId()].firm.aiEnabled = enabled;
      save();
    },
    // Demo mode has no AI service. These return canned samples so the screens can be tried.
    async suggestMappings(engagementId, accounts) {
      eng(engagementId);
      if (!s.firms[firmId()].firm.aiEnabled) throw new Error('AI assistance is turned off for your firm. A partner can turn it on in the firm details.');
      return {
        model: 'demo sample, not AI',
        suggestions: accounts.map((a) => {
          const guess = suggestMapping(a.name.replace(/suspense|sundry|misc\w*/gi, '').trim() || a.name);
          const line = guess.mapCode ?? (a.balance >= 0 ? 'other_receivables' : 'other_payables');
          return {
            code: a.code,
            line,
            nature: guess.nature,
            confidence: guess.mapCode ? ('medium' as const) : ('low' as const),
            reason: guess.mapCode ? 'Sample suggestion from the account name.' : `Sample suggestion: the name does not say what this is. A ${a.balance >= 0 ? 'debit' : 'credit'} balance points to a ${a.balance >= 0 ? 'receivable' : 'payable'}. Ask the client what it holds.`,
          };
        }),
      };
    },
    async explainJournal(engagementId, journal) {
      eng(engagementId);
      if (!s.firms[firmId()].firm.aiEnabled) throw new Error('AI assistance is turned off for your firm. A partner can turn it on in the firm details.');
      const dr = journal.lines.filter((l) => l.amount > 0).map((l) => l.account).join(', ');
      const cr = journal.lines.filter((l) => l.amount < 0).map((l) => l.account).join(', ');
      return {
        model: 'demo sample, not AI',
        whatItDoes: `Sample text. The entry debits ${dr || 'no account'} and credits ${cr || 'no account'}.`,
        whyFlagged: journal.flags.map((f) => `Sample text. ${f}: consider why this applies to journal ${journal.entryNo}.`),
        tests: ['Sample text. Agree the entry to its supporting document and to approval by someone other than the person who posted it.'],
        questions: ['Sample text. Who asked for this entry, and why was it needed?'],
      };
    },

    async explainMovement(engagementId, input) {
      eng(engagementId);
      if (!s.firms[firmId()].firm.aiEnabled) throw new Error('AI assistance is turned off for your firm. A partner can turn it on in the firm details.');
      const up = input.movement.change > 0;
      return {
        model: 'demo sample, not AI',
        consistency: `Sample text. ${input.movement.label} ${up ? 'rose' : 'fell'} against last year. Compare it with the lines it normally moves with.`,
        causes: [`Sample text. A change in volume or price could have ${up ? 'raised' : 'lowered'} ${input.movement.label.toLowerCase()}.`],
        questions: ['Sample text. What changed in the business during the year that explains this?'],
        corroboration: ['Sample text. Agree management’s explanation to a schedule, a contract or the monthly figures.'],
      };
    },

    async draftPolicy(engagementId, input) {
      eng(engagementId);
      if (!s.firms[firmId()].firm.aiEnabled) throw new Error('AI assistance is turned off for your firm. A partner can turn it on in the firm details.');
      return {
        model: 'demo sample, not AI',
        text: `${input.starter} [Sample addition: state the basis used for ${input.accounts[0] ?? 'these accounts'}.]`,
        toConfirm: ['Sample text. Confirm the rates, methods and useful lives with the client before using this wording.'],
      };
    },

    async listQuality() {
      return s.quality.filter((q) => q.firmId === firmId()).map(strip);
    },
    async addQuality(items) {
      partner();
      s.quality.push(...items.map((i) => ({ ...i, title: i.title.trim(), id: uid(), firmId: firmId(), updatedAt: new Date().toISOString() })));
      save();
    },
    async updateQuality(id, patch) {
      partner();
      const q = s.quality.find((x) => x.id === id && x.firmId === firmId());
      if (!q) throw new Error('That record was not found.');
      Object.assign(q, patch, { updatedAt: new Date().toISOString() });
      save();
    },
    async deleteQuality(id) {
      partner();
      const i = s.quality.findIndex((x) => x.id === id && x.firmId === firmId());
      if (i < 0 || s.quality[i].kind !== 'risk') throw new Error('Only a partner can remove a risk, and a finding cannot be removed.');
      s.quality.splice(i, 1);
      save();
    },
    async listEvaluations() {
      return s.evaluations.filter((e) => e.firmId === firmId()).map(strip).sort((a, b) => b.asAt.localeCompare(a.asAt) || b.createdAt.localeCompare(a.createdAt));
    },
    async addEvaluation(e) {
      const m = partner();
      if (!e.basis.trim()) throw new Error('Give the basis for the conclusion.');
      s.evaluations.push({ id: uid(), firmId: firmId(), asAt: e.asAt, conclusion: e.conclusion, basis: e.basis.trim(), concludedByName: m.fullName, createdAt: new Date().toISOString() });
      save();
    },

    async listRequests(id) {
      eng(id);
      return (s.requests[id] ?? []).map((r) => ({ ...r }));
    },
    async addRequests(id, items) {
      open(id);
      (s.requests[id] ??= []).push(...items.map((i) => ({ id: uid(), title: i.title.trim(), detail: i.detail.trim(), dueDate: i.dueDate, status: 'open' as const, note: '' })));
      log(id, 'client_requests', 'insert', { count: items.length });
      save();
    },
    async updateRequest(requestId, patch) {
      for (const [engId, list] of Object.entries(s.requests)) {
        const r = list.find((x) => x.id === requestId);
        if (!r) continue;
        open(engId);
        Object.assign(r, patch);
        log(engId, 'client_requests', 'update', { title: r.title, status: r.status });
        save();
        return;
      }
    },
    async deleteRequest(requestId) {
      for (const [engId, list] of Object.entries(s.requests)) {
        const i = list.findIndex((x) => x.id === requestId);
        if (i < 0) continue;
        open(engId);
        const [gone] = list.splice(i, 1);
        log(engId, 'client_requests', 'delete', { title: gone.title });
        save();
        return;
      }
    },
    async listLinks(id) {
      eng(id);
      return (s.links[id] ?? []).map(({ token: _t, ...l }) => l);
    },
    async createLink(id, label, days) {
      open(id);
      const token = newToken();
      (s.links[id] ??= []).push({ id: uid(), token, label: label.trim(), expiresAt: new Date(Date.now() + days * 86400000).toISOString(), revoked: false, lastUsedAt: null });
      log(id, 'request_links', 'insert', { label });
      save();
      return token;
    },
    async revokeLink(linkId) {
      for (const [engId, list] of Object.entries(s.links)) {
        const l = list.find((x) => x.id === linkId);
        if (!l) continue;
        l.revoked = true;
        log(engId, 'request_links', 'update', { label: l.label, revoked: true });
        save();
        return;
      }
    },
    // The client's side needs no sign-in, so these do not go through eng() or open().
    async portalView(token) {
      for (const [engId, list] of Object.entries(s.links)) {
        const l = list.find((x) => x.token === token && !x.revoked && x.expiresAt > new Date().toISOString());
        if (!l) continue;
        const e = s.engagements.find((x) => x.id === engId);
        if (!e) return null;
        if (e.status === 'in_progress') l.lastUsedAt = new Date().toISOString();
        save();
        return {
          firm: s.firms[e.firmId]?.firm.name ?? '',
          client: s.clients.find((c) => c.id === e.clientId)?.name ?? '',
          yearEnd: e.yearEnd,
          closed: e.status !== 'in_progress',
          folder: `${e.firmId}/${e.id}`,
          requests: (s.requests[engId] ?? []).map((r) => ({
            ...r,
            files: (s.evidence[engId] ?? []).filter((x) => x.fromClient && x.refId === r.id).map((x) => ({ name: x.fileName, at: x.createdAt })),
          })),
        } satisfies PortalView;
      }
      return null;
    },
    async portalUpload(token, view, requestId, file) {
      const engId = view.folder.split('/')[1];
      const l = (s.links[engId] ?? []).find((x) => x.token === token && !x.revoked && x.expiresAt > new Date().toISOString());
      const e = s.engagements.find((x) => x.id === engId);
      if (!l || !e) throw new Error('This link is no longer valid.');
      if (e.status === 'locked') throw new LockedError();
      const r = (s.requests[engId] ?? []).find((x) => x.id === requestId);
      if (!r) throw new Error('That request is not on this list.');
      const path = `${view.folder}/p_${token}_${uid()}`;
      blobs.set(path, URL.createObjectURL(file));
      (s.evidence[engId] ??= []).push({ id: uid(), path, fileName: file.name, size: file.size, refType: 'request', refId: requestId, note: '', uploadedByName: l.label, createdAt: new Date().toISOString(), fromClient: true, page: null });
      if (r.status === 'open' || r.status === 'returned') r.status = 'received';
      (s.log[engId] ??= []).push({ id: uid(), at: new Date().toISOString(), table: 'evidence', action: 'insert', userId: null, detail: { file: file.name, from_client: l.label } });
      save();
    },

    async sign(id) {
      const e = open(id);
      const f = s.firms[firmId()];
      const m = f.members.find((x) => x.userId === me().id)!;
      if (m.role !== 'partner') throw new Error('Only an engagement partner can sign.');
      if (stateOf(firmId()) !== 'active' && !(e as any).payPer)
        throw new Error('A file can be signed once it is paid for. A partner can choose a plan, or pay for this one engagement, under Billing.');
      const lines = s.lines[id] ?? [];
      if (lines.length === 0) throw new Error('No trial balance has been imported.');
      const posted = (s.adjustments[id] ?? []).filter((a) => a.posted).flatMap((a) => a.lines);
      if (lines.reduce((a, l) => a + l.balance, 0) + posted.reduce((a, j) => a + j.amount, 0) !== 0)
        throw new Error('The trial balance does not foot.');
      if (lines.some((l) => !l.mapCode)) throw new Error('Some accounts are not mapped.');
      e.status = 'locked';
      e.signedByName = m.fullName;
      e.signedByFrc = m.frcNumber;
      e.firmFrc = f.firm.frcNumber;
      e.signedAt = new Date().toISOString();
      for (const a of ((s as any).amendments?.[id] ?? []) as Amendment[]) if (!a.resignedAt) Object.assign(a, { resignedByName: e.signedByName, resignedAt: e.signedAt });
      log(id, 'engagements', 'update', { status: 'locked' });
      save();
    },
    async reopen(id, kind, reason, effect) {
      const e = eng(id);
      const f = s.firms[firmId()];
      const m = f.members.find((x) => x.userId === me().id)!;
      if (m.role !== 'partner') throw new Error('Only an engagement partner can reopen a signed file.');
      if (e.status !== 'locked') throw new Error('This file is not signed, so there is nothing to reopen.');
      if (reason.trim().length < 20) throw new Error('Give the specific reason for reopening the file, in at least 20 characters.');
      if (effect.trim().length < 10) throw new Error('Say what effect the change has on the conclusions reached.');
      const list = (((s as any).amendments ??= {})[id] ??= []) as Amendment[];
      list.push({
        id: uid(),
        kind,
        reason: reason.trim(),
        effect: effect.trim(),
        reopenedByName: m.fullName,
        reopenedAt: new Date().toISOString(),
        previousSignedByName: e.signedByName,
        previousSignedAt: e.signedAt,
        previousReport: { ...e.report },
        resignedByName: null,
        resignedAt: null,
      });
      const { signedReport: _signed, ...report } = e.report;
      Object.assign(e, { status: 'in_progress', signedByName: null, signedByFrc: null, firmFrc: null, signedAt: null, report });
      log(id, 'engagements', 'update', { status: 'in_progress', reopened: kind, reason: reason.trim() });
      save();
    },
    async listAmendments(id) {
      eng(id);
      return [...(((s as any).amendments?.[id] ?? []) as Amendment[])];
    },
    async listLog(id, page) {
      eng(id);
      const all = [...(s.log[id] ?? [])].reverse();
      return { entries: page ? all.slice(page.offset, page.offset + page.limit) : all, total: all.length };
    },
  };
}
