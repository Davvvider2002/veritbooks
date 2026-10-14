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

-- If an admin loses their phone, another admin can clear their authenticator, and they set
-- up a new one at their next sign-in. Nobody can clear their own: that needs a second admin,
-- or the owner of the Supabase project.
create or replace function public.admin_reset_two_factor(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Not found.' using errcode = 'P0001';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot reset your own two-factor authentication. Ask another admin.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.platform_admins where user_id = p_user and removed_at is null) then
    raise exception 'That person is not an admin.' using errcode = 'P0001';
  end if;
  delete from auth.mfa_factors where user_id = p_user;
  insert into public.admin_log (admin_id, action, detail)
  values (auth.uid(), 'reset_two_factor', jsonb_build_object('admin', (select email from auth.users where id = p_user)));
end;
$$;
revoke execute on function public.admin_reset_two_factor(uuid) from public, anon;
grant execute on function public.admin_reset_two_factor(uuid) to authenticated;
