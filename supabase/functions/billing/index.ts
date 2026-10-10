// VeritBooks billing function. Takes payment for a plan through Flutterwave.
//
// Secrets, set in Supabase under Edge Functions:
//   FLW_SECRET_KEY    required. The Flutterwave secret key (starts FLWSECK).
//   FLW_WEBHOOK_HASH  required for webhooks. The "secret hash" typed into Flutterwave's webhook settings.
//   SITE_URL          optional. Where the customer returns after paying. Defaults to https://veritbooks.netlify.app
//   RESEND_API_KEY    optional. With it, receipts and reminders are emailed through Resend (resend.com).
//   MAIL_FROM         needed with RESEND_API_KEY. The sender, on a domain verified in Resend,
//                     for example: VeritBooks <billing@yourdomain.com>
//
// Four kinds of request arrive here:
//   1. { action: 'start', checkout }           from a signed-in partner. Returns a Flutterwave checkout link.
//   2. { action: 'confirm', transactionId }    from a signed-in member, after Flutterwave sends them back.
//   3. Flutterwave's own webhook, recognised by its verif-hash header.
//   4. The daily reminder run, started by the database scheduler, recognised by its x-cron-token header.
// A plan is only ever activated after this function has asked Flutterwave directly
// whether the payment succeeded, and the amount, currency and reference all match.
// Nothing the browser says about a payment is trusted.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const refuse = (message: string, status = 400) => json({ error: message }, status);
const FLW = 'https://api.flutterwave.com/v3';

/** Compares two secrets without leaking where they differ. */
function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);


