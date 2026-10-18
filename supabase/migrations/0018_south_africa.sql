-- VeritBooks: South Africa, and collecting payment in another currency. Run once, after 0017.
--
-- South African firms are priced in rand. For any country, the platform owner can choose the
-- currency Flutterwave collects: the country's own price currency, or naira, cedis, US dollars
-- or rand, converted at a rate the owner sets. The firm always sees its price in its own
-- currency. A payment records what was charged (amount_kobo, vat_kobo, currency) and, when
-- converted, what it was quoted (quoted_kobo, quoted_vat_kobo, quoted_currency) and the rate.

-- Part 1: currencies. Run on its own.
alter table public.countries drop constraint countries_currency_check;
alter table public.countries add constraint countries_currency_check check (currency in ('NGN', 'GHS', 'USD', 'ZAR'));
alter table public.payments drop constraint payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency in ('NGN', 'GHS', 'USD', 'ZAR'));
alter table public.engagements drop constraint engagements_currency_check;
alter table public.engagements add constraint engagements_currency_check check (currency in ('NGN', 'GHS', 'SLE', 'LRD', 'GMD', 'ZAR', 'USD'));

-- Part 2: South Africa, the collection currency and the quoted amounts.
alter table public.countries add column charge_currency text check (charge_currency in ('NGN', 'GHS', 'USD', 'ZAR'));
-- Units of the charge currency for one unit of the price currency: 1 rand = 85 naira is 85.
alter table public.countries add column charge_rate numeric(18, 8) check (charge_rate > 0);
alter table public.countries add column rate_set_at timestamptz;
alter table public.countries add constraint countries_charge_rate check (charge_currency is null or charge_currency = currency or charge_rate is not null);

alter table public.payments add column quoted_currency text;
alter table public.payments add column quoted_kobo bigint;
alter table public.payments add column quoted_vat_kobo bigint;
alter table public.payments add column fx_rate numeric(18, 8);

-- South Africa starts with no tax added: VAT at 15% is set once VeritBooks is registered for it.
insert into public.countries (code, name, currency, vat_percent, tax_label, min_charge, sort) values
  ('ZA', 'South Africa', 'ZAR', 0, 'VAT', 2000, 6);
insert into public.country_plan_prices (country, plan, price) values
  ('ZA', 'solo', 350000), ('ZA', 'practice', 950000), ('ZA', 'firm', 2400000);         -- R3,500, 9,500, 24,000
insert into public.country_engagement_prices (country, code, price) values
  ('ZA', 'compilation', 25000), ('ZA', 'review', 60000), ('ZA', 'audit', 95000), ('ZA', 'group', 45000);

-- The currency a payment is collected in, and how many of it make one unit of the price.
create function private.charge_of(p_country text, out currency text, out rate numeric)
language sql stable security definer set search_path = '' as $$
  select case when c.charge_currency is null or c.charge_currency = c.currency then c.currency else c.charge_currency end,
         case when c.charge_currency is null or c.charge_currency = c.currency then 1 else c.charge_rate end
  from public.countries c where c.code = p_country;
$$;

create or replace function private.licence_label(p_country text) returns text
language sql immutable set search_path = '' as $$
  select case p_country
    when 'GH' then 'ICAG practising licence number'
    when 'SL' then 'ICASL practising certificate number'
    when 'LR' then 'LICPA licence number'
    when 'GM' then 'GICA practising certificate number'
    when 'ZA' then 'IRBA registration number'
    else 'FRC registration number' end;
$$;

-- Credit for the unused part of a plan is worked out in the price currency, from what was quoted.
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
    select coalesce(floor(sum((coalesce(y.quoted_kobo, y.amount_kobo) - coalesce(y.quoted_vat_kobo, y.vat_kobo) + y.credit_kobo)
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

-- Tax in the price currency, then converted, when the country collects in another currency.
create or replace function public.billing_checkout_vat(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_start jsonb := public.billing_checkout_net(p);
  v_c public.countries;
  v_charge record;
  v_net bigint := (v_start ->> 'amount_kobo')::bigint;
  v_vat bigint;
  v_net_c bigint;
  v_vat_c bigint;
begin
  select c.* into v_c from public.payments y join public.firms f on f.id = y.firm_id join public.countries c on c.code = f.country
  where y.tx_ref = v_start ->> 'tx_ref';
  select * into v_charge from private.charge_of(v_c.code);
  if v_charge.rate is null then
    raise exception 'Payments for % are not set up yet. Please contact VeritBooks support.', v_c.name using errcode = 'P0001';
  end if;
  v_vat := round(v_net * v_c.vat_percent / 100);
  v_net_c := round(v_net * v_charge.rate);
  v_vat_c := round(v_vat * v_charge.rate);
  update public.payments set
    vat_kobo = v_vat_c, amount_kobo = v_net_c + v_vat_c, currency = v_charge.currency,
    quoted_currency = case when v_charge.currency <> v_c.currency then v_c.currency end,
    quoted_kobo = case when v_charge.currency <> v_c.currency then v_net + v_vat end,
    quoted_vat_kobo = case when v_charge.currency <> v_c.currency then v_vat end,
    fx_rate = case when v_charge.currency <> v_c.currency then v_charge.rate end
  where tx_ref = v_start ->> 'tx_ref';
  return v_start || jsonb_build_object('amount_kobo', v_net_c + v_vat_c, 'net_kobo', v_net_c, 'vat_kobo', v_vat_c,
    'currency', v_charge.currency, 'tax_label', v_c.tax_label, 'country', v_c.code,
    'quoted_currency', v_c.currency, 'quoted_kobo', v_net + v_vat, 'fx_rate', v_charge.rate);
end;
$$;

create or replace function public.billing_overview_vat() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.billing_overview_net();
  v_firm public.firms;
  v_c public.countries;
  v_charge record;
begin
  select f.* into v_firm from public.firms f join public.firm_members m on m.firm_id = f.id where m.user_id = auth.uid();
  v_c := private.firm_country(v_firm.id);
  select * into v_charge from private.charge_of(v_c.code);
  return v || jsonb_build_object(
    'country', v_c.code,
    'currency', v_c.currency,
    'charge_currency', v_charge.currency,
    'charge_rate', v_charge.rate,
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
        'paid_at', y.paid_at, 'covers_until', y.covers_until, 'tx_ref', y.tx_ref, 'receipt_no', y.receipt_no, 'currency', y.currency,
        'quoted_currency', y.quoted_currency, 'quoted_kobo', y.quoted_kobo, 'quoted_vat_kobo', y.quoted_vat_kobo, 'fx_rate', y.fx_rate) order by y.paid_at desc)
      from public.payments y where y.firm_id = v_firm.id and y.status = 'paid'), '[]'::jsonb));
