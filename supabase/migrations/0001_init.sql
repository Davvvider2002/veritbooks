-- Attest: phase 1 schema.
-- Every table is scoped to a firm and protected by row level security.
-- Amounts are bigint kobo, debit-positive.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  frc_number text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);

create table public.firm_members (
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('partner', 'manager', 'staff')),
  full_name text not null default '',
  frc_number text not null default '',
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
create index firm_members_user_idx on public.firm_members (user_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  rc_number text not null default '',
  sector text not null default 'General trading and services',
  created_at timestamptz not null default now()
);
create index clients_firm_idx on public.clients (firm_id);

-- Confirmed mappings, remembered per client so next year's import maps itself.
create table public.client_account_maps (
  client_id uuid not null references public.clients (id) on delete cascade,
  account_code text not null,
  map_code text not null,
  nature text check (nature in ('staff', 'depreciation', 'other')),
  updated_at timestamptz not null default now(),
  primary key (client_id, account_code)
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null check (type in ('audit', 'review', 'compilation')),
  framework text not null default 'ifrs_sme' check (framework in ('ifrs_sme')),
  year_end date not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'locked')),
  planning jsonb not null default '{}',
  programme jsonb not null default '{}',
  programme_version text not null default '',
  report jsonb not null default '{}',
  signed_by uuid references auth.users (id),
  signed_by_name text,
  signed_by_frc text,
  firm_frc text,
  signed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index engagements_firm_idx on public.engagements (firm_id);
create index engagements_client_idx on public.engagements (client_id);

create table public.tb_lines (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  code text not null,
  name text not null,
  balance bigint not null default 0,
  prior_balance bigint,
  map_code text,
  nature text check (nature in ('staff', 'depreciation', 'other')),
  unique (engagement_id, code)
);

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  ref text not null,
  description text not null default '',
  posted boolean not null default true,
  lines jsonb not null default '[]',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index adjustments_engagement_idx on public.adjustments (engagement_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  firm_id uuid not null,
  engagement_id uuid,
  table_name text not null,
  action text not null,
  row_id uuid,
  user_id uuid,
  detail jsonb,
  at timestamptz not null default now()
);
create index audit_log_engagement_idx on public.audit_log (engagement_id, at);

-- ---------------------------------------------------------------------------
-- Helpers (private schema: not reachable through the API)
-- ---------------------------------------------------------------------------

create function private.is_member(p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = p_firm and m.user_id = (select auth.uid())
  );
$$;

create function private.is_partner(p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = p_firm and m.user_id = (select auth.uid()) and m.role = 'partner'
  );
$$;

