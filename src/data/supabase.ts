import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BREACHED_MESSAGE, isBreached } from '../engine/breached';
import { normaliseMobile } from '../engine/phone';
import type { GlEntry } from '../engine/ledger';
import type { AdminPartners, PartnerMe, PartnerProgramme } from '../engine/partners';
import type { Adjustment, Nature, TbLine } from '../engine/types';
import { hashToken, LockedError, opensAtPage, MAX_EVIDENCE_BYTES, newToken, type AdminData, type BankAccount, type ClientRequest, type RequestLink, type QualityEvaluation, type QualityItem, type Client, type Engagement, type Evidence, type Invite, type Member, type Repo, type StoredBankLine } from './repo';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toEngagement = (r: any): Engagement => ({
  id: r.id,
  clientId: r.client_id,
  type: r.type,
  yearEnd: r.year_end,
  status: r.status,
  planning: r.planning ?? {},
  programme: r.programme ?? {},
  programmeVersion: r.programme_version ?? '',
  report: r.report ?? {},
  testing: r.testing ?? {},
  disclosures: r.disclosures ?? {},
  signedByName: r.signed_by_name,
  signedByFrc: r.signed_by_frc,
  firmFrc: r.firm_frc,
  signedAt: r.signed_at,
  fileNo: r.file_no ?? '',
  currency: r.currency ?? 'NGN',
  payPer: !!r.pay_per,
  groupAddon: !!r.group_addon,
});
const toClient = (r: any): Client => ({ id: r.id, name: r.name, rcNumber: r.rc_number, sector: r.sector, logo: r.logo ?? null, logoPlacement: r.logo_placement ?? 'centre' });
const toMember = (r: any): Member => ({
  userId: r.user_id,
  role: r.role,
  fullName: r.full_name,
  frcNumber: r.frc_number,
});
const toRequest = (r: any): ClientRequest => ({
  id: r.id,
  title: r.title,
  detail: r.detail ?? '',
  dueDate: r.due_date ?? null,
  status: r.status,
  note: r.note ?? '',
});
const toLine = (r: any): TbLine => ({
  id: r.id,
  code: r.code,
  name: r.name,
  balance: Number(r.balance),
  prior: r.prior_balance === null ? null : Number(r.prior_balance),
  prior2: r.prior2_balance === null || r.prior2_balance === undefined ? null : Number(r.prior2_balance),
  prior3: r.prior3_balance === null || r.prior3_balance === undefined ? null : Number(r.prior3_balance),
  prior4: r.prior4_balance === null || r.prior4_balance === undefined ? null : Number(r.prior4_balance),
  mapCode: r.map_code,
  nature: r.nature,
});

/** True when the database has not had migration 0006 applied: its columns and values are unknown. */
const needs0006 = (error: { message: string } | null) =>
  !!error && /period|evidence_ref_type_check|'page'|column .*page|evidence\.page/i.test(error.message);
const UPDATE_0006 = 'This needs a database update. Run supabase/migrations/0006_prior_ledger_and_pages.sql in the Supabase SQL editor, then reload this page.';

function fail(error: { message: string } | null): void {
  if (!error) return;
  if (/signed and locked/i.test(error.message)) throw new LockedError();
  // Only reached when the session could not be renewed: the sign-in itself has run out.
  if (/jwt expired|"exp" claim|token is expired/i.test(error.message)) throw new Error('Your session has ended. Sign out and sign in again to carry on. Nothing you saved has been lost.');
  if (needs0006(error)) throw new Error(UPDATE_0006);
  if (/email rate limit|over_email_send_rate_limit/i.test(error.message)) throw new Error('VeritBooks has sent too many sign-in emails in the last hour. Please try again in an hour with the same email address.');
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(error.message)) throw new Error(OFFLINE);
  if (/adjustments_ref_idx|adjustments.*duplicate key/i.test(error.message)) throw new Error('Another journal on this file already uses that reference. Choose a different reference.');
  throw new Error(error.message);
}

