-- VeritBooks: paying for one engagement at a time, credit when moving to a bigger plan,
-- receipts, reminders, the founding firm commitment, and the platform owner's console.
-- Run once, after 0009. Nothing is removed. One column stops being required.

-- ---------------------------------------------------------------------------
-- New columns and tables
-- ---------------------------------------------------------------------------

alter table public.firms add column suspended_at timestamptz;
alter table public.firms add column suspended_reason text not null default '';
alter table public.firms add column admin_note text not null default '';
-- Who accepted the founding firm commitment (feedback, and a reference if happy), and when.
alter table public.firms add column founding_agreed_at timestamptz;
alter table public.firms add column founding_agreed_by text;

-- An engagement paid for on its own stays open whatever the firm's plan is doing.
alter table public.engagements add column pay_per boolean not null default false;
alter table public.engagements add column group_addon boolean not null default false;

create table public.engagement_prices (
  code text primary key check (code in ('compilation', 'review', 'audit', 'group')),
  name text not null,
  price_kobo bigint not null check (price_kobo > 0),
  sort integer not null default 0
);
insert into public.engagement_prices (code, name, price_kobo, sort) values
  ('compilation', 'Compilation', 1000000, 1),
  ('review',      'Review',      2500000, 2),
  ('audit',       'Audit',       4000000, 3),
  ('group',       'Group consolidation', 2000000, 4);

alter table public.payments alter column plan drop not null;
alter table public.payments add column kind text not null default 'plan' check (kind in ('plan', 'engagement', 'group'));
alter table public.payments add column engagement_type text;
alter table public.payments add column engagement_id uuid;
alter table public.payments add column with_group boolean not null default false;
alter table public.payments add column credit_kobo bigint not null default 0;
alter table public.payments add column restart boolean not null default false; -- the paid year starts again today
alter table public.payments add column founding_agreed boolean not null default false;
alter table public.payments add column source text not null default 'flutterwave' check (source in ('flutterwave', 'manual'));
alter table public.payments add column note text not null default '';
alter table public.payments add column receipt_no bigint unique;
create sequence public.receipt_seq start 1001;

