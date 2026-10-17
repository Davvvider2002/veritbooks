-- VeritBooks: English-speaking West Africa. Run once, after 0015. Nothing is removed.
--
-- A firm now belongs to a country: Nigeria, Ghana, Sierra Leone, Liberia or The Gambia. The
-- country sets the law its reports cite, the licence its partners sign with, and its prices.
-- Each country has its own price list, in the currency the firm is charged in, and its own tax
-- rate on that charge. Flutterwave collects naira and cedis locally. Sierra Leone, Liberia and
-- The Gambia are charged in US dollars.
--
-- Amounts on a payment, a plan or a price are in the minor unit of the payment's currency:
-- kobo, pesewas or cents. The columns keep their old _kobo names.

-- ---------------------------------------------------------------------------
-- Countries and their price lists
-- ---------------------------------------------------------------------------

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  currency text not null check (currency in ('NGN', 'GHS', 'USD')),
  vat_percent numeric(5, 2) not null default 0 check (vat_percent >= 0 and vat_percent <= 50),
  tax_label text not null default 'VAT' check (length(trim(tax_label)) between 1 and 30),
  -- The least a firm ever pays, after credit for an earlier plan.
  min_charge bigint not null check (min_charge > 0),
  enabled boolean not null default true,
  sort integer not null default 0
);

-- Nigeria keeps the VAT rate already set in the console. The other countries start at none:
-- the platform owner sets each one once registered there, or once advised none is due.
insert into public.countries (code, name, currency, vat_percent, tax_label, min_charge, sort) values
  ('NG', 'Nigeria',      'NGN', (select vat_percent from public.platform_settings), 'VAT', 100000, 1),
  ('GH', 'Ghana',        'GHS', 0, 'VAT', 1000, 2),
  ('SL', 'Sierra Leone', 'USD', 0, 'GST', 100, 3),
  ('LR', 'Liberia',      'USD', 0, 'GST', 100, 4),
  ('GM', 'The Gambia',   'USD', 0, 'VAT', 100, 5);

create table public.country_plan_prices (
  country text not null references public.countries (code),
  plan text not null references public.plans (code),
  price bigint not null check (price > 0),
  primary key (country, plan)
);
create table public.country_engagement_prices (
  country text not null references public.countries (code),
  code text not null references public.engagement_prices (code),
  price bigint not null check (price > 0),
  primary key (country, code)
);

-- Nigeria keeps the prices already set. The others start at these, all before tax.
insert into public.country_plan_prices (country, plan, price)
  select 'NG', code, price_kobo from public.plans where code <> 'trial';
insert into public.country_plan_prices (country, plan, price) values
  ('GH', 'solo', 150000), ('GH', 'practice', 400000), ('GH', 'firm', 1000000),           -- GH₵1,500, 4,000, 10,000
  ('SL', 'solo', 9900), ('SL', 'practice', 27900), ('SL', 'firm', 69900),                -- US$99, 279, 699
  ('LR', 'solo', 9900), ('LR', 'practice', 27900), ('LR', 'firm', 69900),
  ('GM', 'solo', 9900), ('GM', 'practice', 27900), ('GM', 'firm', 69900);
insert into public.country_engagement_prices (country, code, price)
  select 'NG', code, price_kobo from public.engagement_prices;
insert into public.country_engagement_prices (country, code, price) values
  ('GH', 'compilation', 9000), ('GH', 'review', 22000), ('GH', 'audit', 35000), ('GH', 'group', 18000),
  ('SL', 'compilation', 700), ('SL', 'review', 1500), ('SL', 'audit', 2500), ('SL', 'group', 1200),
  ('LR', 'compilation', 700), ('LR', 'review', 1500), ('LR', 'audit', 2500), ('LR', 'group', 1200),
  ('GM', 'compilation', 700), ('GM', 'review', 1500), ('GM', 'audit', 2500), ('GM', 'group', 1200);

alter table public.countries enable row level security;
alter table public.country_plan_prices enable row level security;
alter table public.country_engagement_prices enable row level security;
create policy countries_select on public.countries for select to anon, authenticated using (true);
create policy country_plan_prices_select on public.country_plan_prices for select to anon, authenticated using (true);
create policy country_engagement_prices_select on public.country_engagement_prices for select to anon, authenticated using (true);
revoke all on public.countries, public.country_plan_prices, public.country_engagement_prices from anon, authenticated;
grant select on public.countries, public.country_plan_prices, public.country_engagement_prices to anon, authenticated;