create function private.engagement_firm(p_engagement uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.firm_id from public.engagements e where e.id = p_engagement;
$$;

create function private.client_firm(p_client uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.firm_id from public.clients c where c.id = p_client;
$$;

-- ---------------------------------------------------------------------------
-- Lock: a signed engagement cannot be changed by anyone.
-- ---------------------------------------------------------------------------

create function private.guard_engagement() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'locked' then
      raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.status = 'locked' then
    raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
  end if;
  if coalesce(current_setting('app.signing', true), '') <> '1' then
    if new.status is distinct from old.status
       or new.signed_by is distinct from old.signed_by
       or new.signed_by_name is distinct from old.signed_by_name
       or new.signed_by_frc is distinct from old.signed_by_frc
       or new.firm_frc is distinct from old.firm_frc
       or new.signed_at is distinct from old.signed_at then
      raise exception 'An engagement can only be signed through sign_engagement.' using errcode = 'P0001';
    end if;
  end if;
  if new.firm_id is distinct from old.firm_id or new.client_id is distinct from old.client_id then
    raise exception 'An engagement cannot be moved to another firm or client.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger engagements_guard before update or delete on public.engagements
  for each row execute function private.guard_engagement();

create function private.guard_engagement_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'in_progress' or new.signed_by is not null or new.signed_at is not null then
    raise exception 'A new engagement cannot be created as signed.' using errcode = 'P0001';
  end if;
  if private.client_firm(new.client_id) is distinct from new.firm_id then
    raise exception 'The client does not belong to this firm.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger engagements_guard_insert before insert on public.engagements
  for each row execute function private.guard_engagement_insert();

create function private.guard_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_engagement uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then v_engagement := old.engagement_id; else v_engagement := new.engagement_id; end if;
  select status into v_status from public.engagements where id = v_engagement;
  -- v_status is null while the engagement itself is being deleted (cascade).
  if v_status = 'locked' then
    raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.engagement_id is distinct from old.engagement_id then
    raise exception 'A row cannot be moved to another engagement.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger tb_lines_guard before insert or update or delete on public.tb_lines
  for each row execute function private.guard_child();
create trigger adjustments_guard before insert or update or delete on public.adjustments
  for each row execute function private.guard_child();

-- ---------------------------------------------------------------------------
-- Audit trail: written by triggers, so the application cannot skip or edit it.
-- ---------------------------------------------------------------------------

create function private.log_engagement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id)
    values (old.firm_id, old.id, 'engagements', 'delete', old.id, auth.uid());
    return old;
  end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (
    new.firm_id, new.id, 'engagements', lower(tg_op), new.id, auth.uid(),
    case when tg_op = 'UPDATE' then jsonb_strip_nulls(jsonb_build_object(
      'status', case when new.status is distinct from old.status then new.status end,
      'planning', case when new.planning is distinct from old.planning then new.planning end,
      'report', case when new.report is distinct from old.report then new.report end,
      'programme_changed', case when new.programme is distinct from old.programme then true end
    )) end
  );
  return new;
end;
$$;

create trigger engagements_log after insert or update or delete on public.engagements
  for each row execute function private.log_engagement();

create function private.log_adjustment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_firm uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select firm_id into v_firm from public.engagements where id = r.engagement_id;
  if v_firm is null then return r; end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_firm, r.engagement_id, 'adjustments', lower(tg_op), r.id, auth.uid(),
          jsonb_build_object('ref', r.ref, 'posted', r.posted, 'lines', r.lines));
  return r;
end;
$$;

create trigger adjustments_log after insert or update or delete on public.adjustments
  for each row execute function private.log_adjustment();

create function private.log_tb_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_firm uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select firm_id into v_firm from public.engagements where id = r.engagement_id;
  if v_firm is null then return r; end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_firm, r.engagement_id, 'tb_lines', lower(tg_op), r.id, auth.uid(),
          jsonb_build_object('code', r.code, 'balance', r.balance, 'prior_balance', r.prior_balance,
                             'map_code', r.map_code, 'nature', r.nature));
  return r;
end;
$$;

create trigger tb_lines_log after insert or update or delete on public.tb_lines
  for each row execute function private.log_tb_line();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.firms enable row level security;
alter table public.firm_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_account_maps enable row level security;
alter table public.engagements enable row level security;
alter table public.tb_lines enable row level security;
alter table public.adjustments enable row level security;
alter table public.audit_log enable row level security;

create policy firms_select on public.firms for select to authenticated
  using (private.is_member(id));
create policy firms_update on public.firms for update to authenticated
  using (private.is_partner(id)) with check (private.is_partner(id));

create policy members_select on public.firm_members for select to authenticated
  using (private.is_member(firm_id));
create policy members_update on public.firm_members for update to authenticated
  using (private.is_partner(firm_id)) with check (private.is_partner(firm_id));

create policy clients_all on public.clients for all to authenticated
  using (private.is_member(firm_id)) with check (private.is_member(firm_id));

create policy maps_all on public.client_account_maps for all to authenticated
  using (private.is_member(private.client_firm(client_id)))
  with check (private.is_member(private.client_firm(client_id)));

create policy engagements_select on public.engagements for select to authenticated
  using (private.is_member(firm_id));
create policy engagements_insert on public.engagements for insert to authenticated
  with check (private.is_member(firm_id));
create policy engagements_update on public.engagements for update to authenticated
  using (private.is_member(firm_id)) with check (private.is_member(firm_id));
create policy engagements_delete on public.engagements for delete to authenticated
  using (private.is_partner(firm_id));

