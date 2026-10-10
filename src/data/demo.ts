import type { GlEntry } from '../engine/ledger';
import { ENGAGEMENT_PRICES, FOUNDING_PLACES, PLANS, PRICE_HOLD_YEARS, TRIAL_DAYS, addYears, firmState, planQuote, type Plan, type Subscription } from '../engine/billing';
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
  settings: { seller_name: string; seller_address: string; tax_id: string; support_email: string };
  admins: string[];
  log: AdminData['log'];
  receipt: number;
}
export const DEMO_ADMIN = 'admin@veritbooks.demo';

interface Store {
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
  const planPayments = (sub: DemoSub) => sub.payments.filter((p) => p.kind === 'plan' && p.coversUntil).map((p) => ({ valueKobo: p.amountKobo + p.creditKobo, coversUntil: p.coversUntil! }));
  const billingOf = (id: string): Billing => {
    const sub = subOf(id);
    const now = new Date();
    const plan = limitsOf(id);
    const pl = platform();
    return {
      state: stateOf(id),
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
      plans: pl.plans.filter((p) => p.code !== 'trial').map((p) => ({ code: p.code as PlanCode, name: p.name, maxUsers: p.maxUsers, maxEngagements: p.maxEngagements, ...planQuote(sub, p, pl.plans, foundingTaken(), planPayments(sub), now) })),
      engagementPrices: pl.prices,
      credits: sub.credits ?? [],
      openEngagements: s.engagements
        .filter((e) => e.firmId === id && e.status === 'in_progress')
        .map((e) => ({ id: e.id, client: s.clients.find((c) => c.id === e.clientId)?.name ?? '', type: e.type, yearEnd: e.yearEnd, payPer: !!(e as any).payPer, groupAddon: !!(e as any).groupAddon })),
      seller: { name: pl.settings.seller_name, address: pl.settings.seller_address, taxId: pl.settings.tax_id, supportEmail: pl.settings.support_email },
      payments: [...sub.payments].reverse(),
    };
  };
  const isAdminUser = () => !!s.user && (s.user.email === DEMO_ADMIN || platform().admins.includes(s.user.email));
  const receipt = (sub: DemoSub, p: Omit<PaymentRecord, 'id' | 'paidAt' | 'reference' | 'receiptNo' | 'source'> & { source?: PaymentRecord['source']; reference?: string }) =>
    sub.payments.push({ id: uid(), paidAt: new Date().toISOString(), reference: 'demo-' + uid().slice(0, 8), source: 'flutterwave', ...p, receiptNo: ++platform().receipt });
  const makeFounding = (sub: DemoSub) => {
    const now = new Date();
    sub.foundingNumber = nextFounding();
    sub.priceLockUntil = addYears(now, PRICE_HOLD_YEARS);
    sub.lockedPrices = Object.fromEntries(platform().plans.filter((p) => p.code !== 'trial').map((p) => [p.code, p.priceKobo]));
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
    async signOut() {
      s.user = null;
      save();
      listeners.forEach((l) => l());
    },

    async workspace() {
      if (!s.user) return null;
      const f = s.firms[s.memberOf[s.user.id]];
      if (!f) return null;
      return { billing: billingOf(s.memberOf[s.user.id]), firm: f.firm, members: f.members, me: f.members.find((m) => m.userId === s.user!.id)! };
    },
    async createFirm(f) {
      if (s.memberOf[me().id]) throw new Error('You already belong to a firm.');
      const id = uid();
      s.firms[id] = {
        firm: { id, name: f.name.trim(), frcNumber: f.frcNumber.trim(), address: f.address.trim(), aiEnabled: false },
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
      s.invites.push({ id: uid(), firmId: firmId(), email: e, role, accepted: false });
      save();
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
        .map((i) => ({ id: i.id, firmName: s.firms[i.firmId]?.firm.name ?? '', role: i.role }));
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
      return e ? ({ ...strip(e), testing: e.testing ?? {}, disclosures: e.disclosures ?? {} } as Engagement) : null;
    },
    async updateEngagement(id, patch) {
      const e = open(id);
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
      const pl = platform();
      const done = { message: 'Demo mode: no money was taken. The payment is treated as made so you can see how it works.' };
      if (c.kind === 'plan') {
        const q = planQuote(sub, planBy(c.plan), pl.plans, foundingTaken(), planPayments(sub), new Date());
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
      const price = (code: string) => pl.prices.find((p) => p.code === code)!.priceKobo;
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

    async isAdmin() {
      return isAdminUser();
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
          suspended_reason: sub.suspendedReason ?? '', note: sub.note ?? '', ai_enabled: f.firm.aiEnabled,
          engagements: engs.length, signed: engs.filter((e) => e.status === 'locked').length, clients: s.clients.filter((c) => (c as any).firmId === id).length,
          credits: (sub.credits ?? []).length, paid_kobo: sub.payments.reduce((t, p) => t + p.amountKobo, 0), last_activity: null,
          members: f.members.map((m) => ({ name: m.fullName, role: m.role, email: emailOf(m.userId), joined: sub.createdAt ?? '' })),
        };
      });
      const payments = Object.entries(s.firms).flatMap(([id, f]) =>
        subOf(id).payments.map((p) => ({ id: p.id, firm: f.firm.name, firm_id: id, kind: p.kind, plan: p.plan, engagement_type: p.engagementType, with_group: p.withGroup, amount_kobo: p.amountKobo, credit_kobo: p.creditKobo, founding: p.founding, status: 'paid', source: p.source, note: p.source === 'manual' ? p.reference : '', tx_ref: p.reference, provider_id: null, receipt_no: p.receiptNo, created_at: p.paidAt, paid_at: p.paidAt })),
      ).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const month = new Date().toISOString().slice(0, 7);
      return {
        founding_taken: foundingTaken(),
        revenue_kobo: payments.reduce((t, p) => t + p.amount_kobo, 0),
        revenue_month_kobo: payments.filter((p) => p.created_at.startsWith(month)).reduce((t, p) => t + p.amount_kobo, 0),
        firms: firms.reverse(),
        users: Object.entries(s.accounts).map(([email, a]) => {
          const fid = s.memberOf[a.id];
          const m = fid ? s.firms[fid].members.find((x) => x.userId === a.id) : null;
          return { id: a.id, email, created_at: (a as any).createdAt ?? '', confirmed: true, last_sign_in_at: null, firm: fid ? s.firms[fid].firm.name : null, role: m?.role ?? null, name: m?.fullName ?? null, admin: email === DEMO_ADMIN || pl.admins.includes(email) };
        }).reverse(),
        payments,
        plans: pl.plans.map((p) => ({ code: p.code, name: p.name, price_kobo: p.priceKobo, max_users: p.maxUsers, max_engagements: p.maxEngagements })),
        engagement_prices: pl.prices.map((p) => ({ code: p.code, name: p.name, price_kobo: p.priceKobo })),
        settings: pl.settings,
        log: [...pl.log].reverse(),
      };
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
      if (action === 'extend_trial') {
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
      } else if (action === 'set_engagement_price') {
        const row = pl.prices.find((x) => x.code === p.code);
        const price = Math.round(Number(p.price_naira) * 100);
        if (!row) throw new Error('Price not found.');
        if (!(price > 0)) throw new Error('Give a price above zero.');
        row.priceKobo = price;
      } else if (action === 'settings') {
        pl.settings = { seller_name: String(p.seller_name ?? '').trim(), seller_address: String(p.seller_address ?? '').trim(), tax_id: String(p.tax_id ?? '').trim(), support_email: String(p.support_email ?? '').trim() };
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
      if (!m.frcNumber.trim()) throw new Error('Your FRC registration number is missing.');
      if (!f.firm.frcNumber.trim()) throw new Error("The firm's FRC registration number is missing.");
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
      log(id, 'engagements', 'update', { status: 'locked' });
      save();
    },
    async listLog(id) {
      eng(id);
      return [...(s.log[id] ?? [])].reverse();
    },
  };
}
