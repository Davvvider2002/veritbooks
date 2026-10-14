-- VeritBooks: platform admins must pass two-factor authentication. Run once, after 0013.
-- An admin signs in with a password, then a six-digit code from an authenticator app.
-- Supabase Auth records that second step in the session as aal2. Every admin function
-- checks it here, in the database, so a stolen password alone opens nothing.

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from public.platform_admins where user_id = auth.uid() and removed_at is null);
$$;

-- Tells the admin sign-in page where the caller stands, without opening anything.
-- An outsider learns only that they are not an admin.
create or replace function public.admin_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.platform_admins where user_id = auth.uid() and removed_at is null)
      then jsonb_build_object('admin', false)
    else jsonb_build_object('admin', true, 'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'))
  end;
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin();
$$;

revoke execute on function public.admin_status() from public, anon;
grant execute on function public.admin_status() to authenticated;


-- Resetting another admin's lost authenticator is done by the mfa Edge Function, which can
-- remove a factor with the service role. See supabase/functions/mfa.
