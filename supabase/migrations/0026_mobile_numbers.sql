-- 0026: a mobile number for every new account.
--
-- The number is given at sign-up and kept on the account (auth.users user metadata, "phone"),
-- in international form. Setting up a firm, joining one by invitation and applying as a
-- partner now each need it, so no new account goes without one. Accounts made before this
-- keep working; they are asked for a number the next time they reach one of those steps.
-- The platform owner sees each account's number in the admin console.

create or replace function private.require_mobile() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
begin
  select raw_user_meta_data ->> 'phone' into v_phone from auth.users where id = auth.uid();
  if coalesce(v_phone, '') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Add your mobile phone number, with the country code, to carry on.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function private.require_mobile() from public, anon;

-- Each step checks for the number first. The functions are patched in place.
do $$
declare
  v_fn regprocedure;
  v_def text;
begin
  for v_fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('create_firm', 'accept_invite', 'partner_apply')
  loop
    v_def := pg_get_functiondef(v_fn);
    if position('private.require_mobile()' in v_def) > 0 then continue; end if;
    if v_def !~ E'\\nbegin\\r?\\n' then raise exception '% is not as expected', v_fn; end if;
    execute regexp_replace(v_def, E'\\nbegin(\\r?\\n)', E'\nbegin\\1  perform private.require_mobile();\\1');
  end loop;
end;
$$;

-- Each account's mobile number, for the platform owner.
create or replace function public.admin_user_contacts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Not found.' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mobile', raw_user_meta_data ->> 'phone')) from auth.users), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_user_contacts() from public, anon;
grant execute on function public.admin_user_contacts() to authenticated;