create policy tb_lines_all on public.tb_lines for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));

create policy adjustments_all on public.adjustments for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));

-- The audit log is read-only to members. Only triggers write to it.
create policy audit_log_select on public.audit_log for select to authenticated
  using (private.is_member(firm_id));

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
revoke all on all tables in schema public from anon;
grant select, update on public.firms, public.firm_members to authenticated;
grant select, insert, update, delete on public.clients, public.client_account_maps,
  public.engagements, public.tb_lines, public.adjustments to authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Creates a firm and makes the caller its first partner.
create function public.create_firm(p_name text, p_frc_number text, p_address text,
                                   p_full_name text, p_member_frc text)
returns public.firms
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.firm_members where user_id = auth.uid()) then
    raise exception 'You already belong to a firm.' using errcode = 'P0001';
  end if;
  insert into public.firms (name, frc_number, address)
  values (trim(p_name), trim(coalesce(p_frc_number, '')), trim(coalesce(p_address, '')))
  returning * into v_firm;
  insert into public.firm_members (firm_id, user_id, role, full_name, frc_number)
  values (v_firm.id, auth.uid(), 'partner', trim(coalesce(p_full_name, '')), trim(coalesce(p_member_frc, '')));
  return v_firm;
end;
$$;

-- Signs and locks an engagement. Only an engagement partner with an FRC number can call it,
-- and only when the trial balance foots and every account is mapped.
create function public.sign_engagement(p_engagement uuid)
returns public.engagements
language plpgsql security definer set search_path = '' as $$
declare
  v_eng public.engagements;
  v_member public.firm_members;
  v_firm public.firms;
  v_count int;
  v_sum numeric;
  v_unmapped int;
begin
  select * into v_eng from public.engagements where id = p_engagement for update;
  if v_eng.id is null then
    raise exception 'Engagement not found.' using errcode = 'P0001';
  end if;
  select * into v_member from public.firm_members
  where firm_id = v_eng.firm_id and user_id = auth.uid();
  if v_member.user_id is null then
    raise exception 'Engagement not found.' using errcode = 'P0001';
  end if;
  if v_member.role <> 'partner' then
    raise exception 'Only an engagement partner can sign.' using errcode = 'P0001';
  end if;
  if trim(v_member.frc_number) = '' then
    raise exception 'Your FRC registration number is missing.' using errcode = 'P0001';
  end if;
  select * into v_firm from public.firms where id = v_eng.firm_id;
  if trim(v_firm.frc_number) = '' then
    raise exception 'The firm''s FRC registration number is missing.' using errcode = 'P0001';
  end if;
  if v_eng.status = 'locked' then
    raise exception 'This engagement is already signed.' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(balance), 0), count(*) filter (where map_code is null)
  into v_count, v_sum, v_unmapped
  from public.tb_lines where engagement_id = p_engagement;
  if v_count = 0 then
    raise exception 'No trial balance has been imported.' using errcode = 'P0001';
  end if;
  if v_sum <> 0 then
    raise exception 'The trial balance does not foot.' using errcode = 'P0001';
  end if;
  if v_unmapped > 0 then
    raise exception 'Some accounts are not mapped.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.adjustments a
    where a.engagement_id = p_engagement
      and (select coalesce(sum((j ->> 'amount')::numeric), 0) from jsonb_array_elements(a.lines) j) <> 0
  ) then
    raise exception 'A journal does not balance.' using errcode = 'P0001';
  end if;

  perform set_config('app.signing', '1', true);
  update public.engagements
  set status = 'locked', signed_by = auth.uid(), signed_by_name = v_member.full_name,
      signed_by_frc = v_member.frc_number, firm_frc = v_firm.frc_number, signed_at = now()
  where id = p_engagement
  returning * into v_eng;
  perform set_config('app.signing', '', true);
  return v_eng;
end;
$$;

revoke execute on function public.create_firm(text, text, text, text, text) from public, anon;
revoke execute on function public.sign_engagement(uuid) from public, anon;
grant execute on function public.create_firm(text, text, text, text, text) to authenticated;
grant execute on function public.sign_engagement(uuid) to authenticated;