alter table public.firms add column country text not null default 'NG' references public.countries (code);
alter table public.engagements add column currency text not null default 'NGN'
  check (currency in ('NGN', 'GHS', 'SLE', 'LRD', 'GMD', 'USD'));
alter table public.payments add column currency text not null default 'NGN' check (currency in ('NGN', 'GHS', 'USD'));

-- A firm's country is changed only by the functions below, never from the browser.
create function private.guard_firm_country() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.country is distinct from old.country then
    raise exception 'The country is changed in Firm settings.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger firms_country_guard before update on public.firms
  for each row execute function private.guard_firm_country();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.firm_country(p_firm uuid) returns public.countries
language sql stable security definer set search_path = '' as $$
  select c.* from public.countries c join public.firms f on f.country = c.code where f.id = p_firm;
$$;

create function private.plan_price(p_country text, p_plan text) returns bigint
language sql stable security definer set search_path = '' as $$
  select price from public.country_plan_prices where country = p_country and plan = p_plan;
$$;

create function private.engagement_price(p_country text, p_code text) returns bigint
language sql stable security definer set search_path = '' as $$
  select price from public.country_engagement_prices where country = p_country and code = p_code;
$$;

-- The plan prices a founding firm keeps for two years, in its own currency.
create function private.country_prices(p_country text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(plan, price), '{}'::jsonb) from public.country_plan_prices where country = p_country;
$$;

-- The licence a partner signs with, as the firm's country names it.
create function private.licence_label(p_country text) returns text
language sql immutable set search_path = '' as $$
  select case p_country
    when 'GH' then 'ICAG practising licence number'
    when 'SL' then 'ICASL practising certificate number'
    when 'LR' then 'LICPA licence number'
    when 'GM' then 'GICA practising certificate number'
    else 'FRC registration number' end;
$$;

-- ---------------------------------------------------------------------------
-- Prices by country
-- ---------------------------------------------------------------------------

