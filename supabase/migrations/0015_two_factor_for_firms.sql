-- VeritBooks: optional two-factor authentication for firm users, and backup codes.
-- Run once, after 0014. Nothing is removed.
--
-- Anyone who turns on two-factor must pass it at every sign-in. Until they do, the database
-- treats them as outside their firm: every row the firm owns is hidden from that session,
-- and signing, paying and changing the firm's settings are refused. Someone who has not
-- turned it on signs in as before.

-- True when this session has passed the second factor, or its user has not turned one on.
create function private.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

-- Every row-level rule in the app goes through these two, so this one change covers them all.
create or replace function private.is_member(p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = p_firm and m.user_id = (select auth.uid())
  ) and (select private.mfa_ok());
$$;

create or replace function private.is_partner(p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = p_firm and m.user_id = (select auth.uid()) and m.role = 'partner'
  ) and (select private.mfa_ok());
$$;

create function private.require_mfa() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.mfa_ok() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = 'P0001';
  end if;
end;
$$;

-- The functions that find the caller's firm themselves, rather than through the rules above,
-- check the second factor first.
alter function public.sign_engagement(uuid) rename to sign_engagement_inner;
create function public.sign_engagement(p_engagement uuid) returns public.engagements
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_mfa();
  return public.sign_engagement_inner(p_engagement);
end;
$$;

alter function public.billing_checkout(jsonb) rename to billing_checkout_vat;
create function public.billing_checkout(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_mfa();
  return public.billing_checkout_vat(p);
end;
$$;

alter function public.billing_overview() rename to billing_overview_vat;
create function public.billing_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_mfa();
  return public.billing_overview_vat();
end;
$$;

alter function public.set_firm_branding(jsonb) rename to set_firm_branding_inner;
create function public.set_firm_branding(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_mfa();
  perform public.set_firm_branding_inner(p);
end;
$$;

alter function public.set_file_numbering(text, text, integer) rename to set_file_numbering_inner;
create function public.set_file_numbering(p_mode text, p_pattern text, p_next integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_mfa();
  perform public.set_file_numbering_inner(p_mode, p_pattern, p_next);
end;
$$;

-- ---------------------------------------------------------------------------
-- Backup codes. Ten single-use codes, shown once when made. Only their hashes are kept.
-- A backup code does not open the account by itself: it removes the lost authenticator
-- (through the mfa function), and the person signs in with their password as before.
-- ---------------------------------------------------------------------------

create table public.mfa_backup_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  retired_at timestamptz
);
create index mfa_backup_codes_user_idx on public.mfa_backup_codes (user_id);
create table public.mfa_backup_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ok boolean not null,
  at timestamptz not null default now()
);
alter table public.mfa_backup_codes enable row level security;
alter table public.mfa_backup_attempts enable row level security;
revoke all on public.mfa_backup_codes, public.mfa_backup_attempts from anon, authenticated;

create function private.code_hash(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

-- Makes ten new codes and retires the old ones. Needs a session that has passed the second factor.
create function public.create_backup_codes() returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_codes text[] := '{}';
  v_code text;
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Enter the code from your authenticator app first.' using errcode = 'P0001';
  end if;
  update public.mfa_backup_codes set retired_at = now() where user_id = auth.uid() and used_at is null and retired_at is null;
  for i in 1..10 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    insert into public.mfa_backup_codes (user_id, code_hash) values (auth.uid(), private.code_hash(v_code));
    v_codes := v_codes || v_code;
  end loop;
  return v_codes;
end;
$$;

create function public.backup_codes_left() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.mfa_backup_codes where user_id = auth.uid() and used_at is null and retired_at is null;
$$;

-- Uses up one backup code. At most 5 wrong tries an hour.
create function public.use_backup_code(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.mfa_backup_attempts where user_id = auth.uid() and not ok and at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many wrong backup codes. Try again in an hour.' using errcode = 'P0001';
  end if;
  select id into v_id from public.mfa_backup_codes
  where user_id = auth.uid() and used_at is null and retired_at is null and code_hash = private.code_hash(p_code)
  limit 1 for update;
  insert into public.mfa_backup_attempts (user_id, ok) values (auth.uid(), v_id is not null);
  if v_id is null then return false; end if;
  update public.mfa_backup_codes set used_at = now() where id = v_id;
  -- The rest are retired with the authenticator they backed up.
  update public.mfa_backup_codes set retired_at = now() where user_id = auth.uid() and used_at is null and retired_at is null;
  return true;
end;
$$;

revoke execute on function public.sign_engagement_inner(uuid), public.billing_checkout_vat(jsonb), public.billing_overview_vat(),
  public.set_firm_branding_inner(jsonb), public.set_file_numbering_inner(text, text, integer) from public, anon, authenticated;
revoke execute on function public.sign_engagement(uuid), public.billing_checkout(jsonb), public.billing_overview(),
  public.set_firm_branding(jsonb), public.set_file_numbering(text, text, integer),
  public.create_backup_codes(), public.backup_codes_left(), public.use_backup_code(text) from public, anon;
grant execute on function public.sign_engagement(uuid), public.billing_checkout(jsonb), public.billing_overview(),
  public.set_firm_branding(jsonb), public.set_file_numbering(text, text, integer),
  public.create_backup_codes(), public.backup_codes_left(), public.use_backup_code(text) to authenticated;
grant execute on all functions in schema private to authenticated;
