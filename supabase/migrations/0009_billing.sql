-- VeritBooks: the free trial, the annual plans, the founding firm offer and payments.
-- Run once, after 0008. It only adds things: nothing is dropped and no data is removed.
--
-- A firm is in one of three states. 'trial' for 14 days from the day it is created,
-- 'active' while a paid year is running, and 'expired' otherwise. An expired firm can
-- read and download everything it has, and change nothing, until a partner pays.
-- A file can only be signed on a paid plan.

create table public.plans (
  code text primary key,
  name text not null,
  price_kobo bigint not null check (price_kobo >= 0), -- for one year
  max_users integer,                                  -- null means no limit
  max_engagements integer not null,                   -- new engagements in a year (in the trial: in total)
  sort integer not null default 0
);
insert into public.plans (code, name, price_kobo, max_users, max_engagements, sort) values
  ('trial',    'Free trial', 0,          3,    3,   0),
  ('solo',     'Solo',       18000000,   3,    15,  1),
  ('practice', 'Practice',   48000000,   8,    50,  2),
  ('firm',     'Firm',       120000000,  null, 150, 3);

alter table public.firms add column plan text not null default 'trial' references public.plans (code);
alter table public.firms add column trial_ends_at timestamptz not null default (now() + interval '14 days');
alter table public.firms add column paid_until timestamptz;
-- The founding firm offer: the first 20 firms to pay get 40% off their first year, and
-- the prices on the day they joined are held for two years.
alter table public.firms add column founding_number integer unique check (founding_number between 1 and 20);
alter table public.firms add column price_lock_until timestamptz;
alter table public.firms add column locked_prices jsonb;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  tx_ref text not null unique,
  plan text not null references public.plans (code),
  amount_kobo bigint not null check (amount_kobo > 0),
  list_kobo bigint not null,
  founding boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_id text,                     -- Flutterwave's transaction id, once paid
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  covers_until timestamptz
);
create index payments_firm_idx on public.payments (firm_id, created_at);

alter table public.plans enable row level security;
alter table public.payments enable row level security;
create policy plans_select on public.plans for select to authenticated using (true);
create policy payments_select on public.payments for select to authenticated using (private.is_member(firm_id));
-- Members can read these. Nobody can write them from the browser.
revoke all on public.plans, public.payments from anon, authenticated;
grant select on public.plans, public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- State, and what it allows
-- ---------------------------------------------------------------------------