const site = () => (Deno.env.get('SITE_URL') || 'https://veritbooks.netlify.app').replace(/\/+$/, '');
const naira = (kobo: number) => 'NGN ' + (Math.round(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Sends one email through Resend. Does nothing, and says so, when email is not set up. */
async function mail(to: string[], subject: string, lines: string[]): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  const list = to.filter((t) => /^[^@\s]+@[^@\s]+$/.test(t));
  if (!key || !from || !list.length) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: list,
      subject,
      text: lines.join('\n'),
      html: `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1c1c1a;max-width:560px">${lines.map((l) => (l ? `<p style="margin:0 0 12px">${esc(l)}</p>` : '')).join('')}</div>`,
    }),
  });
  if (!res.ok) console.log('email not sent:', res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

/** What a payment was for, in words. */
function describe(r: any): string {
  if (r.kind === 'plan') return `${r.plan} plan, one year${r.founding ? ' (founding firm price)' : ''}`;
  if (r.kind === 'group') return 'Group consolidation for one engagement';
  return `One ${r.engagement_type} engagement${r.with_group ? ' with group consolidation' : ''}`;
}

async function sendReceipt(txRef: string) {
  const { data: r } = await admin().rpc('payment_receipt', { p_tx_ref: txRef });
  if (!r?.to) return;
  const s = r.seller ?? {};
  await mail([r.to], `Receipt ${r.receipt_no} from ${s.name || 'VeritBooks'}`, [
    `Thank you. We have received your payment.`,
    `Receipt number: ${r.receipt_no}`,
    `Date: ${day(r.paid_at)}`,
    `Paid by: ${r.firm}`,
    `For: ${describe(r)}`,
    ...(r.credit_kobo > 0 ? [`Credit for the unused part of your previous plan: ${naira(r.credit_kobo)}`] : []),
    `Amount paid: ${naira(r.amount_kobo)}`,
    ...(r.covers_until ? [`Your plan runs until ${day(r.covers_until)}.`] : []),
    `Payment reference: ${r.tx_ref}`,
    '',
    `You can print this receipt at any time from the Billing page: ${site()}/billing`,
    [s.name, s.address, s.tax_id].filter(Boolean).join(' · '),
    s.support_email ? `Questions? Write to ${s.support_email}.` : '',
  ]);
}

const NOTICES: Record<string, (n: any) => { subject: string; lines: string[] }> = {
  trial_ending: (n) => ({
    subject: `Your VeritBooks trial ends on ${day(n.at)}`,
    lines: [`The free trial for ${n.name} ends on ${day(n.at)}.`, `Choose a plan before then and your team carries on without a break. If you do nothing, your work is kept exactly as it is and becomes read-only.`],
  }),
  trial_ended: (n) => ({
    subject: 'Your VeritBooks trial has ended',
    lines: [`The free trial for ${n.name} ended on ${day(n.at)}.`, `Nothing has been deleted. You can still open, read and print every file. Choose a plan, or pay for a single engagement, and work carries on from where it stopped.`],
  }),
  plan_30: (n) => ({
    subject: `Your VeritBooks plan renews on ${day(n.at)}`,
    lines: [`The ${n.plan} plan for ${n.name} runs until ${day(n.at)}.`, `Renewing early adds a year to the end of the current one, so you lose nothing by doing it now.`],
  }),
  plan_7: (n) => ({
    subject: `Your VeritBooks plan ends on ${day(n.at)}`,
    lines: [`The ${n.plan} plan for ${n.name} ends on ${day(n.at)}.`, `Renew before then to keep working. After that date your files stay safe and become read-only until the plan is renewed.`],
  }),
  plan_ended: (n) => ({
    subject: 'Your VeritBooks plan has ended',
    lines: [`The ${n.plan} plan for ${n.name} ended on ${day(n.at)}.`, `Nothing has been deleted. Your files are read-only until a partner renews the plan.`],
  }),
};

/** Sends each reminder that is due and has not been sent. */
async function remind(): Promise<{ due: number; sent: number }> {
  const db = admin();
  const { data } = await db.rpc('billing_due_notices');
  const due = (data ?? []) as any[];
  let sent = 0;
  for (const n of due) {
    const m = NOTICES[n.kind]?.(n);
    if (!m) continue;
    if (await mail(n.to ?? [], m.subject, [...m.lines, '', `Billing: ${site()}/billing`])) {
      await db.rpc('billing_notice_sent', { p_firm: n.firm, p_kind: n.kind, p_key: n.key });
      sent++;
    }
  }
  return { due: due.length, sent };
}

/** Asks Flutterwave about a transaction and, if it was paid in full, activates the plan. */
async function settle(secret: string, transactionId: string, firmId?: string): Promise<{ ok: boolean; message: string }> {
  if (!/^\d{1,20}$/.test(transactionId)) return { ok: false, message: 'That payment reference is not valid.' };
  const res = await fetch(`${FLW}/transactions/${transactionId}/verify`, { headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.json().catch(() => null);
  const t = body?.data;
  if (!res.ok || body?.status !== 'success' || !t) return { ok: false, message: 'Flutterwave could not find that payment.' };
  if (t.status !== 'successful') return { ok: false, message: `The payment was not completed (${String(t.status).slice(0, 30)}).` };
  const ref = String(t.tx_ref ?? '');
  const db = admin();
  if (firmId) {
    // A member can only confirm a payment that belongs to their own firm.
    const { data: pay } = await db.from('payments').select('firm_id').eq('tx_ref', ref).maybeSingle();
    if (!pay || pay.firm_id !== firmId) return { ok: false, message: 'That payment does not belong to your firm.' };
  }
  const { data, error } = await db.rpc('apply_payment', {
    p_tx_ref: ref,
    p_provider_id: String(t.id),
    p_amount_kobo: Math.round(Number(t.amount) * 100),
    p_currency: String(t.currency ?? ''),
  });
  if (error) return { ok: false, message: error.message };
  if (data === 'paid') await sendReceipt(ref).catch((e) => console.log('receipt email failed:', String(e)));
  return { ok: true, message: data === 'already' ? 'This payment was already applied.' : 'Payment received. Thank you.' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refuse('Use POST.', 405);
  const secret = Deno.env.get('FLW_SECRET_KEY');

  // 3. Flutterwave's webhook.
  const sent = req.headers.get('verif-hash');
  if (sent !== null) {
    const hash = Deno.env.get('FLW_WEBHOOK_HASH');
    if (!secret || !hash || !same(sent, hash)) return new Response('no', { status: 401 });
    const event = await req.json().catch(() => null);
    if (event?.event === 'charge.completed' && event?.data?.id != null && String(event.data.tx_ref ?? '').startsWith('vb-')) {
      const r = await settle(secret, String(event.data.id));
      if (!r.ok) console.log('webhook not applied:', r.message);
    }
    return new Response('ok', { status: 200 }); // acknowledged, so Flutterwave does not keep retrying
  }

  // 4. The daily reminder run.
  const cron = req.headers.get('x-cron-token');
  if (cron !== null) {
    const { data: ok } = await admin().rpc('cron_ok', { p_token: cron });
    if (ok !== true) return new Response('no', { status: 401 });
    return json(await remind());
  }

  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return refuse('Sign in first.', 401);
  if (!secret) return refuse('Payments are not set up yet. The Flutterwave secret key has not been added to the billing function.', 503);
  const body = await req.json().catch(() => null);

  // 1. Start a payment.
  if (body?.action === 'start') {
    // The price is worked out and recorded by the database, as this user. Only a partner gets past here.
    const checkout = body.checkout && typeof body.checkout === 'object' ? body.checkout : { kind: 'plan', plan: String(body.plan ?? '') };
    const { data: start, error } = await asUser.rpc('billing_checkout', { p: checkout });
    if (error) return refuse(error.message);
    const res = await fetch(`${FLW}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: start.tx_ref,
        amount: start.amount_kobo / 100,
        currency: 'NGN',
        redirect_url: `${site()}/billing`,
        customer: { email: who.user.email, name: start.firm },
        customizations: {
          title: 'VeritBooks',
          description: start.description,
        },
        meta: { kind: String(checkout.kind ?? 'plan') },
      }),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || out?.status !== 'success' || !out?.data?.link) {
      console.log('flutterwave refused:', res.status, out?.message);
      return refuse(`Flutterwave did not start the payment: ${String(out?.message ?? res.status).slice(0, 200)}`, 502);
    }
    return json({ link: out.data.link, amountKobo: start.amount_kobo });
  }

  // 2. Confirm a payment after the customer is sent back.
  if (body?.action === 'confirm') {
    const { data: member } = await asUser.from('firm_members').select('firm_id').eq('user_id', who.user.id).maybeSingle();
    if (!member) return refuse('Set up your firm first.', 403);
    const r = await settle(secret, String(body.transactionId ?? ''), member.firm_id);
    return r.ok ? json({ message: r.message }) : refuse(r.message);
  }

  return refuse('Unknown request.');
});