const OFFLINE = 'VeritBooks could not be reached. Check the internet connection and try again. This last action was not saved.';
const PAGE = 1000;
/** The API returns at most 1,000 rows a request, so large tables are read page by page. */
async function fetchAll(page: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>) {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    fail(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
const CHUNK = 500;

/** The working paper columns, saved key by key. */
const MERGED = ['planning', 'programme', 'testing', 'disclosures', 'report'] as const;
/** Each engagement's working papers as last read from the database, to tell what this person changed. */
const loaded = new Map<string, Record<string, unknown>>();
/** Set when the database does not yet have migration 0023. */
let noMerge = false;
const remember = (r: any) => loaded.set(r.id, Object.fromEntries(MERGED.map((f) => [f, structuredClone(r[f] ?? {})])));

export function createSupabaseRepo(url: string, key: string): Repo {
  // A reset link, or an invitation to a new colleague, brings the visitor back signed in with
  // "type=recovery" or "type=invite" in the address. Either way they choose a password first.
  // That is noted before the client tidies the address away, and kept for this browser tab.
  const RECOVER = 'veritbooks.recovering';
  if (/type=(recovery|invite)/.test(window.location.hash + window.location.search)) sessionStorage.setItem(RECOVER, '1');
  // A token expires an hour after it is issued. The client renews it on a timer, but a laptop
  // that slept or a tab the browser throttled can wake with a lapsed token and send it before the
  // timer runs, and the server answers "JWT expired". Every request goes through this fetch: when
  // the server refuses an expired token, the session is renewed once and the request sent again
  // with the new one, so the person never sees the error.
  let db: SupabaseClient;
  let renewing: Promise<string | null> | null = null;
  const renew = () =>
    (renewing ??= db.auth
      .refreshSession()
      .then(({ data }) => data.session?.access_token ?? null, () => null)
      .finally(() => setTimeout(() => (renewing = null), 0)));
  const EXPIRED = /jwt expired|"exp" claim|token is expired|invalid jwt/i;
  const fetchRenewing: typeof fetch = async (input, init) => {
    const res = await fetch(input, init);
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // Sign-in and renewal requests are left alone, or a failed renewal would loop.
    if (href.includes('/auth/v1/') || (res.status !== 401 && res.status !== 403 && res.status !== 400)) return res;
    const text = await res.clone().text().catch(() => '');
    if (!EXPIRED.test(text)) return res;
    const token = await renew();
    if (!token) return res;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input instanceof Request ? input.url : input, { ...init, method: init?.method ?? (input instanceof Request ? input.method : undefined), headers });
  };
  db = createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true }, global: { fetch: fetchRenewing } });
  // Coming back to the tab renews a token that lapsed while it was hidden or the machine slept.
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      void db.auth.getSession().then(({ data }) => {
        const exp = data.session?.expires_at;
        if (data.session && exp && exp * 1000 - Date.now() < 120_000) void renew();
      });
    });

  /** Calls the assist function, which holds the AI service key. The browser never sees it. */
  const assist = async (body: Record<string, unknown>) => {
    const { data, error } = await db.functions.invoke('assist', { body });
    if (error) {
      // The function explains a refusal in its response body.
      const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(reply?.error ?? 'AI assistance could not be reached. Check that the assist function is deployed.');
    }
    if (!data?.result) throw new Error(data?.error ?? 'The AI service did not return an answer.');
    return data as { result: any; model: string };
  };

  /** Calls the billing function, which holds the payment provider's secret key. */
  const billing = async (body: Record<string, unknown>) => {
    const { data, error } = await db.functions.invoke('billing', { body });
    if (error) {
      const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(reply?.error ?? 'Payments could not be reached. Check that the billing function is deployed.');
    }
    return data as Record<string, unknown>;
  };

  const mfaFn = async (body: Record<string, unknown>) => {
    const { data, error } = await db.functions.invoke('mfa', { body });
    if (error) {
      const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(reply?.error ?? 'Two-factor authentication could not be changed just now.');
    }
    return data as Record<string, unknown>;
  };

  const firmId = async () => {
    const { data, error } = await db.from('firm_members').select('firm_id').limit(1).maybeSingle();
    fail(error);
    if (!data) throw new Error('Set up your firm first.');
    return data.firm_id as string;
  };

  return {
    mode: 'supabase',
    async currentUser() {
      const { data } = await db.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '', invitedTo: (u.user_metadata?.invited_to as string | undefined) || null, mobile: (u.user_metadata?.phone as string | undefined) || null } : null;
    },
    onAuthChange(cb) {
      const { data } = db.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') sessionStorage.setItem(RECOVER, '1');
        if (event === 'SIGNED_OUT') sessionStorage.removeItem(RECOVER);
        cb();
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      fail(error);
    },
    async signUp(email, password, mobile) {
      const m = normaliseMobile(mobile);
      if (!m.ok) throw new Error(m.message);
      if (await isBreached(password)) throw new Error(BREACHED_MESSAGE);
      // Send the confirmation link back to whichever site the user signed up on.
      const { data, error } = await db.auth.signUp({
        email,
        password,
        // A partner's confirmation link opens the partner portal.
        options: { emailRedirectTo: window.location.origin + (window.location.pathname.startsWith('/partners') ? '/partners' : ''), data: { phone: m.value } },
      });
      fail(error);
      return !data.session;
    },
    async setMyMobile(mobile) {
      const m = normaliseMobile(mobile);
      if (!m.ok) throw new Error(m.message);
      const { error } = await db.auth.updateUser({ data: { phone: m.value } });
      fail(error);
    },
    async adminUserContacts() {
      const { data, error } = await db.rpc('admin_user_contacts');
      if (error && /admin_user_contacts|PGRST202/i.test(error.message)) return [];
      fail(error);
      return (data as { id: string; mobile: string | null }[] | null) ?? [];
    },
    async requestPasswordReset(email) {
      // The link returns to the front door, which is already an allowed address.
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      fail(error);
    },
    recovering() {
      return sessionStorage.getItem(RECOVER) === '1';
    },
    async setPassword(password) {
      if (await isBreached(password)) throw new Error(BREACHED_MESSAGE);
      const { error } = await db.auth.updateUser({ password });
      fail(error);
      sessionStorage.removeItem(RECOVER);
    },
    async signOut() {
      sessionStorage.removeItem(RECOVER);
      const { error } = await db.auth.signOut();
      fail(error);
    },

    async workspace() {
      const { data: s } = await db.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return null;
      const { data: members, error } = await db.from('firm_members').select('*');
      fail(error);
      const mine = (members ?? []).find((m) => m.user_id === userId);
      if (!mine) return null;
      const { data: firm, error: e2 } = await db.from('firms').select('*').eq('id', mine.firm_id).single();
      fail(e2);
      const { data: b, error: e3 } = await db.rpc('billing_overview');
      if (e3 && /billing_overview/.test(e3.message)) throw new Error('Plans and payments need a database update. Run supabase/migrations/0009_billing.sql in the Supabase SQL editor.');
      fail(e3);
      return {
        billing: {
          state: b.state,
          vatPercent: Number(b.vat_percent ?? 0),
          country: b.country ?? 'NG',
          currency: b.currency ?? 'NGN',
          taxLabel: b.tax_label ?? 'VAT',
          chargeCurrency: b.charge_currency ?? b.currency ?? 'NGN',
          chargeRate: Number(b.charge_rate ?? 1),
          canChangeCountry: b.can_change_country ?? false,
          suspendedReason: b.suspended_reason ?? '',
          foundingAgreedAt: b.founding_agreed_at ?? null,
          foundingAgreedBy: b.founding_agreed_by ?? null,
          engagementPrices: (b.engagement_prices ?? []).map((x: any) => ({ code: x.code, name: x.name, priceKobo: x.price_kobo })),
          credits: (b.credits ?? []).map((x: any) => ({ id: x.id, type: x.type, withGroup: x.with_group })),
          openEngagements: (b.open_engagements ?? []).map((x: any) => ({ id: x.id, client: x.client, type: x.type, yearEnd: x.year_end, payPer: x.pay_per, groupAddon: x.group_addon })),
          seller: { name: b.seller?.name ?? 'VeritBooks', address: b.seller?.address ?? '', taxId: b.seller?.tax_id ?? '', supportEmail: b.seller?.support_email ?? '' },
          plan: b.plan,
          planName: b.plan_name,
          trialEndsAt: b.trial_ends_at,
          paidUntil: b.paid_until,
          foundingNumber: b.founding_number,
          priceLockUntil: b.price_lock_until,
          foundingLeft: b.founding_left,
          engagementsUsed: b.engagements_used,
          maxEngagements: b.max_engagements,
          users: b.users,
          maxUsers: b.max_users,
          plans: (b.plans ?? []).map((p: any) => ({ code: p.code, name: p.name, maxUsers: p.max_users, maxEngagements: p.max_engagements, listKobo: p.list_kobo, amountKobo: p.amount_kobo, founding: p.founding, creditKobo: p.credit_kobo ?? 0, mode: p.mode ?? 'new' })),
          payments: (b.payments ?? []).map((p: any) => ({ id: p.id, kind: p.kind ?? 'plan', plan: p.plan, engagementType: p.engagement_type ?? null, withGroup: !!p.with_group, amountKobo: p.amount_kobo, vatKobo: p.vat_kobo ?? 0, currency: p.currency ?? 'NGN', quotedCurrency: p.quoted_currency ?? null, quotedKobo: p.quoted_kobo ?? null, quotedVatKobo: p.quoted_vat_kobo ?? null, fxRate: p.fx_rate === null || p.fx_rate === undefined ? null : Number(p.fx_rate), creditKobo: p.credit_kobo ?? 0, founding: p.founding, source: p.source ?? 'flutterwave', paidAt: p.paid_at, coversUntil: p.covers_until, reference: p.tx_ref, receiptNo: p.receipt_no ?? null })),
        },
        firm: { id: firm.id, name: firm.name, frcNumber: firm.frc_number, address: firm.address, country: firm.country ?? 'NG', aiEnabled: !!firm.ai_enabled, branding: firm.branding ?? {}, fileNumbering: { mode: firm.file_numbering?.mode === 'auto' ? 'auto' : 'manual', pattern: firm.file_numbering?.pattern ?? '' }, nextFileNo: firm.next_file_no ?? 1 },
        me: toMember(mine),
        members: (members ?? []).filter((m) => m.firm_id === mine.firm_id).map(toMember),
      };
    },
    async createFirm(f) {
      const { error } = await db.rpc('create_firm', {
        p_name: f.name,
        p_frc_number: f.frcNumber,
        p_address: f.address,
        p_full_name: f.fullName,
        p_member_frc: f.memberFrc,
        p_country: f.country,
      });
      fail(error);
    },
    async updateFirm(patch) {
      const { data, error } = await db
        .from('firms')
        .update({ name: patch.name, frc_number: patch.frcNumber, address: patch.address })
        .eq('id', await firmId())
        .select('id');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can change firm details.');
    },
    async updateMyProfile(patch) {
      const { error } = await db.rpc('update_my_profile', { p_full_name: patch.fullName, p_frc_number: patch.frcNumber });
      if (!error) return;
      // Before the team update is applied to the database, only partners can change their details.
      const { data: s } = await db.auth.getSession();
      const direct = await db
        .from('firm_members')
        .update({ full_name: patch.fullName, frc_number: patch.frcNumber })
        .eq('user_id', s.session!.user.id)
        .select('user_id');
      fail(direct.error);
      if (!direct.data?.length) throw new Error('Your details could not be saved. The database needs the team update.');
    },

    async listInvites() {
      const { data, error } = await db.from('firm_invites').select('*').order('created_at');
      fail(error);
      return (data ?? []).map((r): Invite => ({ id: r.id, email: r.email, role: r.role, accepted: !!r.accepted_at }));
    },
    async createInvite(email, role) {
      const { data, error } = await db.from('firm_invites').insert({ firm_id: await firmId(), email: email.trim().toLowerCase(), role }).select('id').single();
      if (error && /duplicate key/i.test(error.message)) throw new Error('This email has already been invited. Use Resend below.');
      if (error && /row-level security/i.test(error.message)) throw new Error('Only a partner can invite.');
      fail(error);
      return data!.id as string;
    },
    async sendInvite(id) {
      const { data, error } = await db.functions.invoke('invite', { body: { inviteId: id } });
      if (error) {
        const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(reply?.error ?? 'The invitation email could not be sent. The invitation is saved: ask your colleague to create an account with this email address.');
      }
      return (data as { message: string }).message;
    },
    async deleteInvite(id) {
      const { error } = await db.from('firm_invites').delete().eq('id', id);
      fail(error);
    },
    async setMemberRole(userId, role) {
      const { data, error } = await db.from('firm_members').update({ role }).eq('user_id', userId).select('user_id');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can change roles.');
    },
    async removeMember(userId) {
      const { data, error } = await db.from('firm_members').delete().eq('user_id', userId).select('user_id');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can remove a member.');
    },
    async myInvites() {
      const { data, error } = await db.rpc('my_invite_details');
      if (!error)
        return ((data as any[]) ?? []).map((r) => ({ id: r.id, firmName: r.firm_name, role: r.role, country: r.country, address: r.address, firmLicence: r.firm_licence, invitedBy: r.invited_by }));
      // A database without migration 0020 still lists the invitation, with the firm's name only.
      const old = await db.rpc('my_invites');
      fail(old.error);
      return ((old.data as any[]) ?? []).map((r) => ({ id: r.id, firmName: r.firm_name, role: r.role }));
    },
    async acceptInvite(id, fullName, frcNumber) {
      const { error } = await db.rpc('accept_invite', { p_invite: id, p_full_name: fullName, p_frc_number: frcNumber });
      fail(error);
    },

    async listClients() {
      const { data, error } = await db.from('clients').select('*').order('name');
      fail(error);
      return (data ?? []).map(toClient);
    },
    async createClient(c) {
      const { data, error } = await db
        .from('clients')
        .insert({ firm_id: await firmId(), name: c.name, rc_number: c.rcNumber, sector: c.sector })
        .select()
        .single();
      fail(error);
      return toClient(data);
    },
    async listEngagements() {
      const { data, error } = await db.from('engagements').select('*').order('year_end', { ascending: false });
      fail(error);
      (data ?? []).forEach(remember);
      return (data ?? []).map(toEngagement);
    },
    async createEngagement(e) {
      const { data, error } = await db
        .from('engagements')
        .insert({
          firm_id: await firmId(),
          client_id: e.clientId,
          type: e.type,
          year_end: e.yearEnd,
          programme_version: e.programmeVersion,
          file_no: e.fileNo?.trim() ?? '',
          ...(e.currency ? { currency: e.currency } : {}),
        })
        .select()
        .single();
      if (error && /engagements_file_no_idx/.test(error.message)) throw new Error('Another engagement in your firm already uses that file number.');
      fail(error);
      return toEngagement(data);
    },
    async getEngagement(id) {
      const { data, error } = await db.from('engagements').select('*').eq('id', id).maybeSingle();
      fail(error);
      if (data) remember(data);
      return data ? toEngagement(data) : null;
    },
    async updateEngagement(id, patch) {
      const { fileNo, ...rest } = patch;
      // The working paper columns are saved as the keys this person changed, merged into what is
      // stored, so a colleague's sign-off saved a moment ago is kept rather than overwritten.
      const known = loaded.get(id);
      for (const field of MERGED) {
        const next = (rest as Record<string, unknown>)[field] as Record<string, unknown> | undefined;
        if (next === undefined || !known || noMerge) continue;
        const was = (known[field] ?? {}) as Record<string, unknown>;
        const set: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(next)) if (v !== undefined && JSON.stringify(v) !== JSON.stringify(was[k])) set[k] = v;
        const unset = Object.keys(was).filter((k) => next[k] === undefined);
        if (Object.keys(set).length || unset.length) {
          const { error } = await db.rpc('merge_engagement', { p_engagement: id, p_field: field, p_set: set, p_unset: unset });
          if (error && /merge_engagement|function .* does not exist|PGRST202/i.test(error.message)) {
            noMerge = true; // before migration 0023: saved whole below, as before
            continue;
          }
          fail(error);
          // The base stays as last read, matching what the screen holds until it reloads, so a
          // second save before the reload cannot remove what the first one added.
        }
        delete (rest as Record<string, unknown>)[field];
      }
      if (Object.keys(rest).length === 0 && fileNo === undefined) return;
      const row: Record<string, unknown> = { ...rest };
      if (fileNo !== undefined) row.file_no = fileNo.trim();
      const { error } = await db.from('engagements').update(row).eq('id', id);
      if (error && /engagements_file_no_idx|duplicate key/.test(error.message)) throw new Error('Another engagement in your firm already uses that file number.');
      fail(error);
    },
    async updateClient(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.rcNumber !== undefined) row.rc_number = patch.rcNumber.trim();
      if (patch.sector !== undefined) row.sector = patch.sector;
      if (patch.logo !== undefined) row.logo = patch.logo;
      if (patch.logoPlacement !== undefined) row.logo_placement = patch.logoPlacement;
      const { data, error } = await db.from('clients').update(row).eq('id', id).select('id');
      fail(error);
      if (!data?.length) throw new Error('The client could not be changed.');
    },
    async setBranding(b) {
      const { error } = await db.rpc('set_firm_branding', { p: b });
      fail(error);
    },
    async setFileNumbering(mode, pattern, next) {
      const { error } = await db.rpc('set_file_numbering', { p_mode: mode, p_pattern: pattern, p_next: next });
      fail(error);
    },

    async listLines(id) {
      const rows = await fetchAll((from, to) => db.from('tb_lines').select('*').eq('engagement_id', id).order('code').order('id').range(from, to));
      return rows.map(toLine);
    },
    async replaceLines(id, lines) {
      // Upsert by account code so accounts keep their id and journals stay attached,
      // then remove accounts that are no longer in the trial balance.
      const rows = lines.map((l) => ({
        engagement_id: id,
        code: l.code,
        name: l.name,
        balance: l.balance,
        prior_balance: l.prior,
        prior2_balance: l.prior2 ?? null,
        prior3_balance: l.prior3 ?? null,
        prior4_balance: l.prior4 ?? null,
        map_code: l.mapCode,
        nature: l.nature,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await db.from('tb_lines').upsert(rows.slice(i, i + CHUNK), { onConflict: 'engagement_id,code' });
        fail(error);
      }
      const keep = new Set(lines.map((l) => l.code));
      const existing = await fetchAll((from, to) => db.from('tb_lines').select('id, code').eq('engagement_id', id).order('id').range(from, to));
      const gone = existing.filter((r) => !keep.has(r.code)).map((r) => r.id as string);
      // A few hundred ids a request keeps the address within the server's limit.
      for (let i = 0; i < gone.length; i += 200) {
        const { error: e3 } = await db.from('tb_lines').delete().in('id', gone.slice(i, i + 200));
        fail(e3);
      }
    },
    async setMapping(_id, clientId, line, mapCode, nature) {
      const { error } = await db.from('tb_lines').update({ map_code: mapCode, nature }).eq('id', line.id);
      fail(error);
      if (mapCode) {
        const { error: e2 } = await db.from('client_account_maps').upsert({
          client_id: clientId,
          account_code: line.code,
          map_code: mapCode,
          nature,
          updated_at: new Date().toISOString(),
        });
        fail(e2);
      }
    },
    async savedMappings(clientId) {
      const { data, error } = await db.from('client_account_maps').select('*').eq('client_id', clientId);
      fail(error);
      return new Map(
        (data ?? []).map((r) => [r.account_code as string, { mapCode: r.map_code as string, nature: r.nature as Nature | null }]),
      );
    },

    async listAdjustments(id) {
      const { data, error } = await db.from('adjustments').select('*').eq('engagement_id', id).order('created_at');
      fail(error);
      return (data ?? []).map(
        (r): Adjustment => ({ id: r.id, ref: r.ref, description: r.description, posted: r.posted, lines: r.lines ?? [] }),
      );
    },
    async addAdjustment(id, a) {
      const { error } = await db
        .from('adjustments')
        .insert({ engagement_id: id, ref: a.ref, description: a.description, posted: a.posted, lines: a.lines });
      fail(error);
    },
    async deleteAdjustment(adjId) {
      const { error } = await db.from('adjustments').delete().eq('id', adjId);
      fail(error);
    },

    async listLedger(id, period = 'current') {
      const read = (byYear: boolean) =>
        fetchAll((from, to) => {
          const q = db.from('gl_entries').select('entry_no, entry_date, account_code, description, amount, posted_by').eq('engagement_id', id);
          return (byYear ? q.eq('period', period) : q).order('row_no').range(from, to);
        });
      // Before migration 0006 every line belongs to the current year, and no prior year can be held.
      const rows = await read(true).catch((e) => {
        if (e instanceof Error && e.message === UPDATE_0006 && period === 'current') return read(false);
        throw e;
      });
      return rows.map(
        (r): GlEntry => ({
          entryNo: r.entry_no,
          date: r.entry_date,
          accountCode: r.account_code,
          description: r.description,
          amount: Number(r.amount),
          user: r.posted_by,
        }),
      );
    },
    async replaceLedger(id, entries, period = 'current') {
      let { error } = await db.from('gl_entries').delete().eq('engagement_id', id).eq('period', period);
      if (needs0006(error) && period === 'current') ({ error } = await db.from('gl_entries').delete().eq('engagement_id', id));
      fail(error);
      try {
      for (let i = 0; i < entries.length; i += CHUNK) {
        const { error: e2 } = await db.from('gl_entries').insert(
          entries.slice(i, i + CHUNK).map((e, j) => ({
            engagement_id: id,
            entry_no: e.entryNo,
            entry_date: e.date,
            account_code: e.accountCode,
            description: e.description,
            amount: e.amount,
            posted_by: e.user,
            row_no: i + j + 1,
            ...(period === 'prior' ? { period } : {}),
          })),
        );
        fail(e2);
      }
      } catch (e) {
        // Do not leave a ledger half imported: the tests would run on part of the year.
        await db.from('gl_entries').delete().eq('engagement_id', id).eq('period', period);
        throw new Error(`The ledger import stopped part way and was undone, so no part of it is kept. Import the file again. (${e instanceof Error ? e.message : String(e)})`);
      }
    },
    async listBankAccounts(id) {
      const { data, error } = await db.from('bank_accounts').select('*').eq('engagement_id', id).order('created_at');
      fail(error);
      return (data ?? []).map(
        (r): BankAccount => ({
          id: r.id,
          name: r.name,
          accountCode: r.account_code,
          opening: r.opening === null ? null : Number(r.opening),
          closing: Number(r.closing),
          breaks: r.breaks,
          fileName: r.file_name,
        }),
      );
    },
    async listBankLines(id) {
      const rows = await fetchAll((from, to) =>
        db.from('bank_lines').select('bank_account_id, txn_date, description, amount, balance').eq('engagement_id', id).order('bank_account_id').order('row_no').range(from, to),
      );
      return rows.map(
        (r): StoredBankLine => ({
          accountId: r.bank_account_id,
          date: r.txn_date,
          description: r.description,
          amount: Number(r.amount),
          balance: r.balance === null ? null : Number(r.balance),
        }),
      );
    },
    async addBankStatement(id, account, lines) {
      const { data, error } = await db
        .from('bank_accounts')
        .insert({
          engagement_id: id,
          name: account.name,
          account_code: account.accountCode,
          opening: account.opening,
          closing: account.closing,
          breaks: account.breaks,
          file_name: account.fileName,
        })
        .select('id')
        .single();
      fail(error);
      try {
        for (let i = 0; i < lines.length; i += CHUNK) {
          const { error: e2 } = await db.from('bank_lines').insert(
            lines.slice(i, i + CHUNK).map((l, j) => ({
              bank_account_id: data!.id,
              engagement_id: id,
              txn_date: l.date,
              description: l.description,
              amount: l.amount,
              balance: l.balance,
              row_no: i + j + 1,
            })),
          );
          fail(e2);
        }
      } catch (e) {
        // Do not leave a statement half imported.
        await db.from('bank_accounts').delete().eq('id', data!.id);
        throw e;
      }
    },
    async deleteBankAccount(accountId) {
      const { error } = await db.from('bank_accounts').delete().eq('id', accountId);
      fail(error);
    },

    async listEvidence(id) {
      const { data, error } = await db.from('evidence').select('*').eq('engagement_id', id).order('created_at');
      fail(error);
      return (data ?? []).map(
        (r): Evidence => ({
          id: r.id,
          path: r.path,
          fileName: r.file_name,
          size: Number(r.size_bytes),
          refType: r.ref_type,
          refId: r.ref_id,
          note: r.note,
          uploadedByName: r.uploaded_by_name,
          createdAt: r.created_at,
          fromClient: !!r.from_client,
          page: r.page ?? null,
        }),
      );
    },
    async addEvidence(id, file, meta) {
      const ext = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1]?.toLowerCase();
      const path = `${await firmId()}/${id}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`;
      const up = await db.storage.from('evidence').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      fail(up.error);
      const { error } = await db.from('evidence').insert({
        engagement_id: id,
        path,
        file_name: file.name,
        size_bytes: file.size,
        mime: file.type,
        ref_type: meta.refType,
        ref_id: meta.refId,
        note: meta.note,
        uploaded_by_name: meta.uploadedByName,
        ...(meta.page ? { page: meta.page } : {}),
      });
      if (error) {
        // Do not leave a stored file that the engagement does not list.
        await db.storage.from('evidence').remove([path]);
        fail(error);
      }
    },
    async deleteEvidence(e) {
      const { error } = await db.from('evidence').delete().eq('id', e.id);
      fail(error);
      const rm = await db.storage.from('evidence').remove([e.path]);
      fail(rm.error);
    },
    async setEvidencePage(e, page) {
      const { error } = await db.from('evidence').update({ page }).eq('id', e.id);
      fail(error);
    },
    async evidenceUrl(e) {
      // Only a PDF is shown in the browser, so it can open at its page. Everything else downloads.
      const inline = opensAtPage(e);
      const { data, error } = await db.storage.from('evidence').createSignedUrl(e.path, 120, inline ? undefined : { download: e.fileName });
      fail(error);
      return inline ? `${data!.signedUrl}#page=${e.page}` : data!.signedUrl;
    },

    async publicPrices(country) {
      const { data, error } = await db.rpc('public_prices', { p_country: country ?? 'NG' });
      fail(error);
      if (!data) throw new Error('That country is not open for new firms yet.');
      return {
        country: data.country ?? 'NG',
        currency: data.currency ?? 'NGN',
        chargeCurrency: data.charge_currency ?? data.currency ?? 'NGN',
        taxLabel: data.tax_label ?? 'VAT',
        countries: data.countries ?? [{ code: 'NG', name: 'Nigeria', currency: 'NGN' }],
        plans: (data.plans ?? []).map((p: any) => ({ code: p.code, name: p.name, priceKobo: p.price_kobo, maxUsers: p.max_users, maxEngagements: p.max_engagements })),
        engagementPrices: (data.engagement_prices ?? []).map((p: any) => ({ code: p.code, name: p.name, priceKobo: p.price_kobo })),
        vatPercent: Number(data.vat_percent ?? 0),
        foundingLeft: data.founding_left ?? 0,
        supportEmail: data.support_email ?? '',
      };
    },
    async adminStatus() {
      const { data, error } = await db.rpc('admin_status');
      if (error) return { admin: false, verified: false, enrolled: false };
      if (!data?.admin) return { admin: false, verified: false, enrolled: false };
      const { data: f } = await db.auth.mfa.listFactors();
      return { admin: true, verified: data.aal === 'aal2', enrolled: (f?.totp ?? []).some((x) => x.status === 'verified') };
    },
    async mfaEnroll() {
      // A set-up that was started and never finished is cleared first, or Supabase refuses a second one.
      const { data: list } = await db.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status !== 'verified') await db.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `VeritBooks admin ${new Date().toISOString().slice(0, 10)}` });
      fail(error);
      return { factorId: data!.id, qr: data!.totp.qr_code || null, secret: data!.totp.secret };
    },
    async mfaVerify(factorId, code) {
      let id = factorId;
      if (!id) {
        const { data } = await db.auth.mfa.listFactors();
        id = data?.totp.find((f) => f.status === 'verified')?.id ?? null;
        if (!id) throw new Error('No authenticator is set up for this account.');
      }
      const { data: ch, error: e1 } = await db.auth.mfa.challenge({ factorId: id });
      fail(e1);
      const { error } = await db.auth.mfa.verify({ factorId: id, challengeId: ch!.id, code: code.trim() });
      if (error) throw new Error(/invalid|expired|code/i.test(error.message) ? 'That code is not right. Codes change every 30 seconds: check the clock on your phone and try the current one.' : error.message);
    },
    async adminResetTwoFactor(userId) {
      await mfaFn({ action: 'reset', userId });
    },
    async mfaStatus() {
      const [{ data: f }, { data: a }] = await Promise.all([db.auth.mfa.listFactors(), db.auth.mfa.getAuthenticatorAssuranceLevel()]);
      return { enrolled: (f?.totp ?? []).some((x) => x.status === 'verified'), verified: a?.currentLevel === 'aal2' };
    },
    async mfaDisable() {
      const { data } = await db.auth.mfa.listFactors();
      for (const f of data?.all ?? []) {
        const { error } = await db.auth.mfa.unenroll({ factorId: f.id });
        fail(error);
      }
      await db.auth.refreshSession();
    },
    async createBackupCodes() {
      const { data, error } = await db.rpc('create_backup_codes');
      fail(error);
      return data as string[];
    },
    async backupCodesLeft() {
      const { data, error } = await db.rpc('backup_codes_left');
      fail(error);
      return data as number;
    },
    async recoverWithBackupCode(code) {
      const r = await mfaFn({ action: 'recover', code });
      await db.auth.refreshSession();
      return r.message as string;
    },
    async isAdmin() {
      const { data, error } = await db.rpc('is_platform_admin');
      if (error) return false;
      return data === true;
    },
    async setFirmCountry(country) {
      const { error } = await db.rpc('set_firm_country', { p_country: country });
      fail(error);
    },
    async adminOverview() {
      const { data, error } = await db.rpc('admin_overview');
      fail(error);
      return data as AdminData;
    },
    async adminFxRate(price, charge) {
      const d = await billing({ action: 'rate', price, charge });
      return Number(d.rate);
    },
    async partnerProgramme() {
      const { data, error } = await db.rpc('partner_programme');
      fail(error);
      return data as PartnerProgramme;
    },
    async partnerClick(code, campaign, path, country) {
      const { data, error } = await db.rpc('partner_click', { p_code: code, p_campaign: campaign, p_path: path, p_country: country });
      fail(error);
      return !!data;
    },
    async partnerLookup(code) {
      const { data, error } = await db.rpc('partner_lookup', { p_code: code });
      fail(error);
      return (data as { name: string } | null) ?? null;
    },
    async claimReferral(code, campaign) {
      const { data, error } = await db.rpc('claim_referral', { p_code: code, p_campaign: campaign });
      fail(error);
      return data as { name: string };
    },
    async partnerApply(p) {
      const { error } = await db.rpc('partner_apply', { p });
      fail(error);
    },
    async partnerMe() {
      const { data, error } = await db.rpc('partner_me');
      fail(error);
      return (data as PartnerMe | null) ?? null;
    },
    async partnerUpdate(p) {
      const { error } = await db.rpc('partner_update', { p });
      fail(error);
    },
    async partnerRequestPayout(currency) {
      const { error } = await db.rpc('partner_request_payout', { p_currency: currency });
      fail(error);
    },
    async adminPartners() {
      const { data, error } = await db.rpc('admin_partners');
      fail(error);
      return data as AdminPartners;
    },
    async adminPartnerAct(action, args) {
      const { data, error } = await db.rpc('admin_partner_act', { p_action: action, p: args });
      fail(error);
      return (data ?? {}) as Record<string, unknown>;
    },
    async adminAct(action, args) {
      const { error } = await db.rpc('admin_act', { p_action: action, p: args });
      fail(error);
    },
    async startCheckout(checkout) {
      const d = await billing({ action: 'start', checkout });
      return { link: d.link as string };
    },
    async confirmPayment(transactionId) {
      return (await billing({ action: 'confirm', transactionId })).message as string;
    },

    async setAssist(enabled) {
      const { data, error } = await db.from('firms').update({ ai_enabled: enabled }).eq('id', await firmId()).select('id');
      if (error && /ai_enabled/.test(error.message)) throw new Error('AI assistance needs a database update. Run supabase/migrations/0008_assist.sql in the Supabase SQL editor.');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can change this setting.');
    },
    async suggestMappings(engagementId, accounts) {
      const r = await assist({ task: 'map_accounts', engagementId, accounts });
      return { suggestions: r.result.suggestions, model: r.model };
    },
    async explainJournal(engagementId, journal, context) {
      const r = await assist({ task: 'explain_journal', engagementId, journal, ...context });
      return { ...r.result, model: r.model };
    },

    async explainMovement(engagementId, input) {
      const r = await assist({ task: 'explain_movement', engagementId, ...input });
      return { ...r.result, model: r.model };
    },

    async draftPolicy(engagementId, input) {
      const r = await assist({ task: 'draft_policy', engagementId, policy: input });
      return { ...r.result, model: r.model };
    },

    async listQuality() {
      const { data, error } = await db.from('quality_items').select('*').order('created_at');
      fail(error);
      return (data ?? []).map(
        (r): QualityItem => ({
          id: r.id,
          kind: r.kind,
          component: r.component,
          title: r.title,
          detail: r.detail,
          response: r.response,
          owner: r.owner,
          status: r.status,
          severity: r.severity,
          dueDate: r.due_date,
          updatedAt: r.updated_at,
        }),
      );
    },
    async addQuality(items) {
      const firm = await firmId();
      const { error } = await db.from('quality_items').insert(
        items.map((i) => ({ firm_id: firm, kind: i.kind, component: i.component, title: i.title.trim(), detail: i.detail.trim(), response: i.response.trim(), owner: i.owner.trim(), status: i.status, severity: i.severity, due_date: i.dueDate })),
      );
      fail(error);
    },
    async updateQuality(id, patch) {
      const { dueDate, ...rest } = patch;
      const { data, error } = await db.from('quality_items').update({ ...rest, ...(dueDate !== undefined ? { due_date: dueDate } : {}) }).eq('id', id).select('id');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can change the quality register.');
    },
    async deleteQuality(id) {
      const { data, error } = await db.from('quality_items').delete().eq('id', id).select('id');
      fail(error);
      if (!data?.length) throw new Error('Only a partner can remove a risk, and a finding cannot be removed.');
    },
    async listEvaluations() {
      const { data, error } = await db.from('quality_evaluations').select('*').order('as_at', { ascending: false }).order('created_at', { ascending: false });
      fail(error);
      return (data ?? []).map((r): QualityEvaluation => ({ id: r.id, asAt: r.as_at, conclusion: r.conclusion, basis: r.basis, concludedByName: r.concluded_by_name, createdAt: r.created_at }));
    },
    async addEvaluation(e) {
      const { error } = await db.from('quality_evaluations').insert({ firm_id: await firmId(), as_at: e.asAt, conclusion: e.conclusion, basis: e.basis.trim() });
      fail(error);
    },

    async listRequests(id) {
      const { data, error } = await db.from('client_requests').select('*').eq('engagement_id', id).order('sort').order('created_at');
      fail(error);
      return (data ?? []).map(toRequest);
    },
    async addRequests(id, items) {
      const { count } = await db.from('client_requests').select('id', { count: 'exact', head: true }).eq('engagement_id', id);
      const { error } = await db.from('client_requests').insert(
        items.map((i, n) => ({ engagement_id: id, title: i.title.trim(), detail: i.detail.trim(), due_date: i.dueDate, sort: (count ?? 0) + n })),
      );
      fail(error);
    },
    async updateRequest(requestId, patch) {
      const { error } = await db.from('client_requests').update(patch).eq('id', requestId);
      fail(error);
    },
    async deleteRequest(requestId) {
      const { error } = await db.from('client_requests').delete().eq('id', requestId);
      fail(error);
    },
    async listLinks(id) {
      const { data, error } = await db.from('request_links').select('id, label, expires_at, revoked_at, last_used_at').eq('engagement_id', id).order('created_at');
      fail(error);
      return (data ?? []).map((r): RequestLink => ({ id: r.id, label: r.label, expiresAt: r.expires_at, revoked: !!r.revoked_at, lastUsedAt: r.last_used_at }));
    },
    async createLink(id, label, days) {
      const token = newToken();
      const { error } = await db.from('request_links').insert({
        engagement_id: id,
        token_hash: await hashToken(token),
        label: label.trim(),
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      });
      fail(error);
      return token;
    },
    async revokeLink(linkId) {
      const { error } = await db.from('request_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId);
      fail(error);
    },
    async portalView(token) {
      const { data, error } = await db.rpc('portal_view', { p_token: token });
      fail(error);
      if (!data) return null;
      const v = data as any;
      return {
        firm: v.firm,
        client: v.client,
        yearEnd: v.year_end,
        closed: v.closed,
        folder: v.folder,
        requests: (v.requests as any[]).map((r) => ({ ...toRequest(r), files: r.files })),
      };
    },
    async portalUpload(token, view, requestId, file) {
      if (file.size > MAX_EVIDENCE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
      const ext = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1]?.toLowerCase();
      const path = `${view.folder}/p_${token}_${crypto.randomUUID()}${ext ? '.' + ext : ''}`;
      const up = await db.storage.from('evidence').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) throw new Error('The file could not be uploaded. The link may have expired.');
      const { error } = await db.rpc('portal_attach', {
        p_token: token,
        p_request: requestId,
        p_path: path,
        p_file_name: file.name,
        p_size: file.size,
        p_mime: file.type,
      });
      fail(error);
    },

    async sign(id) {
      const { error } = await db.rpc('sign_engagement', { p_engagement: id });
      fail(error);
    },
    async reopen(id, kind, reason, effect) {
      const { error } = await db.rpc('reopen_engagement', { p_engagement: id, p_kind: kind, p_reason: reason, p_effect: effect });
      fail(error);
    },
    async listAmendments(id) {
      const { data, error } = await db.from('engagement_amendments').select('*').eq('engagement_id', id).order('reopened_at');
      // Before migration 0022 the table is missing: there is simply no history yet.
      if (error && /engagement_amendments/.test(error.message)) return [];
      fail(error);
      return (data ?? []).map((r: any) => ({
        id: r.id,
        kind: r.kind,
        reason: r.reason,
        effect: r.effect,
        reopenedByName: r.reopened_by_name,
        reopenedAt: r.reopened_at,
        previousSignedByName: r.previous_signed_by_name,
        previousSignedAt: r.previous_signed_at,
        previousReport: r.previous_report ?? {},
        resignedByName: r.resigned_by_name,
        resignedAt: r.resigned_at,
      }));
    },
    async listLog(id, page) {
      const toEntry = (r: any) => ({ id: String(r.id), at: r.at, table: r.table_name, action: r.action, userId: r.user_id, detail: r.detail });
      if (!page) {
        const rows = await fetchAll((from, to) => db.from('audit_log').select('*').eq('engagement_id', id).order('id', { ascending: false }).range(from, to));
        return { entries: rows.map(toEntry), total: rows.length };
      }
      const { data, error, count } = await db
        .from('audit_log')
        .select('*', { count: 'exact' })
        .eq('engagement_id', id)
        .order('id', { ascending: false })
        .range(page.offset, page.offset + page.limit - 1);
      fail(error);
      return { entries: (data ?? []).map(toEntry), total: count ?? data?.length ?? 0 };
    },
  };
}
