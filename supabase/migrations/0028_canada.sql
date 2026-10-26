-- 0028: Canada, outside Quebec. Run once, after 0027.
--
-- Canadian firms are priced in Canadian dollars. Until VeritBooks collects Canadian dollars,
-- Flutterwave collects US dollars at a rate the platform owner sets in the console (the
-- mechanism added for South Africa in 0018). GST/HST starts at nil: a non-resident digital
-- vendor registers only once its sales to unregistered Canadian buyers pass $30,000 a year.
-- Prices are a starting point for the platform owner to set in the Prices tab.

-- Part 1: the Canadian dollar.
alter table public.countries drop constraint countries_currency_check;
alter table public.countries add constraint countries_currency_check check (currency in ('NGN', 'GHS', 'USD', 'ZAR', 'CAD'));
alter table public.payments drop constraint payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency in ('NGN', 'GHS', 'USD', 'ZAR', 'CAD'));
alter table public.engagements drop constraint engagements_currency_check;
alter table public.engagements add constraint engagements_currency_check check (currency in ('NGN', 'GHS', 'SLE', 'LRD', 'GMD', 'ZAR', 'CAD', 'USD'));
alter table public.countries drop constraint countries_charge_currency_check;
alter table public.countries add constraint countries_charge_currency_check check (charge_currency in ('NGN', 'GHS', 'USD', 'ZAR', 'CAD'));

-- Part 2: Canada and its prices. C$1,200, 3,300 and 8,400 a year; C$150, 350, 600 and 300 an engagement.
insert into public.countries (code, name, currency, vat_percent, tax_label, min_charge, sort, charge_currency, charge_rate, rate_set_at) values
  ('CA', 'Canada', 'CAD', 0, 'GST/HST', 100, 7, 'USD', 0.72, now());
insert into public.country_plan_prices (country, plan, price) values
  ('CA', 'solo', 120000), ('CA', 'practice', 330000), ('CA', 'firm', 840000);
insert into public.country_engagement_prices (country, code, price) values
  ('CA', 'compilation', 15000), ('CA', 'review', 35000), ('CA', 'audit', 60000), ('CA', 'group', 30000);

create or replace function private.licence_label(p_country text) returns text
language sql immutable set search_path = '' as $$
  select case p_country
    when 'GH' then 'ICAG practising licence number'
    when 'SL' then 'ICASL practising certificate number'
    when 'LR' then 'LICPA licence number'
    when 'GM' then 'GICA practising certificate number'
    when 'ZA' then 'IRBA registration number'
    when 'CA' then 'public accounting licence number'
    else 'FRC registration number' end;
$$;

-- Part 3: the platform owner may collect in Canadian dollars once Flutterwave allows it.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.admin_act(text, jsonb)'::regprocedure);
  if position('if v_cur not in (''NGN'', ''GHS'', ''USD'', ''ZAR'') then' in v_def) = 0 then
    raise exception 'admin_act is not as expected';
  end if;
  v_def := replace(v_def, 'if v_cur not in (''NGN'', ''GHS'', ''USD'', ''ZAR'') then', 'if v_cur not in (''NGN'', ''GHS'', ''USD'', ''ZAR'', ''CAD'') then');
  v_def := replace(v_def, 'Choose naira, cedis, US dollars or rand.', 'Choose naira, cedis, US dollars, rand or Canadian dollars.');
  execute v_def;
end;
$$;

-- Part 4: each trial balance account's GIFI code, for the T2 return's Schedules 100 and 125.
-- Kept with the account, so a revised trial balance keeps the codes already chosen.
alter table public.tb_lines add column if not exists gifi text check (gifi is null or gifi ~ '^[0-9]{4}$');