-- A paid-for engagement not yet opened.
create table public.engagement_credits (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  type text not null check (type in ('compilation', 'review', 'audit')),
  with_group boolean not null default false,
  payment_id uuid references public.payments (id) on delete set null,
  engagement_id uuid,          -- the engagement it was used on
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index engagement_credits_firm_idx on public.engagement_credits (firm_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_by uuid,
  added_at timestamptz not null default now(),
  removed_at timestamptz -- a removed admin stays on record
);
-- One row: who the seller is, as printed on receipts.
create table public.platform_settings (
  id boolean primary key default true check (id),
  seller_name text not null default 'VeritBooks',
  seller_address text not null default '',
  tax_id text not null default '',
  support_email text not null default ''
);
insert into public.platform_settings default values;
create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  firm_id uuid,
  detail jsonb,
  at timestamptz not null default now()
);
-- Reminder emails already sent, so nobody gets the same one twice.
create table public.billing_notices (
  firm_id uuid not null references public.firms (id) on delete cascade,
  kind text not null,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (firm_id, kind, key)
);
create table private.cron_token (id boolean primary key default true check (id), token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
insert into private.cron_token default values;

alter table public.engagement_prices enable row level security;
alter table public.engagement_credits enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_log enable row level security;
alter table public.billing_notices enable row level security;
alter table private.cron_token enable row level security;
create policy engagement_prices_select on public.engagement_prices for select to authenticated using (true);
create policy engagement_credits_select on public.engagement_credits for select to authenticated using (private.is_member(firm_id));
-- The admin tables have no policies: they are reached only through the functions below.
revoke all on public.engagement_prices, public.engagement_credits, public.platform_admins, public.platform_settings,
  public.admin_log, public.billing_notices from anon, authenticated;
revoke all on sequence public.receipt_seq from anon, authenticated;
grant select on public.engagement_prices, public.engagement_credits to authenticated;

-- ---------------------------------------------------------------------------
-- State, and what it allows
-- ---------------------------------------------------------------------------

create or replace function private.firm_state(p_firm uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when f.suspended_at is not null then 'suspended'
              when f.paid_until > now() then 'active'
              when f.trial_ends_at > now() then 'trial'
              else 'expired' end
  from public.firms f where f.id = p_firm;
$$;

-- Engagements paid for one at a time do not count against a plan's allowance.
create or replace function private.engagements_used(p_firm uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.engagements e
  join public.firms f on f.id = e.firm_id
  where f.id = p_firm and not e.pay_per
    and (f.paid_until is null or f.paid_until <= now()
         or e.created_at >= f.paid_until - make_interval(years => ceil(extract(epoch from f.paid_until - now()) / 31557600.0)::integer));
$$;

create or replace function private.require_open(p_firm uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_state text := private.firm_state(p_firm);
begin
  if v_state = 'suspended' then
    raise exception 'This firm''s account is suspended, so nothing can be changed. Please contact VeritBooks support.' using errcode = 'P0001';
  end if;
  if v_state = 'expired' then
    raise exception 'Your firm''s plan is not active, so the file is read-only. A partner can choose a plan, or pay for this one engagement, under Billing.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.guard_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_engagement uuid;
  v_status text;
  v_firm uuid;
  v_pay_per boolean;
begin
  if tg_op = 'DELETE' then v_engagement := old.engagement_id; else v_engagement := new.engagement_id; end if;
  select status, firm_id, pay_per into v_status, v_firm, v_pay_per from public.engagements where id = v_engagement;
  -- v_status is null while the engagement itself is being deleted (cascade).
  if v_status = 'locked' then
    raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
  end if;
  if v_firm is not null and (not v_pay_per or private.firm_state(v_firm) = 'suspended') then
    perform private.require_open(v_firm);
  end if;
  if tg_op = 'UPDATE' and new.engagement_id is distinct from old.engagement_id then
    raise exception 'A row cannot be moved to another engagement.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Whether an engagement is paid for is decided by the payment functions, never by the browser.
-- This runs before engagements_plan_guard (triggers fire in name order).
create function private.guard_engagement_pay() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.pay_per := false;
      new.group_addon := false;
    elsif new.pay_per is distinct from old.pay_per or new.group_addon is distinct from old.group_addon then
      raise exception 'Payment details cannot be changed here.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger engagements_pay_guard before insert or update on public.engagements
  for each row execute function private.guard_engagement_pay();

create or replace function private.guard_engagement_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans;
  v_state text;
  v_credit public.engagement_credits;
begin
  if tg_op = 'DELETE' then
    if not old.pay_per or private.firm_state(old.firm_id) = 'suspended' then perform private.require_open(old.firm_id); end if;
    return old;
  end if;
  v_state := private.firm_state(new.firm_id);
  if tg_op = 'INSERT' then
    if v_state = 'suspended' then perform private.require_open(new.firm_id); end if;
    v_plan := private.firm_plan(new.firm_id);
    if v_state in ('trial', 'active') and private.engagements_used(new.firm_id) < v_plan.max_engagements then
      return new;
    end if;
    -- Outside a plan, or past its allowance: use an engagement that was paid for on its own.
    select * into v_credit from public.engagement_credits
    where firm_id = new.firm_id and type = new.type and used_at is null
    order by created_at limit 1 for update;
    if v_credit.id is not null then
      new.pay_per := true;
      new.group_addon := v_credit.with_group;
      update public.engagement_credits set used_at = now(), engagement_id = new.id where id = v_credit.id;
      return new;
    end if;
    if v_state = 'expired' then
      raise exception 'Your firm''s plan is not active. A partner can choose a plan, or pay for one % engagement, under Billing.', new.type using errcode = 'P0001';
    end if;
    raise exception 'Your % plan allows % engagements. A partner can change the plan, or pay for one more % engagement, under Billing.',
      v_plan.name, v_plan.max_engagements, new.type using errcode = 'P0001';
  end if;
  if not new.pay_per or v_state = 'suspended' then perform private.require_open(new.firm_id); end if;
  if new.status = 'locked' and old.status <> 'locked' and v_state <> 'active' and not new.pay_per then
    raise exception 'A file can be signed once it is paid for. A partner can choose a plan, or pay for this one engagement, under Billing.' using errcode = 'P0001';
  end if;
  if new.pay_per and not new.group_addon
     and jsonb_array_length(coalesce(new.planning #> '{group,subsidiaries}', '[]'::jsonb)) > 0
     and jsonb_array_length(coalesce(old.planning #> '{group,subsidiaries}', '[]'::jsonb)) = 0 then
    raise exception 'Group consolidation is an add-on for an engagement paid for on its own. A partner can add it under Billing.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Clients can always be kept up to date. The quality register follows the plan.
create or replace function private.guard_firm_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
begin
  if tg_op = 'DELETE' then v_firm := old.firm_id; else v_firm := new.firm_id; end if;
  if tg_table_name <> 'clients' or private.firm_state(v_firm) = 'suspended' then
    perform private.require_open(v_firm);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------------

-- Paying for single engagements does not use up the founding offer.
create or replace function private.quote(p_firm uuid, p_plan text, out amount_kobo bigint, out list_kobo bigint, out founding boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_reserved integer;
begin
  select * into v_firm from public.firms where id = p_firm;
  select price_kobo into list_kobo from public.plans where code = p_plan and code <> 'trial';
  if list_kobo is null then
    raise exception 'That plan is not available.' using errcode = 'P0001';
  end if;
  founding := false;
  amount_kobo := list_kobo;
  if v_firm.founding_number is not null then
    -- A founding firm renews at the prices of the day it joined, while they are held.
    if v_firm.price_lock_until > now() and v_firm.locked_prices ? p_plan then
      amount_kobo := least(list_kobo, (v_firm.locked_prices ->> p_plan)::bigint);
    end if;
  elsif not exists (select 1 from public.payments where firm_id = p_firm and status = 'paid' and kind = 'plan') then
    -- Places being paid for by other firms right now count as taken for half an hour.
    select count(distinct y.firm_id) into v_reserved from public.payments y
    where y.founding and y.status = 'pending' and y.firm_id <> p_firm and y.created_at > now() - interval '30 minutes';
    if private.founding_taken() + v_reserved < 20 then
      founding := true;
      amount_kobo := list_kobo * 60 / 100;
    end if;
  end if;
end;
$$;

-- What a firm pays today for a plan. mode says what the payment does:
--   new      first payment, or after a lapse: a year from today
--   renew    same plan: a year added to the end
--   upgrade  a bigger plan: a year from today, less credit for the unused part of what was paid
--   switch   a smaller plan, in the last 30 days: a year added to the end
--   later    a smaller plan, earlier than that: not available yet
create function private.plan_quote(p_firm uuid, p_plan text, out amount_kobo bigint, out list_kobo bigint,
                                   out founding boolean, out credit_kobo bigint, out mode text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_current bigint;
begin
  select q.amount_kobo, q.list_kobo, q.founding into amount_kobo, list_kobo, founding from private.quote(p_firm, p_plan) q;
  credit_kobo := 0;
  mode := 'new';
  select * into v_firm from public.firms where id = p_firm;
  if v_firm.paid_until is null or v_firm.paid_until <= now() then return; end if;
  if v_firm.plan = p_plan then
    mode := 'renew';
    return;
  end if;
  select price_kobo into v_current from public.plans where code = v_firm.plan;
  if list_kobo > v_current then
    mode := 'upgrade';
    -- Each payment covers the year ending at covers_until. Credit is the part still to run.
    select coalesce(floor(sum((y.amount_kobo + y.credit_kobo)
             * extract(epoch from y.covers_until - greatest(now(), y.covers_until - interval '1 year'))
             / extract(epoch from interval '1 year'))), 0)::bigint
    into credit_kobo
    from public.payments y
    where y.firm_id = p_firm and y.status = 'paid' and y.kind = 'plan' and y.covers_until > now();
    credit_kobo := greatest(least(credit_kobo, amount_kobo - 100000), 0); -- at least 1,000 naira is always payable
    amount_kobo := amount_kobo - credit_kobo;
  elsif v_firm.paid_until - now() > interval '30 days' then
    mode := 'later';
  else
    mode := 'switch';
  end if;
end;
$$;

create or replace function public.billing_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_plan public.plans;
begin
  select f.* into v_firm from public.firms f
  join public.firm_members m on m.firm_id = f.id and m.user_id = auth.uid();
  if v_firm.id is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  v_plan := private.firm_plan(v_firm.id);
  return jsonb_build_object(
    'state', private.firm_state(v_firm.id),
    'suspended_reason', v_firm.suspended_reason,
    'plan', v_plan.code,
    'plan_name', v_plan.name,
    'trial_ends_at', v_firm.trial_ends_at,
    'paid_until', v_firm.paid_until,
    'founding_number', v_firm.founding_number,
    'price_lock_until', v_firm.price_lock_until,
    'founding_agreed_at', v_firm.founding_agreed_at,
    'founding_agreed_by', v_firm.founding_agreed_by,
    'founding_left', greatest(20 - private.founding_taken(), 0),
    'engagements_used', private.engagements_used(v_firm.id),
    'max_engagements', v_plan.max_engagements,
    'users', (select count(*) from public.firm_members where firm_id = v_firm.id),
    'max_users', v_plan.max_users,
    'plans', (
      select jsonb_agg(jsonb_build_object(
        'code', p.code, 'name', p.name, 'max_users', p.max_users, 'max_engagements', p.max_engagements,
        'list_kobo', q.list_kobo, 'amount_kobo', q.amount_kobo, 'founding', q.founding,
        'credit_kobo', q.credit_kobo, 'mode', q.mode) order by p.sort)
      from public.plans p, private.plan_quote(v_firm.id, p.code) q
      where p.code <> 'trial'),
    'engagement_prices', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'price_kobo', price_kobo) order by sort) from public.engagement_prices),
    'credits', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'type', c.type, 'with_group', c.with_group) order by c.created_at)
      from public.engagement_credits c where c.firm_id = v_firm.id and c.used_at is null), '[]'::jsonb),
    'open_engagements', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'client', c.name, 'type', e.type, 'year_end', e.year_end,
                                          'pay_per', e.pay_per, 'group_addon', e.group_addon) order by e.created_at)
      from public.engagements e join public.clients c on c.id = e.client_id
      where e.firm_id = v_firm.id and e.status = 'in_progress'), '[]'::jsonb),
    'seller', (select jsonb_build_object('name', seller_name, 'address', seller_address, 'tax_id', tax_id, 'support_email', support_email) from public.platform_settings),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id, 'kind', y.kind, 'plan', y.plan, 'engagement_type', y.engagement_type, 'with_group', y.with_group,
        'amount_kobo', y.amount_kobo, 'credit_kobo', y.credit_kobo, 'founding', y.founding, 'source', y.source,
        'paid_at', y.paid_at, 'covers_until', y.covers_until, 'tx_ref', y.tx_ref, 'receipt_no', y.receipt_no) order by y.paid_at desc)
      from public.payments y where y.firm_id = v_firm.id and y.status = 'paid'), '[]'::jsonb)
  );
