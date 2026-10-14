// VeritBooks mfa function. Removes an authenticator in the two cases where its owner cannot:
//   1. { action: 'recover', code }   The owner has lost their phone and gives one of their backup codes.
//   2. { action: 'reset', userId }   A platform admin, past their own second factor, clears another admin's.
// Either way the person then signs in with their password, and sets up a new authenticator if
// they want one (an admin must). Removing a factor needs the service role, so it happens here.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const refuse = (message: string, status = 400) => json({ error: message }, status);

async function clearFactors(admin: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw error;
  let n = 0;
  for (const f of data?.factors ?? []) {
    const { error: e } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (e) throw e;
    n++;
  }
  return n;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refuse('Use POST.', 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return refuse('Sign in first.', 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => null);

  try {
    if (body?.action === 'recover') {
      // Checked and used up by the database, as this user, with its limit on wrong tries.
      const { data: ok, error } = await asUser.rpc('use_backup_code', { p_code: String(body.code ?? '').slice(0, 40) });
      if (error) return refuse(error.message);
      if (ok !== true) return refuse('That backup code is not right, or has been used.');
      await clearFactors(admin, who.user.id);
      return json({ message: 'Two-factor authentication has been turned off for your account. Turn it on again with your new phone in Firm details.' });
    }

    if (body?.action === 'reset') {
      const target = String(body.userId ?? '');
      // is_platform_admin is true only for an admin who has passed their own second factor.
      const { data: isAdmin } = await asUser.rpc('is_platform_admin');
      if (isAdmin !== true) return refuse('Not found.', 404);
      if (target === who.user.id) return refuse('You cannot reset your own two-factor authentication. Ask another admin.');
      const { data: row } = await admin.from('platform_admins').select('user_id').eq('user_id', target).is('removed_at', null).maybeSingle();
      if (!row) return refuse('That person is not an admin.');
      const n = await clearFactors(admin, target);
      const { data: u } = await admin.auth.admin.getUserById(target);
      await admin.from('admin_log').insert({ admin_id: who.user.id, action: 'reset_two_factor', detail: { admin: u?.user?.email ?? target, factors: n } });
      return json({ message: 'Two-factor reset. They set up a new authenticator at their next sign-in.' });
    }
  } catch (e) {
    console.log('mfa function failed:', String(e));
    return refuse('Two-factor authentication could not be changed just now. Try again shortly.', 502);
  }
  return refuse('Unknown request.');
});