create function private.firm_state(p_firm uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when f.paid_until > now() then 'active'
              when f.trial_ends_at > now() then 'trial'
              else 'expired' end
  from public.firms f where f.id = p_firm;
$$;

-- The plan whose limits apply now. A lapsed firm keeps the limits of the trial.
create function private.firm_plan(p_firm uuid) returns public.plans
language sql stable security definer set search_path = '' as $$
  select p.* from public.firms f
  join public.plans p on p.code = case when f.paid_until > now() then f.plan else 'trial' end
  where f.id = p_firm;
$$;

-- Engagements counted against the allowance: all of them in the trial, and those
-- created since the start of the current paid year otherwise.
create function private.engagements_used(p_firm uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.engagements e
  join public.firms f on f.id = e.firm_id
  where f.id = p_firm
    and (f.paid_until is null or f.paid_until <= now()
         or e.created_at >= f.paid_until - make_interval(years => ceil(extract(epoch from f.paid_until - now()) / 31557600.0)::integer));
$$;

create function private.require_open(p_firm uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  -- The state is null while the firm itself is being deleted.
  if private.firm_state(p_firm) = 'expired' then
    raise exception 'Your firm''s plan is not active, so the file is read-only. A partner can choose a plan under Billing.' using errcode = 'P0001';
  end if;
end;
$$;

-- Billing columns are changed only by the payment functions below, never from the browser.
create function private.guard_firm_billing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.plan is distinct from old.plan or new.trial_ends_at is distinct from old.trial_ends_at
       or new.paid_until is distinct from old.paid_until or new.founding_number is distinct from old.founding_number
       or new.price_lock_until is distinct from old.price_lock_until or new.locked_prices is distinct from old.locked_prices) then
    raise exception 'Plan details cannot be changed here.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger firms_billing_guard before update on public.firms
  for each row execute function private.guard_firm_billing();

-- Everything inside an engagement.
create or replace function private.guard_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_engagement uuid;
  v_status text;
  v_firm uuid;
begin
  if tg_op = 'DELETE' then v_engagement := old.engagement_id; else v_engagement := new.engagement_id; end if;
  select status, firm_id into v_status, v_firm from public.engagements where id = v_engagement;
  -- v_status is null while the engagement itself is being deleted (cascade).
  if v_status = 'locked' then
    raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
  end if;
  if v_firm is not null then perform private.require_open(v_firm); end if;
  if tg_op = 'UPDATE' and new.engagement_id is distinct from old.engagement_id then
    raise exception 'A row cannot be moved to another engagement.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function private.guard_engagement_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans;
begin
  if tg_op = 'DELETE' then
    perform private.require_open(old.firm_id);
    return old;
  end if;
  perform private.require_open(new.firm_id);
  if tg_op = 'INSERT' then
    v_plan := private.firm_plan(new.firm_id);
    if private.engagements_used(new.firm_id) >= v_plan.max_engagements then
      raise exception 'Your % plan allows % engagements. A partner can change the plan under Billing.',
        v_plan.name, v_plan.max_engagements using errcode = 'P0001';
    end if;
  elsif new.status = 'locked' and old.status <> 'locked' and private.firm_state(new.firm_id) <> 'active' then
    raise exception 'A file can be signed once your firm is on a paid plan. A partner can choose one under Billing.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger engagements_plan_guard before insert or update or delete on public.engagements
  for each row execute function private.guard_engagement_plan();

-- Firm-level records: clients, and the quality management register.
create function private.guard_firm_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.require_open(old.firm_id);
    return old;
  end if;
  perform private.require_open(new.firm_id);
  return new;
end;
$$;
create trigger clients_plan_guard before insert or update or delete on public.clients
  for each row execute function private.guard_firm_rows();
create trigger quality_items_plan_guard before insert or update or delete on public.quality_items
  for each row execute function private.guard_firm_rows();
create trigger quality_evaluations_plan_guard before insert on public.quality_evaluations
  for each row execute function private.guard_firm_rows();

create function private.guard_member_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans := private.firm_plan(new.firm_id);
begin
  if v_plan.max_users is not null
     and (select count(*) from public.firm_members where firm_id = new.firm_id) >= v_plan.max_users then
    raise exception 'This firm''s % plan allows % users. A partner can change the plan under Billing.',
      v_plan.name, v_plan.max_users using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger firm_members_limit before insert on public.firm_members
  for each row execute function private.guard_member_limit();

-- ---------------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------------

create function private.founding_taken() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.firms where founding_number is not null;
$$;

-- What a firm pays today for a year of a plan, and whether that is the founding price.
create function private.quote(p_firm uuid, p_plan text, out amount_kobo bigint, out list_kobo bigint, out founding boolean)
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
  elsif not exists (select 1 from public.payments where firm_id = p_firm and status = 'paid') then
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

-- Everything the Billing page shows.
create function public.billing_overview() returns jsonb
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
    'plan', v_plan.code,
    'plan_name', v_plan.name,
    'trial_ends_at', v_firm.trial_ends_at,
    'paid_until', v_firm.paid_until,
    'founding_number', v_firm.founding_number,
    'price_lock_until', v_firm.price_lock_until,
    'founding_left', greatest(20 - private.founding_taken(), 0),
    'engagements_used', private.engagements_used(v_firm.id),
    'max_engagements', v_plan.max_engagements,
    'users', (select count(*) from public.firm_members where firm_id = v_firm.id),
    'max_users', v_plan.max_users,
    'plans', (
      select jsonb_agg(jsonb_build_object(
        'code', p.code, 'name', p.name, 'max_users', p.max_users, 'max_engagements', p.max_engagements,
        'list_kobo', q.list_kobo, 'amount_kobo', q.amount_kobo, 'founding', q.founding) order by p.sort)
      from public.plans p, private.quote(v_firm.id, p.code) q
      where p.code <> 'trial'),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id, 'plan', y.plan, 'amount_kobo', y.amount_kobo, 'founding', y.founding,
        'paid_at', y.paid_at, 'covers_until', y.covers_until, 'tx_ref', y.tx_ref) order by y.paid_at desc)
      from public.payments y where y.firm_id = v_firm.id and y.status = 'paid'), '[]'::jsonb)
  );