end;
$$;

-- A partner starts a payment. p says what for:
--   { "kind": "plan", "plan": "solo", "founding_agreed": true }
--   { "kind": "engagement", "type": "audit", "with_group": false }        one engagement, to open later
--   { "kind": "engagement", "engagement": "<id>", "with_group": false }   an engagement already open
--   { "kind": "group", "engagement": "<id>" }                             the consolidation add-on
create function public.billing_checkout(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_q record;
  v_eng public.engagements;
  v_kind text := coalesce(p ->> 'kind', 'plan');
  v_type text := p ->> 'type';
  v_group boolean := coalesce((p ->> 'with_group')::boolean, false);
  v_amount bigint;
  v_what text;
  v_ref text := 'vb-' || replace(gen_random_uuid()::text, '-', '');
begin
  select f.* into v_firm from public.firms f
  join public.firm_members m on m.firm_id = f.id and m.user_id = auth.uid() and m.role = 'partner';
  if v_firm.id is null then
    raise exception 'Only a partner can make a payment.' using errcode = 'P0001';
  end if;
  if v_firm.suspended_at is not null then
    raise exception 'This firm''s account is suspended. Please contact VeritBooks support.' using errcode = 'P0001';
  end if;

  if v_kind = 'plan' then
    select * into v_q from private.plan_quote(v_firm.id, p ->> 'plan');
    if v_q.mode = 'later' then
      raise exception 'You can move to a smaller plan in the last 30 days of your paid year.' using errcode = 'P0001';
    end if;
    if v_q.founding and not coalesce((p ->> 'founding_agreed')::boolean, false) then
      raise exception 'Please confirm the founding firm commitment first.' using errcode = 'P0001';
    end if;
    select name into v_what from public.plans where code = p ->> 'plan';
    insert into public.payments (firm_id, tx_ref, kind, plan, amount_kobo, list_kobo, founding, credit_kobo, restart, founding_agreed, created_by)
    values (v_firm.id, v_ref, 'plan', p ->> 'plan', v_q.amount_kobo, v_q.list_kobo, v_q.founding, v_q.credit_kobo,
            v_q.mode = 'upgrade', v_q.founding, auth.uid());
    return jsonb_build_object('tx_ref', v_ref, 'amount_kobo', v_q.amount_kobo, 'firm', v_firm.name,
      'description', v_what || ' plan, one year' || case when v_q.founding then ' (founding firm price)' else '' end);
  end if;

  if p ->> 'engagement' is not null then
    select * into v_eng from public.engagements where id = (p ->> 'engagement')::uuid and firm_id = v_firm.id;
    if v_eng.id is null or v_eng.status <> 'in_progress' then
      raise exception 'That engagement cannot be paid for.' using errcode = 'P0001';
    end if;
    v_type := v_eng.type;
  end if;

  if v_kind = 'engagement' then
    if v_eng.id is not null and v_eng.pay_per then
      raise exception 'That engagement is already paid for.' using errcode = 'P0001';
    end if;
    select price_kobo, name into v_amount, v_what from public.engagement_prices where code = v_type and code <> 'group';
    if v_amount is null then
      raise exception 'Choose audit, review or compilation.' using errcode = 'P0001';
    end if;
    v_what := 'One ' || lower(v_what) || ' engagement';
    if v_group then
      v_amount := v_amount + (select price_kobo from public.engagement_prices where code = 'group');
      v_what := v_what || ' with group consolidation';
    end if;
  elsif v_kind = 'group' then
    if v_eng.id is null or not v_eng.pay_per or v_eng.group_addon then
      raise exception 'The consolidation add-on is for an engagement paid for on its own.' using errcode = 'P0001';
    end if;
    select price_kobo into v_amount from public.engagement_prices where code = 'group';
    v_what := 'Group consolidation for one engagement';
    v_group := true;
  else
    raise exception 'Unknown payment.' using errcode = 'P0001';
  end if;
  insert into public.payments (firm_id, tx_ref, kind, amount_kobo, list_kobo, engagement_type, engagement_id, with_group, created_by)
  values (v_firm.id, v_ref, v_kind, v_amount, v_amount, v_type, v_eng.id, v_group, auth.uid());
  return jsonb_build_object('tx_ref', v_ref, 'amount_kobo', v_amount, 'firm', v_firm.name, 'description', v_what);
end;
$$;

-- The older entry point now goes through the same checks.
create or replace function public.billing_start(p_plan text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.billing_checkout(jsonb_build_object('kind', 'plan', 'plan', p_plan));
$$;

-- Puts a confirmed payment into effect. Shared by the provider path and the admin's manual entry.
create function private.fulfil(p_payment uuid, p_provider_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_firm public.firms;
  v_until timestamptz;
begin
  select * into v_pay from public.payments where id = p_payment for update;
  perform pg_advisory_xact_lock(hashtext('veritbooks.founding'));
  select * into v_firm from public.firms where id = v_pay.firm_id for update;
  if v_pay.kind = 'plan' then
    if v_pay.restart then
      v_until := now() + interval '1 year';
      -- The earlier payments have been credited against this one.
      update public.payments set covers_until = now()
      where firm_id = v_pay.firm_id and kind = 'plan' and status = 'paid' and covers_until > now();
    else
      v_until := greatest(now(), coalesce(v_firm.paid_until, now())) + interval '1 year';
    end if;
    update public.firms set
      plan = v_pay.plan,
      paid_until = v_until,
      founding_number = case when founding_number is null and v_pay.founding and private.founding_taken() < 20
                             then (select min(n) from generate_series(1, 20) n where n not in (select founding_number from public.firms where founding_number is not null))
                             else founding_number end,
      price_lock_until = case when founding_number is null and v_pay.founding then now() + interval '2 years' else price_lock_until end,
      locked_prices = case when founding_number is null and v_pay.founding
                           then (select jsonb_object_agg(code, price_kobo) from public.plans where code <> 'trial')
                           else locked_prices end,
      founding_agreed_at = case when founding_number is null and v_pay.founding and v_pay.founding_agreed then now() else founding_agreed_at end,
      founding_agreed_by = case when founding_number is null and v_pay.founding and v_pay.founding_agreed
                                then (select full_name from public.firm_members where firm_id = v_pay.firm_id and user_id = v_pay.created_by)
                                else founding_agreed_by end
    where id = v_pay.firm_id;
  elsif v_pay.engagement_id is not null and exists (select 1 from public.engagements where id = v_pay.engagement_id) then
    update public.engagements set pay_per = true, group_addon = group_addon or v_pay.with_group where id = v_pay.engagement_id;
  elsif v_pay.kind = 'engagement' then
    insert into public.engagement_credits (firm_id, type, with_group, payment_id)
    values (v_pay.firm_id, v_pay.engagement_type, v_pay.with_group, v_pay.id);
  end if;
  update public.payments set status = 'paid', provider_id = p_provider_id, paid_at = now(), covers_until = v_until,
    receipt_no = nextval('public.receipt_seq')
  where id = v_pay.id;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_pay.firm_id, case when exists (select 1 from public.engagements where id = v_pay.engagement_id) then v_pay.engagement_id end,
          'payments', 'paid', v_pay.id, v_pay.created_by,
          jsonb_strip_nulls(jsonb_build_object('kind', v_pay.kind, 'plan', v_pay.plan, 'type', v_pay.engagement_type,
            'amount_kobo', v_pay.amount_kobo, 'founding', nullif(v_pay.founding, false), 'until', v_until)));
end;
$$;

create or replace function public.apply_payment(p_tx_ref text, p_provider_id text, p_amount_kobo bigint, p_currency text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments where tx_ref = p_tx_ref for update;
  if v_pay.id is null then
    raise exception 'Unknown payment reference.' using errcode = 'P0001';
  end if;
  if v_pay.status = 'paid' then
    return 'already';
  end if;
  if upper(coalesce(p_currency, '')) <> 'NGN' or coalesce(p_amount_kobo, 0) < v_pay.amount_kobo then
    raise exception 'The amount paid does not match the amount due.' using errcode = 'P0001';
  end if;
  perform private.fulfil(v_pay.id, p_provider_id);
  return 'paid';
end;
$$;

-- ---------------------------------------------------------------------------
-- Reminders. The billing function asks what is due, sends the emails, and records each one.
-- ---------------------------------------------------------------------------

create function public.billing_due_notices() returns jsonb
language sql stable security definer set search_path = '' as $$
  with due as (
    select f.id, f.name, 'trial_ending' as kind, f.trial_ends_at as at from public.firms f
      where f.paid_until is null and f.trial_ends_at > now() and f.trial_ends_at <= now() + interval '3 days'
    union all
    select f.id, f.name, 'trial_ended', f.trial_ends_at from public.firms f
      where f.paid_until is null and f.trial_ends_at <= now() and f.trial_ends_at > now() - interval '3 days'
    union all
    select f.id, f.name, 'plan_30', f.paid_until from public.firms f
      where f.paid_until > now() + interval '7 days' and f.paid_until <= now() + interval '30 days'
    union all
    select f.id, f.name, 'plan_7', f.paid_until from public.firms f
      where f.paid_until > now() and f.paid_until <= now() + interval '7 days'
    union all
    select f.id, f.name, 'plan_ended', f.paid_until from public.firms f
      where f.paid_until <= now() and f.paid_until > now() - interval '3 days'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'firm', d.id, 'name', d.name, 'kind', d.kind, 'at', d.at, 'key', to_char(d.at, 'YYYY-MM-DD'),
    'plan', (select p.name from public.firms f join public.plans p on p.code = f.plan where f.id = d.id),
    'to', (select jsonb_agg(u.email) from public.firm_members m join auth.users u on u.id = m.user_id
           where m.firm_id = d.id and m.role = 'partner' and u.email is not null))), '[]'::jsonb)
  from due d
  join public.firms f on f.id = d.id and f.suspended_at is null
  where not exists (select 1 from public.billing_notices n where n.firm_id = d.id and n.kind = d.kind and n.key = to_char(d.at, 'YYYY-MM-DD'));
$$;

create function public.billing_notice_sent(p_firm uuid, p_kind text, p_key text) returns void
language sql security definer set search_path = '' as $$
  insert into public.billing_notices (firm_id, kind, key) values (p_firm, p_kind, p_key) on conflict do nothing;
$$;

create function public.cron_ok(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.cron_token where token = p_token);
$$;

-- What a receipt email needs, for the billing function.
create function public.payment_receipt(p_tx_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'receipt_no', y.receipt_no, 'amount_kobo', y.amount_kobo, 'credit_kobo', y.credit_kobo, 'paid_at', y.paid_at,
    'covers_until', y.covers_until, 'kind', y.kind, 'plan', (select name from public.plans where code = y.plan),
    'engagement_type', y.engagement_type, 'with_group', y.with_group, 'founding', y.founding, 'tx_ref', y.tx_ref,
    'firm', f.name, 'firm_address', f.address,
    'to', (select u.email from auth.users u where u.id = y.created_by),
    'seller', (select jsonb_build_object('name', seller_name, 'address', seller_address, 'tax_id', tax_id, 'support_email', support_email) from public.platform_settings))
  from public.payments y join public.firms f on f.id = y.firm_id
  where y.tx_ref = p_tx_ref and y.status = 'paid';
$$;

-- ---------------------------------------------------------------------------
-- The platform owner's console. Every function checks the caller is a platform admin.
-- An admin sees firms, users, plans and payments. An admin does not see client files:
-- nothing here returns a trial balance, a ledger, evidence or a report.
-- ---------------------------------------------------------------------------

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid() and removed_at is null);
$$;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin();
$$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Not found.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'founding_taken', private.founding_taken(),
    'revenue_kobo', (select coalesce(sum(amount_kobo), 0) from public.payments where status = 'paid'),
    'revenue_month_kobo', (select coalesce(sum(amount_kobo), 0) from public.payments where status = 'paid' and paid_at >= date_trunc('month', now())),
    'firms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'frc_number', f.frc_number, 'address', f.address, 'created_at', f.created_at,
        'state', private.firm_state(f.id), 'plan', f.plan, 'trial_ends_at', f.trial_ends_at, 'paid_until', f.paid_until,
        'founding_number', f.founding_number, 'founding_agreed_at', f.founding_agreed_at, 'founding_agreed_by', f.founding_agreed_by,
        'suspended_reason', f.suspended_reason, 'note', f.admin_note, 'ai_enabled', f.ai_enabled,
        'engagements', (select count(*) from public.engagements e where e.firm_id = f.id),
        'signed', (select count(*) from public.engagements e where e.firm_id = f.id and e.status = 'locked'),
        'clients', (select count(*) from public.clients c where c.firm_id = f.id),
        'credits', (select count(*) from public.engagement_credits c where c.firm_id = f.id and c.used_at is null),
        'paid_kobo', (select coalesce(sum(y.amount_kobo), 0) from public.payments y where y.firm_id = f.id and y.status = 'paid'),
        'last_activity', (select max(l.at) from public.audit_log l where l.firm_id = f.id),
        'members', coalesce((
          select jsonb_agg(jsonb_build_object('name', m.full_name, 'role', m.role, 'email', u.email, 'joined', m.created_at) order by m.created_at)
          from public.firm_members m left join auth.users u on u.id = m.user_id where m.firm_id = f.id), '[]'::jsonb)
      ) order by f.created_at desc)
      from public.firms f), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email, 'created_at', u.created_at, 'confirmed', u.email_confirmed_at is not null,
        'last_sign_in_at', u.last_sign_in_at, 'firm', f.name, 'role', m.role, 'name', m.full_name,
        'admin', exists (select 1 from public.platform_admins a where a.user_id = u.id and a.removed_at is null)) order by u.created_at desc)
      from auth.users u
      left join public.firm_members m on m.user_id = u.id
      left join public.firms f on f.id = m.firm_id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(x.j order by x.created_at desc) from (
        select y.created_at, jsonb_build_object(
          'id', y.id, 'firm', f.name, 'firm_id', y.firm_id, 'kind', y.kind, 'plan', y.plan, 'engagement_type', y.engagement_type,
          'with_group', y.with_group, 'amount_kobo', y.amount_kobo, 'credit_kobo', y.credit_kobo, 'founding', y.founding,
          'status', y.status, 'source', y.source, 'note', y.note, 'tx_ref', y.tx_ref, 'provider_id', y.provider_id,
          'receipt_no', y.receipt_no, 'created_at', y.created_at, 'paid_at', y.paid_at) as j
        from public.payments y join public.firms f on f.id = y.firm_id
        order by y.created_at desc limit 300) x), '[]'::jsonb),
    'plans', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'price_kobo', price_kobo, 'max_users', max_users, 'max_engagements', max_engagements) order by sort) from public.plans),
    'engagement_prices', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'price_kobo', price_kobo) order by sort) from public.engagement_prices),
    'settings', (select jsonb_build_object('seller_name', seller_name, 'seller_address', seller_address, 'tax_id', tax_id, 'support_email', support_email) from public.platform_settings),
    'log', coalesce((
      select jsonb_agg(x.j order by x.at desc) from (
        select l.at, jsonb_build_object('at', l.at, 'action', l.action, 'detail', l.detail,
          'admin', (select email from auth.users where id = l.admin_id),
          'firm', (select name from public.firms where id = l.firm_id)) as j
        from public.admin_log l order by l.at desc limit 200) x), '[]'::jsonb)
  );