create or replace function private.quote(p_firm uuid, p_plan text, out amount_kobo bigint, out list_kobo bigint, out founding boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_reserved integer;
begin
  select * into v_firm from public.firms where id = p_firm;
  list_kobo := case when p_plan <> 'trial' then private.plan_price(v_firm.country, p_plan) end;
  if list_kobo is null then
    raise exception 'That plan is not available.' using errcode = 'P0001';
  end if;
  founding := false;
  amount_kobo := list_kobo;
  if v_firm.founding_number is not null then
    if v_firm.price_lock_until > now() and v_firm.locked_prices ? p_plan then
      amount_kobo := least(list_kobo, (v_firm.locked_prices ->> p_plan)::bigint);
    end if;
  elsif not exists (select 1 from public.payments where firm_id = p_firm and status = 'paid' and kind = 'plan') then
    select count(distinct y.firm_id) into v_reserved from public.payments y
    where y.founding and y.status = 'pending' and y.firm_id <> p_firm and y.created_at > now() - interval '30 minutes';
    if private.founding_taken() + v_reserved < 20 then
      founding := true;
      amount_kobo := list_kobo * 60 / 100;
    end if;
  end if;
end;
$$;

create or replace function private.plan_quote(p_firm uuid, p_plan text, out amount_kobo bigint, out list_kobo bigint,
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
  v_current := coalesce(private.plan_price(v_firm.country, v_firm.plan), 0);
  if list_kobo > v_current then
    mode := 'upgrade';
    select coalesce(floor(sum((y.amount_kobo - y.vat_kobo + y.credit_kobo)
             * extract(epoch from y.covers_until - greatest(now(), y.covers_until - interval '1 year'))
             / extract(epoch from interval '1 year'))), 0)::bigint
    into credit_kobo
    from public.payments y
    where y.firm_id = p_firm and y.status = 'paid' and y.kind = 'plan' and y.covers_until > now();
    credit_kobo := greatest(least(credit_kobo, amount_kobo - (private.firm_country(p_firm)).min_charge), 0);
    amount_kobo := amount_kobo - credit_kobo;
  elsif v_firm.paid_until - now() > interval '30 days' then
    mode := 'later';
  else
    mode := 'switch';
  end if;
end;
$$;

-- Single engagements are priced in the firm's own currency.
create or replace function public.billing_checkout_net(p jsonb) returns jsonb
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
    v_amount := case when v_type <> 'group' then private.engagement_price(v_firm.country, v_type) end;
    select name into v_what from public.engagement_prices where code = v_type;
    if v_amount is null then
      raise exception 'Choose audit, review or compilation.' using errcode = 'P0001';
    end if;
    v_what := 'One ' || lower(v_what) || ' engagement';
    if v_group then
      v_amount := v_amount + private.engagement_price(v_firm.country, 'group');
      v_what := v_what || ' with group consolidation';
    end if;
  elsif v_kind = 'group' then
    if v_eng.id is null or not v_eng.pay_per or v_eng.group_addon then
      raise exception 'The consolidation add-on is for an engagement paid for on its own.' using errcode = 'P0001';
    end if;
    v_amount := private.engagement_price(v_firm.country, 'group');
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

-- Tax at the firm's country rate, and the payment recorded in the firm's currency.
create or replace function public.billing_checkout_vat(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_start jsonb := public.billing_checkout_net(p);
  v_c public.countries;
  v_net bigint := (v_start ->> 'amount_kobo')::bigint;
  v_vat bigint;
begin
  select c.* into v_c from public.payments y join public.firms f on f.id = y.firm_id join public.countries c on c.code = f.country
  where y.tx_ref = v_start ->> 'tx_ref';
  v_vat := round(v_net * v_c.vat_percent / 100);
  update public.payments set vat_kobo = v_vat, amount_kobo = v_net + v_vat, currency = v_c.currency where tx_ref = v_start ->> 'tx_ref';
  return v_start || jsonb_build_object('amount_kobo', v_net + v_vat, 'net_kobo', v_net, 'vat_kobo', v_vat,
    'currency', v_c.currency, 'tax_label', v_c.tax_label, 'country', v_c.code);
end;
$$;

create or replace function public.billing_overview_vat() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.billing_overview_net();
  v_firm public.firms;
  v_c public.countries;
begin
  select f.* into v_firm from public.firms f join public.firm_members m on m.firm_id = f.id where m.user_id = auth.uid();
  v_c := private.firm_country(v_firm.id);
  return v || jsonb_build_object(
    'country', v_c.code,
    'currency', v_c.currency,
    'tax_label', v_c.tax_label,
    'vat_percent', v_c.vat_percent,
    'can_change_country', not exists (select 1 from public.payments where firm_id = v_firm.id and status = 'paid')
                          and not exists (select 1 from public.engagement_credits where firm_id = v_firm.id),
    'engagement_prices', (select jsonb_agg(jsonb_build_object('code', e.code, 'name', e.name, 'price_kobo', x.price) order by e.sort)
                          from public.engagement_prices e join public.country_engagement_prices x on x.code = e.code and x.country = v_c.code),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id, 'kind', y.kind, 'plan', y.plan, 'engagement_type', y.engagement_type, 'with_group', y.with_group,
        'amount_kobo', y.amount_kobo, 'vat_kobo', y.vat_kobo, 'credit_kobo', y.credit_kobo, 'founding', y.founding, 'source', y.source,
        'paid_at', y.paid_at, 'covers_until', y.covers_until, 'tx_ref', y.tx_ref, 'receipt_no', y.receipt_no, 'currency', y.currency) order by y.paid_at desc)
      from public.payments y where y.firm_id = v_firm.id and y.status = 'paid'), '[]'::jsonb));
end;
$$;

