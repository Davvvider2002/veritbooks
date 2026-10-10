import type { GlEntry } from '../engine/ledger';
import type { Adjustment, Nature, TbLine } from '../engine/types';
import {
  LockedError,
  type BankAccount,
  type Client,
  type Engagement,
  type Evidence,
  type Invite,
  type Firm,
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
interface Store {
  user: User | null;
  accounts: Record<string, { id: string; password: string }>;
  firms: Record<string, { firm: Firm; members: Member[] }>; // keyed by firm id
  memberOf: Record<string, string>; // user id -> firm id
  clients: (Client & { firmId: string })[];
  engagements: (Engagement & { firmId: string })[];
  lines: Record<string, TbLine[]>;
  adjustments: Record<string, Adjustment[]>;
  maps: Record<string, Record<string, { mapCode: string; nature: Nature | null }>>;
  log: Record<string, LogEntry[]>;
  ledger: Record<string, GlEntry[]>;
  bankAccounts: Record<string, BankAccount[]>;
  bankLines: Record<string, StoredBankLine[]>;
  invites: (Invite & { firmId: string })[];
  evidence: Record<string, Evidence[]>;
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
  bankAccounts: {},
  bankLines: {},
  invites: [],
  evidence: {},
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
  const eng = (id: string) => {
    const e = s.engagements.find((x) => x.id === id && x.firmId === firmId());
    if (!e) throw new Error('Engagement not found.');
    return e;
  };
  const open = (id: string) => {
    const e = eng(id);
    if (e.status === 'locked') throw new LockedError();
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
      s.accounts[key] = { id: uid(), password };
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
      return { firm: f.firm, members: f.members, me: f.members.find((m) => m.userId === s.user!.id)! };
    },
    async createFirm(f) {
      if (s.memberOf[me().id]) throw new Error('You already belong to a firm.');
      const id = uid();
      s.firms[id] = {
        firm: { id, name: f.name.trim(), frcNumber: f.frcNumber.trim(), address: f.address.trim() },
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
      const row = {
        id: uid(),
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

    async listLedger(id) {
      eng(id);
      return s.ledger[id] ?? [];
    },
    async replaceLedger(id, entries) {
      open(id);
      if (s.ledger[id]?.length) log(id, 'gl_entries', 'remove', { rows: s.ledger[id].length });
      s.ledger[id] = entries;
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
    async evidenceUrl(e) {
      const url = blobs.get(e.path);
      if (!url) throw new Error('Demo mode keeps file contents only until the page is reloaded. Upload the file again.');
      return url;
    },

    async sign(id) {
      const e = open(id);
      const f = s.firms[firmId()];
      const m = f.members.find((x) => x.userId === me().id)!;
      if (m.role !== 'partner') throw new Error('Only an engagement partner can sign.');
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