end;
$$;

create function public.admin_act(p_action text, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid := nullif(p ->> 'firm', '')::uuid;
  v_days integer;
  v_until timestamptz;
  v_amount bigint;
  v_user uuid;
  v_pay uuid;
begin
  if not private.is_admin() then
    raise exception 'Not found.' using errcode = 'P0001';
  end if;
  if p_action in ('extend_trial', 'set_plan', 'end_plan', 'record_payment', 'suspend', 'unsuspend', 'founding', 'grant_credit', 'note')
     and not exists (select 1 from public.firms where id = v_firm) then
    raise exception 'Firm not found.' using errcode = 'P0001';
  end if;

  if p_action = 'extend_trial' then
    v_days := (p ->> 'days')::integer;
    if v_days is null or v_days < 1 or v_days > 90 then
      raise exception 'Extend by 1 to 90 days.' using errcode = 'P0001';
    end if;
    update public.firms set trial_ends_at = greatest(now(), trial_ends_at) + make_interval(days => v_days) where id = v_firm;
  elsif p_action = 'set_plan' then
    -- A plan given without payment: a pilot, a partner firm, a correction.
    v_until := (p ->> 'until')::date + interval '1 day';
    if not exists (select 1 from public.plans where code = p ->> 'plan' and code <> 'trial') or v_until is null or v_until <= now() then
      raise exception 'Choose a plan and a date in the future.' using errcode = 'P0001';
    end if;
    update public.firms set plan = p ->> 'plan', paid_until = v_until where id = v_firm;
  elsif p_action = 'end_plan' then
    update public.firms set paid_until = now() where id = v_firm and paid_until > now();
  elsif p_action = 'record_payment' then
    -- Money received outside Flutterwave, such as a bank transfer.
    v_amount := round((p ->> 'amount_naira')::numeric * 100);
    if not exists (select 1 from public.plans where code = p ->> 'plan' and code <> 'trial') or v_amount is null or v_amount <= 0
       or length(trim(coalesce(p ->> 'reference', ''))) = 0 then
      raise exception 'Give the plan, the amount received and a reference.' using errcode = 'P0001';
    end if;
    insert into public.payments (firm_id, tx_ref, kind, plan, amount_kobo, list_kobo, source, note, created_by)
    values (v_firm, 'manual-' || replace(gen_random_uuid()::text, '-', ''), 'plan', p ->> 'plan', v_amount,
            (select price_kobo from public.plans where code = p ->> 'plan'), 'manual', left(trim(p ->> 'reference'), 200), auth.uid())
    returning id into v_pay;
    perform private.fulfil(v_pay, null);
  elsif p_action = 'suspend' then
    update public.firms set suspended_at = now(), suspended_reason = left(trim(coalesce(p ->> 'reason', '')), 300) where id = v_firm;
  elsif p_action = 'unsuspend' then
    update public.firms set suspended_at = null, suspended_reason = '' where id = v_firm;
  elsif p_action = 'founding' then
    if coalesce((p ->> 'on')::boolean, false) then
      if private.founding_taken() >= 20 then
        raise exception 'All 20 founding places are taken.' using errcode = 'P0001';
      end if;
      update public.firms set
        founding_number = (select min(n) from generate_series(1, 20) n where n not in (select founding_number from public.firms where founding_number is not null)),
        price_lock_until = now() + interval '2 years',
        locked_prices = (select jsonb_object_agg(code, price_kobo) from public.plans where code <> 'trial')
      where id = v_firm and founding_number is null;
    else
      update public.firms set founding_number = null, price_lock_until = null, locked_prices = null where id = v_firm;
    end if;
  elsif p_action = 'grant_credit' then
    if coalesce(p ->> 'type', '') not in ('compilation', 'review', 'audit') then
      raise exception 'Choose audit, review or compilation.' using errcode = 'P0001';
    end if;
    insert into public.engagement_credits (firm_id, type, with_group)
    values (v_firm, p ->> 'type', coalesce((p ->> 'with_group')::boolean, false));
  elsif p_action = 'note' then
    update public.firms set admin_note = left(coalesce(p ->> 'text', ''), 2000) where id = v_firm;
  elsif p_action = 'set_price' then
    v_amount := round((p ->> 'price_naira')::numeric * 100);
    if v_amount is null or v_amount <= 0 or coalesce((p ->> 'max_engagements')::integer, 0) < 1 then
      raise exception 'Give a price and an engagement allowance above zero.' using errcode = 'P0001';
    end if;
    update public.plans set price_kobo = v_amount, max_engagements = (p ->> 'max_engagements')::integer,
      max_users = nullif(p ->> 'max_users', '')::integer
    where code = p ->> 'plan' and code <> 'trial';
    if not found then raise exception 'Plan not found.' using errcode = 'P0001'; end if;
  elsif p_action = 'set_engagement_price' then
    v_amount := round((p ->> 'price_naira')::numeric * 100);
    if v_amount is null or v_amount <= 0 then
      raise exception 'Give a price above zero.' using errcode = 'P0001';
    end if;
    update public.engagement_prices set price_kobo = v_amount where code = p ->> 'code';
    if not found then raise exception 'Price not found.' using errcode = 'P0001'; end if;
  elsif p_action = 'settings' then
    update public.platform_settings set
      seller_name = left(trim(coalesce(p ->> 'seller_name', '')), 200), seller_address = left(trim(coalesce(p ->> 'seller_address', '')), 400),
      tax_id = left(trim(coalesce(p ->> 'tax_id', '')), 60), support_email = left(trim(coalesce(p ->> 'support_email', '')), 200);
  elsif p_action = 'add_admin' then
    select id into v_user from auth.users where lower(email) = lower(trim(p ->> 'email')) and email_confirmed_at is not null;
    if v_user is null then
      raise exception 'No confirmed account uses that email address. They need to create an account first.' using errcode = 'P0001';
    end if;
    insert into public.platform_admins (user_id, added_by) values (v_user, auth.uid())
    on conflict (user_id) do update set removed_at = null, added_by = excluded.added_by, added_at = now();
  elsif p_action = 'remove_admin' then
    v_user := (p ->> 'user')::uuid;
    if v_user = auth.uid() then
      raise exception 'You cannot remove yourself.' using errcode = 'P0001';
    end if;
    update public.platform_admins set removed_at = now() where user_id = v_user;
  else
    raise exception 'Unknown action.' using errcode = 'P0001';
  end if;
  insert into public.admin_log (admin_id, action, firm_id, detail) values (auth.uid(), p_action, v_firm, p - 'firm');
end;
$$;

revoke execute on function public.billing_checkout(jsonb), public.is_platform_admin(), public.admin_overview(), public.admin_act(text, jsonb) from public, anon;
revoke execute on function public.billing_due_notices(), public.billing_notice_sent(uuid, text, text), public.cron_ok(text), public.payment_receipt(text) from public, anon, authenticated;
grant execute on function public.billing_checkout(jsonb), public.is_platform_admin(), public.admin_overview(), public.admin_act(text, jsonb) to authenticated;
grant execute on function public.billing_due_notices(), public.billing_notice_sent(uuid, text, text), public.cron_ok(text), public.payment_receipt(text) to service_role;
grant execute on all functions in schema private to authenticated;