create or replace function public.payment_receipt(p_tx_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.payment_receipt_net(p_tx_ref)
    || jsonb_build_object('vat_kobo', y.vat_kobo, 'currency', y.currency,
         'tax_label', (select c.tax_label from public.firms f join public.countries c on c.code = f.country where f.id = y.firm_id))
  from public.payments y where y.tx_ref = p_tx_ref;
$$;

-- The provider must report the payment's own currency, not only naira.
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
  if upper(coalesce(p_currency, '')) <> v_pay.currency or coalesce(p_amount_kobo, 0) < v_pay.amount_kobo then
    raise exception 'The amount paid does not match the amount due.' using errcode = 'P0001';
  end if;
  perform private.fulfil(v_pay.id, p_provider_id);
  return 'paid';
end;
$$;

-- A founding firm keeps the prices of its own country.
create or replace function private.fulfil(p_payment uuid, p_provider_id text) returns void
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
      locked_prices = case when founding_number is null and v_pay.founding then private.country_prices(v_firm.country) else locked_prices end,
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
            'amount_kobo', v_pay.amount_kobo, 'currency', v_pay.currency, 'founding', nullif(v_pay.founding, false), 'until', v_until)));
end;
$$;

-- The price list for one country, for visitors choosing where they practise.
create function public.public_prices(p_country text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'country', c.code,
    'currency', c.currency,
    'tax_label', c.tax_label,
    'vat_percent', c.vat_percent,
    'plans', (select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'price_kobo', x.price,
                'max_users', p.max_users, 'max_engagements', p.max_engagements) order by p.sort)
              from public.plans p join public.country_plan_prices x on x.plan = p.code and x.country = c.code),
    'engagement_prices', (select jsonb_agg(jsonb_build_object('code', e.code, 'name', e.name, 'price_kobo', x.price) order by e.sort)
                          from public.engagement_prices e join public.country_engagement_prices x on x.code = e.code and x.country = c.code),
    'countries', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'currency', currency) order by sort)
                  from public.countries where enabled),
    'founding_left', greatest(20 - private.founding_taken(), 0),
    'support_email', (select support_email from public.platform_settings))
  from public.countries c where c.code = upper(p_country) and c.enabled;
$$;

create or replace function public.public_prices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.public_prices('NG');
$$;

-- ---------------------------------------------------------------------------
-- Choosing the country
-- ---------------------------------------------------------------------------

create function public.create_firm(p_name text, p_frc_number text, p_address text,
                                   p_full_name text, p_member_frc text, p_country text)
returns public.firms
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
begin
  if not exists (select 1 from public.countries where code = upper(coalesce(p_country, '')) and enabled) then
    raise exception 'Choose the country where your firm practises.' using errcode = 'P0001';
  end if;
  v_firm := public.create_firm(p_name, p_frc_number, p_address, p_full_name, p_member_frc);
  update public.firms set country = upper(p_country) where id = v_firm.id returning * into v_firm;
  return v_firm;
end;
$$;

-- A partner may change the country until the firm has paid for anything. After that the
-- platform owner does it, because the prices and currency of what was paid would change.
create function public.set_firm_country(p_country text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
begin
  perform private.require_mfa();
  select m.firm_id into v_firm from public.firm_members m where m.user_id = auth.uid() and m.role = 'partner';
  if v_firm is null then
    raise exception 'Only a partner can change the firm''s country.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.countries where code = upper(coalesce(p_country, '')) and enabled) then
    raise exception 'That country is not available.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where firm_id = v_firm and status = 'paid')
     or exists (select 1 from public.engagement_credits where firm_id = v_firm) then
    raise exception 'Your firm has already paid in its current currency. Please contact VeritBooks support to change the country.' using errcode = 'P0001';
  end if;
  update public.firms set country = upper(p_country), locked_prices = null where id = v_firm;
end;
$$;

-- ---------------------------------------------------------------------------
-- The platform owner's console
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.admin_overview_net();
begin
  return v || jsonb_build_object(
    'vat_kobo', (select coalesce(sum(vat_kobo), 0) from public.payments where status = 'paid'),
    'vat_month_kobo', (select coalesce(sum(vat_kobo), 0) from public.payments where status = 'paid' and paid_at >= date_trunc('month', now())),
    'settings', (v -> 'settings') || jsonb_build_object('vat_percent', (select vat_percent from public.countries where code = 'NG')),
    'firms', coalesce((
      select jsonb_agg(x.j || jsonb_build_object('country', f.country) order by x.n)
      from jsonb_array_elements(v -> 'firms') with ordinality x(j, n) join public.firms f on f.id = (x.j ->> 'id')::uuid), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(x.j || jsonb_build_object('currency', y.currency, 'vat_kobo', y.vat_kobo) order by x.n)
      from jsonb_array_elements(v -> 'payments') with ordinality x(j, n) join public.payments y on y.id = (x.j ->> 'id')::uuid), '[]'::jsonb),
    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object('currency', r.currency, 'total_kobo', r.total, 'month_kobo', r.month,
                                          'vat_kobo', r.vat, 'vat_month_kobo', r.vat_month) order by r.currency)
      from (select y.currency, sum(y.amount_kobo) as total,
                   sum(y.amount_kobo) filter (where y.paid_at >= date_trunc('month', now())) as month,
                   sum(y.vat_kobo) as vat,
                   sum(y.vat_kobo) filter (where y.paid_at >= date_trunc('month', now())) as vat_month
            from public.payments y where y.status = 'paid' group by y.currency) r), '[]'::jsonb),
    'countries', (
      select jsonb_agg(jsonb_build_object(
        'code', c.code, 'name', c.name, 'currency', c.currency, 'vat_percent', c.vat_percent, 'tax_label', c.tax_label,
        'min_charge', c.min_charge, 'enabled', c.enabled,
        'firms', (select count(*) from public.firms f where f.country = c.code),
        'plans', (select jsonb_object_agg(plan, price) from public.country_plan_prices where country = c.code),
        'engagement_prices', (select jsonb_object_agg(code, price) from public.country_engagement_prices where country = c.code)
      ) order by c.sort)
      from public.countries c));
