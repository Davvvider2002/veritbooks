import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GlEntry } from '../engine/ledger';
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
  payPer: !!r.pay_per,
  groupAddon: !!r.group_addon,
});
const toClient = (r: any): Client => ({ id: r.id, name: r.name, rcNumber: r.rc_number, sector: r.sector });
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
  if (needs0006(error)) throw new Error(UPDATE_0006);
  throw new Error(error.message);
}

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

export function createSupabaseRepo(url: string, key: string): Repo {
  const db: SupabaseClient = createClient(url, key);

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
      return u ? { id: u.id, email: u.email ?? '' } : null;
    },
    onAuthChange(cb) {
      const { data } = db.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      fail(error);
    },
    async signUp(email, password) {
      // Send the confirmation link back to whichever site the user signed up on.
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      fail(error);
      return !data.session;
    },
    async signOut() {
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
          payments: (b.payments ?? []).map((p: any) => ({ id: p.id, kind: p.kind ?? 'plan', plan: p.plan, engagementType: p.engagement_type ?? null, withGroup: !!p.with_group, amountKobo: p.amount_kobo, vatKobo: p.vat_kobo ?? 0, creditKobo: p.credit_kobo ?? 0, founding: p.founding, source: p.source ?? 'flutterwave', paidAt: p.paid_at, coversUntil: p.covers_until, reference: p.tx_ref, receiptNo: p.receipt_no ?? null })),
        },
        firm: { id: firm.id, name: firm.name, frcNumber: firm.frc_number, address: firm.address, aiEnabled: !!firm.ai_enabled },
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
      const { error } = await db.from('firm_invites').insert({ firm_id: await firmId(), email: email.trim().toLowerCase(), role });
      if (error && /duplicate key/i.test(error.message)) throw new Error('This email has already been invited.');
      if (error && /row-level security/i.test(error.message)) throw new Error('Only a partner can invite.');
      fail(error);
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
      const { data, error } = await db.rpc('my_invites');
      fail(error);
      return ((data as any[]) ?? []).map((r) => ({ id: r.id, firmName: r.firm_name, role: r.role }));
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
        })
        .select()
        .single();
      fail(error);
      return toEngagement(data);
    },
    async getEngagement(id) {
      const { data, error } = await db.from('engagements').select('*').eq('id', id).maybeSingle();
      fail(error);
      return data ? toEngagement(data) : null;
    },
    async updateEngagement(id, patch) {
      const { error } = await db.from('engagements').update(patch).eq('id', id);
      fail(error);
    },

    async listLines(id) {
      const { data, error } = await db.from('tb_lines').select('*').eq('engagement_id', id).order('code');
      fail(error);
      return (data ?? []).map(toLine);
    },
    async replaceLines(id, lines) {
      // Upsert by account code so accounts keep their id and journals stay attached,
      // then remove accounts that are no longer in the trial balance.
      const { error } = await db.from('tb_lines').upsert(
        lines.map((l) => ({
          engagement_id: id,
          code: l.code,
          name: l.name,
          balance: l.balance,
          prior_balance: l.prior,
          map_code: l.mapCode,
          nature: l.nature,
        })),
        { onConflict: 'engagement_id,code' },
      );
      fail(error);
      const keep = new Set(lines.map((l) => l.code));
      const { data: existing, error: e2 } = await db.from('tb_lines').select('id, code').eq('engagement_id', id);
      fail(e2);
      const gone = (existing ?? []).filter((r) => !keep.has(r.code)).map((r) => r.id);
      if (gone.length) {
        const { error: e3 } = await db.from('tb_lines').delete().in('id', gone);
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

    async isAdmin() {
      const { data, error } = await db.rpc('is_platform_admin');
      if (error) return false;
      return data === true;
    },
    async adminOverview() {
      const { data, error } = await db.rpc('admin_overview');
      fail(error);
      return data as AdminData;
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
    async listLog(id) {
      const { data, error } = await db
        .from('audit_log')
        .select('*')
        .eq('engagement_id', id)
        .order('id', { ascending: false })
        .limit(200);
      fail(error);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        at: r.at,
        table: r.table_name,
        action: r.action,
        userId: r.user_id,
        detail: r.detail,
      }));
    },
  };
}
