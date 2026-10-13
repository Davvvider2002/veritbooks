// VeritBooks invite function. Emails a colleague the link to join a firm.
//
// The invitation itself is a row in firm_invites, made by a partner. This function only
// sends the email for one of those rows, after checking that the caller is a partner of
// the firm that made it. The email comes from Supabase Auth, so no other mail service is
// needed. Someone new gets "You have been invited", and sets a password from the link.
// Someone who already has an account gets a sign-in link instead.
//
// Secrets: SITE_URL, optional. Where the link returns to. Defaults to https://veritbooks.netlify.app
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const refuse = (message: string, status = 400) => json({ error: message }, status);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refuse('Use POST.', 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return refuse('Sign in first.', 401);

  const body = await req.json().catch(() => null);
  const id = String(body?.inviteId ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return refuse('Unknown invitation.');
  // Read as the caller, so the firm's own rules decide what they can see.
  const { data: invite } = await asUser.from('firm_invites').select('id, firm_id, email, role, accepted_at').eq('id', id).maybeSingle();
  if (!invite) return refuse('Unknown invitation.', 404);
  if (invite.accepted_at) return refuse('This colleague has already joined.');
  const { data: me } = await asUser.from('firm_members').select('role').eq('firm_id', invite.firm_id).eq('user_id', who.user.id).maybeSingle();
  if (me?.role !== 'partner') return refuse('Only a partner can send invitations.', 403);

  const site = (Deno.env.get('SITE_URL') || 'https://veritbooks.netlify.app').replace(/\/+$/, '');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: firm } = await admin.from('firms').select('name').eq('id', invite.firm_id).maybeSingle();
  const sent = await admin.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: site,
    data: { invited_to: firm?.name ?? '', invited_role: invite.role },
  });
  if (!sent.error) return json({ sent: 'invite', message: `Invitation emailed to ${invite.email}.` });

  if (/already|registered|exists/i.test(sent.error.message)) {
    // They have an account already. A sign-in link brings them to the invitation.
    const link = await createClient(url, anon).auth.signInWithOtp({ email: invite.email, options: { shouldCreateUser: false, emailRedirectTo: site } });
    if (!link.error) return json({ sent: 'signin', message: `${invite.email} already has an account. A sign-in link was emailed. The invitation is waiting for them when they sign in.` });
    return refuse(`The email could not be sent: ${link.error.message}`, 502);
  }
  if (/rate limit/i.test(sent.error.message))
    return refuse('Too many emails have been sent in the last hour. The invitation is saved. Try sending it again later, or ask your colleague to create an account with this email address.', 429);
  return refuse(`The email could not be sent: ${sent.error.message}`, 502);
});