end;
$$;

create or replace function public.admin_act(p_action text, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric;
  v_amount bigint;
  v_country text := upper(coalesce(p ->> 'country', ''));
  v_firm uuid := nullif(p ->> 'firm', '')::uuid;
begin
  -- The country actions are handled here. Everything else goes to the earlier function,
  -- which refuses anyone who is not an admin.
  if p_action in ('country_price', 'country_engagement_price', 'country_settings', 'set_country', 'plan_limits') then
    if not private.is_admin() then
      raise exception 'Not found.' using errcode = 'P0001';
    end if;
    if p_action <> 'plan_limits' and not exists (select 1 from public.countries where code = v_country) then
      raise exception 'Country not found.' using errcode = 'P0001';
    end if;
    v_amount := round((p ->> 'price')::numeric * 100);
    if p_action = 'country_price' then
      if v_amount is null or v_amount <= 0 then
        raise exception 'Give a price above zero.' using errcode = 'P0001';
      end if;
      update public.country_plan_prices set price = v_amount where country = v_country and plan = p ->> 'plan';
      if not found then raise exception 'Plan not found.' using errcode = 'P0001'; end if;
      if v_country = 'NG' then update public.plans set price_kobo = v_amount where code = p ->> 'plan'; end if;
    elsif p_action = 'country_engagement_price' then
      if v_amount is null or v_amount <= 0 then
        raise exception 'Give a price above zero.' using errcode = 'P0001';
      end if;
      update public.country_engagement_prices set price = v_amount where country = v_country and code = p ->> 'code';
      if not found then raise exception 'Price not found.' using errcode = 'P0001'; end if;
      if v_country = 'NG' then update public.engagement_prices set price_kobo = v_amount where code = p ->> 'code'; end if;
    elsif p_action = 'country_settings' then
      v_rate := (p ->> 'vat_percent')::numeric;
      if v_rate is null or v_rate < 0 or v_rate > 50 then
        raise exception 'Give a tax rate between 0 and 50.' using errcode = 'P0001';
      end if;
      if length(trim(coalesce(p ->> 'tax_label', ''))) not between 1 and 30 then
        raise exception 'Name the tax, for example VAT.' using errcode = 'P0001';
      end if;
      if v_country = 'NG' and not coalesce((p ->> 'enabled')::boolean, true) then
        raise exception 'Nigeria cannot be closed to new firms.' using errcode = 'P0001';
      end if;
      update public.countries set vat_percent = v_rate, tax_label = trim(p ->> 'tax_label'),
        enabled = coalesce((p ->> 'enabled')::boolean, enabled)
      where code = v_country;
      if v_country = 'NG' then update public.platform_settings set vat_percent = v_rate where id; end if;
    elsif p_action = 'set_country' then
      if not exists (select 1 from public.firms where id = v_firm) then
        raise exception 'Firm not found.' using errcode = 'P0001';
      end if;
      update public.firms set country = v_country,
        locked_prices = case when founding_number is not null then private.country_prices(v_country) else locked_prices end
      where id = v_firm;
    elsif p_action = 'plan_limits' then
      if coalesce((p ->> 'max_engagements')::integer, 0) < 1 or coalesce(nullif(p ->> 'max_users', '')::integer, 1) < 1 then
        raise exception 'Give allowances above zero.' using errcode = 'P0001';
      end if;
      update public.plans set max_engagements = (p ->> 'max_engagements')::integer, max_users = nullif(p ->> 'max_users', '')::integer
      where code = p ->> 'plan' and code <> 'trial';
      if not found then raise exception 'Plan not found.' using errcode = 'P0001'; end if;
    end if;
    insert into public.admin_log (admin_id, action, firm_id, detail) values (auth.uid(), p_action, v_firm, p - 'firm');
    return;
  end if;

  perform public.admin_act_net(p_action, p);
  if p_action = 'settings' and p ? 'vat_percent' then
    v_rate := (p ->> 'vat_percent')::numeric;
    if v_rate is null or v_rate < 0 or v_rate > 50 then
      raise exception 'Give a VAT rate between 0 and 50.' using errcode = 'P0001';
    end if;
    update public.platform_settings set vat_percent = v_rate where id;
    update public.countries set vat_percent = v_rate where code = 'NG';
  elsif p_action = 'record_payment' then
    -- The amount an admin records is what was received, tax included, in the firm's currency.
    update public.payments y set
      currency = c.currency,
      list_kobo = coalesce(private.plan_price(c.code, y.plan), y.list_kobo),
      vat_kobo = y.amount_kobo - round(y.amount_kobo / (1 + c.vat_percent / 100))
    from public.firms f join public.countries c on c.code = f.country
    where f.id = y.firm_id
      and y.id = (select id from public.payments where firm_id = v_firm and source = 'manual' order by created_at desc limit 1);
  elsif p_action = 'founding' and coalesce((p ->> 'on')::boolean, false) then
    update public.firms set locked_prices = private.country_prices(country) where id = v_firm;
  elsif p_action = 'set_price' then
    -- The older price actions set the Nigerian list.
    update public.country_plan_prices x set price = y.price_kobo from public.plans y where y.code = x.plan and x.country = 'NG' and y.code = p ->> 'plan';
  elsif p_action = 'set_engagement_price' then
    update public.country_engagement_prices x set price = y.price_kobo from public.engagement_prices y where y.code = x.code and x.country = 'NG' and y.code = p ->> 'code';
  end if;
end;
$$;

revoke execute on function public.public_prices(text) from public;
grant execute on function public.public_prices(text) to anon, authenticated;
revoke execute on function public.create_firm(text, text, text, text, text, text), public.set_firm_country(text) from public, anon;
grant execute on function public.create_firm(text, text, text, text, text, text), public.set_firm_country(text) to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Signing names the licence the firm's country uses. Applied on its own, after the rest.
-- ---------------------------------------------------------------------------

alter function public.sign_engagement(uuid) rename to sign_engagement_mfa;
create function public.sign_engagement(p_engagement uuid) returns public.engagements
language plpgsql security definer set search_path = '' as $$
declare
  v_country text;
  v_member public.firm_members;
  v_firm public.firms;
begin
  select f.* into v_firm from public.engagements e join public.firms f on f.id = e.firm_id where e.id = p_engagement;
  select * into v_member from public.firm_members where firm_id = v_firm.id and user_id = auth.uid();
  if v_member.user_id is not null and v_member.role = 'partner' then
    v_country := v_firm.country;
    if trim(v_member.frc_number) = '' then
      raise exception 'Your % is missing.', private.licence_label(v_country) using errcode = 'P0001';
    end if;
    if trim(v_firm.frc_number) = '' then
      raise exception 'The firm''s % is missing.', private.licence_label(v_country) using errcode = 'P0001';
    end if;
  end if;
  return public.sign_engagement_mfa(p_engagement);
end;
$$;
revoke execute on function public.sign_engagement_mfa(uuid) from public, anon, authenticated;
revoke execute on function public.sign_engagement(uuid) from public, anon;
grant execute on function public.sign_engagement(uuid) to authenticated;
