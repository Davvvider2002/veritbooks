// VeritBooks billing function. Takes payment for a plan through Flutterwave.
//
// Secrets, set in Supabase under Edge Functions:
//   FLW_SECRET_KEY    required. The Flutterwave secret key (starts FLWSECK).
//   FLW_WEBHOOK_HASH  required for webhooks. The "secret hash" typed into Flutterwave's webhook settings.
//   SITE_URL          optional. Where the customer returns after paying. Defaults to https://veritbooks.netlify.app
//
// Three kinds of request arrive here:
//   1. { action: 'start', plan }               from a signed-in partner. Returns a Flutterwave checkout link.
//   2. { action: 'confirm', transactionId }    from a signed-in member, after Flutterwave sends them back.
//   3. Flutterwave's own webhook, recognised by its verif-hash header.
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
  return { ok: true, message: data === 'already' ? 'This payment was already applied.' : 'Payment received. Your plan is active.' };
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

  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return refuse('Sign in first.', 401);
  if (!secret) return refuse('Payments are not set up yet. The Flutterwave secret key has not been added to the billing function.', 503);
  const body = await req.json().catch(() => null);

  // 1. Start a payment.
  if (body?.action === 'start') {
    // The price is worked out and recorded by the database, as this user. Only a partner gets past here.
    const { data: start, error } = await asUser.rpc('billing_start', { p_plan: String(body.plan ?? '') });
    if (error) return refuse(error.message);
    const site = (Deno.env.get('SITE_URL') || 'https://veritbooks.netlify.app').replace(/\/+$/, '');
    const res = await fetch(`${FLW}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: start.tx_ref,
        amount: start.amount_kobo / 100,
        currency: 'NGN',
        redirect_url: `${site}/billing`,
        customer: { email: who.user.email, name: start.firm },
        customizations: {
          title: 'VeritBooks',
          description: `${start.plan} plan, one year${start.founding ? ' (founding firm price)' : ''}`,
        },
        meta: { plan: String(body.plan), founding: start.founding },
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