end;
$$;

create or replace function public.payment_receipt(p_tx_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.payment_receipt_net(p_tx_ref)
    || jsonb_build_object('vat_kobo', y.vat_kobo, 'currency', y.currency,
         'quoted_currency', y.quoted_currency, 'quoted_kobo', y.quoted_kobo, 'quoted_vat_kobo', y.quoted_vat_kobo, 'fx_rate', y.fx_rate,
         'tax_label', (select c.tax_label from public.firms f join public.countries c on c.code = f.country where f.id = y.firm_id))
  from public.payments y where y.tx_ref = p_tx_ref;
$$;

create or replace function public.public_prices(p_country text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'country', c.code,
    'currency', c.currency,
    'charge_currency', (private.charge_of(c.code)).currency,
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
      select jsonb_agg(x.j || jsonb_build_object('currency', y.currency, 'vat_kobo', y.vat_kobo,
               'quoted_currency', y.quoted_currency, 'quoted_kobo', y.quoted_kobo, 'fx_rate', y.fx_rate) order by x.n)
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
        'charge_currency', coalesce(c.charge_currency, c.currency), 'charge_rate', c.charge_rate, 'rate_set_at', c.rate_set_at,
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
  v_cur text;
begin
  if p_action in ('country_price', 'country_engagement_price', 'country_settings', 'set_country', 'plan_limits', 'country_charge') then
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
    elsif p_action = 'country_charge' then
      v_cur := upper(coalesce(p ->> 'charge_currency', ''));
      if v_cur not in ('NGN', 'GHS', 'USD', 'ZAR') then
        raise exception 'Choose naira, cedis, US dollars or rand.' using errcode = 'P0001';
      end if;
      if v_cur = (select currency from public.countries where code = v_country) then
        update public.countries set charge_currency = null, charge_rate = null, rate_set_at = null where code = v_country;
      else
        v_rate := (p ->> 'rate')::numeric;
        if v_rate is null or v_rate <= 0 or v_rate > 1000000 then
          raise exception 'Give the exchange rate: how many of the collected currency make one of the price currency.' using errcode = 'P0001';
        end if;
        update public.countries set charge_currency = v_cur, charge_rate = v_rate, rate_set_at = now() where code = v_country;
      end if;
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
    -- The amount an admin records is what was received, tax included, in the currency the country collects.
    update public.payments y set
      currency = ch.currency,
      list_kobo = coalesce(private.plan_price(c.code, y.plan), y.list_kobo),
      vat_kobo = y.amount_kobo - round(y.amount_kobo / (1 + c.vat_percent / 100)),
      quoted_currency = case when ch.currency <> c.currency then c.currency end,
      quoted_kobo = case when ch.currency <> c.currency then round(y.amount_kobo / ch.rate) end,
      quoted_vat_kobo = case when ch.currency <> c.currency then round(y.amount_kobo / ch.rate) - round(y.amount_kobo / ch.rate / (1 + c.vat_percent / 100)) end,
      fx_rate = case when ch.currency <> c.currency then ch.rate end
    from public.firms f join public.countries c on c.code = f.country cross join lateral private.charge_of(c.code) ch
    where f.id = y.firm_id
      and y.id = (select id from public.payments where firm_id = v_firm and source = 'manual' order by created_at desc limit 1);
  elsif p_action = 'founding' and coalesce((p ->> 'on')::boolean, false) then
    update public.firms set locked_prices = private.country_prices(country) where id = v_firm;
  elsif p_action = 'set_price' then
    update public.country_plan_prices x set price = y.price_kobo from public.plans y where y.code = x.plan and x.country = 'NG' and y.code = p ->> 'plan';
  elsif p_action = 'set_engagement_price' then
    update public.country_engagement_prices x set price = y.price_kobo from public.engagement_prices y where y.code = x.code and x.country = 'NG' and y.code = p ->> 'code';
  end if;
end;
$$;

grant execute on all functions in schema private to authenticated;