end;
$$;

-- A partner starts a payment. The price is fixed here, on the server, and recorded
-- before the partner is sent to pay.
create function public.billing_start(p_plan text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_q record;
  v_ref text := 'vb-' || replace(gen_random_uuid()::text, '-', '');
begin
  select f.* into v_firm from public.firms f
  join public.firm_members m on m.firm_id = f.id and m.user_id = auth.uid() and m.role = 'partner';
  if v_firm.id is null then
    raise exception 'Only a partner can choose a plan.' using errcode = 'P0001';
  end if;
  select * into v_q from private.quote(v_firm.id, p_plan);
  insert into public.payments (firm_id, tx_ref, plan, amount_kobo, list_kobo, founding, created_by)
  values (v_firm.id, v_ref, p_plan, v_q.amount_kobo, v_q.list_kobo, v_q.founding, auth.uid());
  return jsonb_build_object('tx_ref', v_ref, 'amount_kobo', v_q.amount_kobo, 'founding', v_q.founding,
                            'firm', v_firm.name, 'plan', (select name from public.plans where code = p_plan));
end;
$$;

-- Called by the billing function once the payment provider has confirmed a payment.
-- Safe to call twice for the same payment: the second call changes nothing.
create function public.apply_payment(p_tx_ref text, p_provider_id text, p_amount_kobo bigint, p_currency text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_firm public.firms;
  v_until timestamptz;
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
  perform pg_advisory_xact_lock(hashtext('veritbooks.founding'));
  select * into v_firm from public.firms where id = v_pay.firm_id for update;
  v_until := greatest(now(), coalesce(v_firm.paid_until, now())) + interval '1 year';
  update public.firms set
    plan = v_pay.plan,
    paid_until = v_until,
    founding_number = case when founding_number is null and v_pay.founding and private.founding_taken() < 20
                           then private.founding_taken() + 1 else founding_number end,
    price_lock_until = case when founding_number is null and v_pay.founding then now() + interval '2 years' else price_lock_until end,
    locked_prices = case when founding_number is null and v_pay.founding
                         then (select jsonb_object_agg(code, price_kobo) from public.plans where code <> 'trial')
                         else locked_prices end
  where id = v_pay.firm_id;
  update public.payments set status = 'paid', provider_id = p_provider_id, paid_at = now(), covers_until = v_until
  where id = v_pay.id;
  insert into public.audit_log (firm_id, table_name, action, row_id, user_id, detail)
  values (v_pay.firm_id, 'payments', 'paid', v_pay.id, v_pay.created_by,
          jsonb_build_object('plan', v_pay.plan, 'amount_kobo', v_pay.amount_kobo, 'founding', v_pay.founding, 'until', v_until));
  return 'paid';
end;
$$;

revoke execute on function public.billing_overview() from public, anon;
revoke execute on function public.billing_start(text) from public, anon;
revoke execute on function public.apply_payment(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.billing_overview() to authenticated;
grant execute on function public.billing_start(text) to authenticated;
grant execute on function public.apply_payment(text, text, bigint, text) to service_role;
grant execute on all functions in schema private to authenticated;
