-- VeritBooks: channel partners. Run once, after 0018.
--
-- A partner promotes VeritBooks with a personal link (veritbooks.com/?ref=CODE) or a code a
-- firm types at sign-up. A firm that arrives that way is credited to the partner. Every payment
-- the firm makes in the commission period earns the partner a share of what was paid, net of
-- VAT, in the currency it was paid in. A commission is held before it can be paid out, so
-- refunds and disputes surface first. The partner asks for a payout once the balance reaches
-- the minimum; the platform owner pays it by transfer and records the reference.
--
-- Every table is reached only through the functions below. A partner sees their own record,
-- the names of the firms they referred, and their money. Nothing else of any firm.

-- ---------------------------------------------------------------------------
-- Programme settings: one row
-- ---------------------------------------------------------------------------

create table public.partner_settings (
  id boolean primary key default true check (id),
  open boolean not null default true,                     -- whether new applications are taken
  default_percent numeric(5, 2) not null default 20 check (default_percent >= 0 and default_percent <= 100),
  default_months integer default 12 check (default_months is null or default_months between 1 and 120),
  hold_days integer not null default 45 check (hold_days between 0 and 365),
  cookie_days integer not null default 90 check (cookie_days between 1 and 365),
  -- The least a partner can be paid at once, in minor units, by currency.
  min_payout jsonb not null default '{"NGN": 2000000, "GHS": 20000, "USD": 2000, "ZAR": 30000}',
  terms_version text not null default '2026-10',
  updated_at timestamptz not null default now()
);
insert into public.partner_settings default values;

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null check (position('@' in email) > 1),
  name text not null check (length(trim(name)) > 0),
  company text not null default '',
  phone text not null default '',
  country text not null default 'NG' references public.countries (code),
  website text not null default '',
  -- How the partner means to promote VeritBooks: their audience and channels.
  promotion text not null default '',
  code text not null unique check (code ~ '^[A-Z0-9]{4,20}$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'rejected')),
  commission_percent numeric(5, 2) not null check (commission_percent >= 0 and commission_percent <= 100),
  -- Months from the referral in which payments earn commission. Null: for as long as the firm pays.
  commission_months integer check (commission_months is null or commission_months between 1 and 120),
  -- Bank or mobile money details for payouts, entered by the partner.
  payout_details jsonb not null default '{}',
  admin_notes text not null default '',
  terms_version text,
  terms_accepted_at timestamptz,
  created_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create unique index partners_email_idx on public.partners (lower(email));

create table public.partner_clicks (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners (id) on delete cascade,
  at timestamptz not null default now(),
  campaign text not null default '',
  path text not null default '',
  country text not null default ''
);
create index partner_clicks_idx on public.partner_clicks (partner_id, at);

-- The firm a partner brought in.
alter table public.firms add column referred_by uuid references public.partners (id) on delete set null;
alter table public.firms add column referred_at timestamptz;
alter table public.firms add column referral_campaign text not null default '';
-- Why the referral is held for the platform owner to check, such as an email domain shared with the partner.
alter table public.firms add column referral_review text;

create table public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  currency text not null check (currency in ('NGN', 'GHS', 'USD', 'ZAR')),
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  requested_by text not null default 'partner' check (requested_by in ('partner', 'admin')),
  -- The bank details as they stood when the payout was asked for.
  payout_details jsonb not null default '{}',
  decided_at timestamptz,
  decided_by uuid,
  reference text not null default '',
  method text not null default '',
  note text not null default ''
);
create index partner_payouts_idx on public.partner_payouts (partner_id, requested_at);

create table public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  firm_id uuid not null references public.firms (id) on delete cascade,
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  currency text not null,
  base_kobo bigint not null,            -- what the firm paid, net of VAT
  percent numeric(5, 2) not null,
  amount_kobo bigint not null,
  -- review: held for the platform owner; pending: in the hold, or payable once available_at has passed;
  -- requested: in a payout request; paid; void.
  status text not null default 'pending' check (status in ('review', 'pending', 'requested', 'paid', 'void')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null,
  payout_id uuid references public.partner_payouts (id) on delete set null,
  void_reason text not null default ''
);
create index partner_commissions_idx on public.partner_commissions (partner_id, status);

create table public.partner_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'copy' check (kind in ('copy', 'link')),
  body text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.partner_settings enable row level security;
alter table public.partners enable row level security;
alter table public.partner_clicks enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_assets enable row level security;
revoke all on public.partner_settings, public.partners, public.partner_clicks, public.partner_payouts,
  public.partner_commissions, public.partner_assets from anon, authenticated;

-- A firm cannot credit itself to a partner, or move its credit, by writing to its own row.
create function private.guard_firm_referral() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.referred_by is distinct from old.referred_by or new.referred_at is distinct from old.referred_at
       or new.referral_campaign is distinct from old.referral_campaign or new.referral_review is distinct from old.referral_review) then
    raise exception 'The referral cannot be changed here.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger firms_referral_guard before update on public.firms
  for each row execute function private.guard_firm_referral();

-- ---------------------------------------------------------------------------
-- Earning commission
-- ---------------------------------------------------------------------------

-- Called when a payment becomes paid, by checkout or recorded by the platform owner.
create function private.accrue_commission(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_firm public.firms;
  v_p public.partners;
  v_hold integer;
  v_base bigint;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or v_pay.status <> 'paid' then return; end if;
  select * into v_firm from public.firms where id = v_pay.firm_id;
  if v_firm.referred_by is null then return; end if;
  select * into v_p from public.partners where id = v_firm.referred_by;
  -- A partner who is not active earns nothing on payments made meanwhile.
  if v_p.id is null or v_p.status <> 'active' then return; end if;
  if v_p.commission_months is not null
     and coalesce(v_pay.paid_at, now()) > v_firm.referred_at + make_interval(months => v_p.commission_months) then
    return;
  end if;
  v_base := v_pay.amount_kobo - v_pay.vat_kobo;
  if v_base <= 0 then return; end if;
  select hold_days into v_hold from public.partner_settings;
  insert into public.partner_commissions (partner_id, firm_id, payment_id, currency, base_kobo, percent, amount_kobo, status, available_at)
  values (v_p.id, v_firm.id, v_pay.id, v_pay.currency, v_base, v_p.commission_percent,
          floor(v_base * v_p.commission_percent / 100), case when v_firm.referral_review is not null then 'review' else 'pending' end,
          coalesce(v_pay.paid_at, now()) + make_interval(days => coalesce(v_hold, 45)))
  on conflict (payment_id) do nothing;
end;
$$;

create function private.on_payment_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform private.accrue_commission(new.id);
  end if;
  return new;
end;
$$;
create trigger payments_partner_commission after insert or update of status on public.payments
  for each row execute function private.on_payment_paid();

-- ---------------------------------------------------------------------------
-- Public: the programme's terms, clicks and code checks
-- ---------------------------------------------------------------------------

create function public.partner_programme() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('open', s.open, 'percent', s.default_percent, 'months', s.default_months, 'hold_days', s.hold_days,
    'cookie_days', s.cookie_days, 'min_payout', s.min_payout, 'terms_version', s.terms_version)
  from public.partner_settings s;
$$;

-- Records a visit through a partner's link. Says only whether the code is live.
create function public.partner_click(p_code text, p_campaign text, p_path text, p_country text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.partners where code = upper(trim(p_code)) and status = 'active';
  if v_id is null then return false; end if;
  insert into public.partner_clicks (partner_id, campaign, path, country)
  values (v_id, left(coalesce(trim(p_campaign), ''), 60), left(coalesce(p_path, ''), 120), left(upper(coalesce(p_country, '')), 2));
  return true;
end;
$$;

-- The name to show beside a code a firm types, so it knows the code is right.
create function public.partner_lookup(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', case when company <> '' then company else name end)
  from public.partners where code = upper(trim(p_code)) and status = 'active';
$$;

-- A firm's partner credits it to the partner whose link or code brought it in. Only once,
-- before it has paid for anything, and within 30 days of the firm being set up.
create function public.claim_referral(p_code text, p_campaign text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_p public.partners;
  v_email text;
  v_domain text;
  v_review text;
begin
  select f.* into v_firm from public.firms f
    join public.firm_members m on m.firm_id = f.id and m.user_id = auth.uid() and m.role = 'partner'
    order by f.created_at desc limit 1;
  if v_firm.id is null then
    raise exception 'Only a partner of the firm can enter a referral code.' using errcode = 'P0001';
  end if;
  if v_firm.referred_by is not null then
    raise exception 'This firm already has a referral.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where firm_id = v_firm.id and status = 'paid') or v_firm.created_at < now() - interval '30 days' then
    raise exception 'A referral code can only be added in the first 30 days, before the firm has paid.' using errcode = 'P0001';
  end if;
  select * into v_p from public.partners where code = upper(trim(p_code)) and status = 'active';
  if v_p.id is null then
    raise exception 'That referral code was not found.' using errcode = 'P0001';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_p.user_id = auth.uid() or lower(v_p.email) = v_email then
    raise exception 'A partner cannot refer their own firm.' using errcode = 'P0001';
  end if;
  v_domain := split_part(v_email, '@', 2);
  if v_domain <> '' and v_domain = split_part(lower(v_p.email), '@', 2)
     and v_domain not in ('gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'mweb.co.za', 'webmail.co.za', 'ymail.com') then
    v_review := 'The firm''s email domain is the same as the partner''s.';
  end if;
  update public.firms set referred_by = v_p.id, referred_at = now(), referral_campaign = left(coalesce(trim(p_campaign), ''), 60), referral_review = v_review
    where id = v_firm.id;
  return jsonb_build_object('name', case when v_p.company <> '' then v_p.company else v_p.name end);
end;
$$;

-- ---------------------------------------------------------------------------
-- The partner's own portal
-- ---------------------------------------------------------------------------

-- A code from the name, such as THANDI27, made unique.
create function private.new_partner_code(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_stem text := left(regexp_replace(upper(split_part(trim(coalesce(p_name, '')), ' ', 1)), '[^A-Z]', '', 'g'), 8);
  v_code text;
begin
  if length(v_stem) < 3 then v_stem := 'VB' || v_stem; end if;
  loop
    v_code := v_stem || (10 + floor(random() * 990))::integer;
    exit when not exists (select 1 from public.partners where code = v_code);
  end loop;
  return v_code;
end;
$$;

create function public.partner_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.partner_settings;
  v_email text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = 'P0001'; end if;
  select * into v_s from public.partner_settings;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if exists (select 1 from public.partners where user_id = auth.uid()) then
    raise exception 'You have already applied.' using errcode = 'P0001';
  end if;
  if coalesce((p ->> 'accept_terms')::boolean, false) is not true then
    raise exception 'Accept the partner terms to apply.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p ->> 'name', ''))) = 0 then
    raise exception 'Enter your name.' using errcode = 'P0001';
  end if;
  -- A partner the platform owner set up by email takes this account.
  update public.partners set user_id = auth.uid(), terms_version = v_s.terms_version, terms_accepted_at = now(),
      phone = left(coalesce(p ->> 'phone', phone), 40), website = left(coalesce(p ->> 'website', website), 200),
      promotion = left(coalesce(p ->> 'promotion', promotion), 2000)
    where user_id is null and lower(email) = v_email
    returning id into v_id;
  if v_id is null then
    if not v_s.open then
      raise exception 'The partner programme is not taking applications at the moment.' using errcode = 'P0001';
    end if;
    insert into public.partners (user_id, email, name, company, phone, country, website, promotion, code, commission_percent, commission_months, terms_version, terms_accepted_at)
    values (auth.uid(), v_email, left(trim(p ->> 'name'), 120), left(trim(coalesce(p ->> 'company', '')), 120), left(coalesce(p ->> 'phone', ''), 40),
            coalesce(nullif(upper(p ->> 'country'), ''), 'NG'), left(coalesce(p ->> 'website', ''), 200), left(coalesce(p ->> 'promotion', ''), 2000),
            private.new_partner_code(p ->> 'name'), v_s.default_percent, v_s.default_months, v_s.terms_version, now())
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

-- Balances by currency: in the hold, available, asked for, and paid.
create function private.partner_balances(p_partner uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(currency, b), '{}'::jsonb) from (
    select currency, jsonb_build_object(
      'review', coalesce(sum(amount_kobo) filter (where status = 'review'), 0),
      'held', coalesce(sum(amount_kobo) filter (where status = 'pending' and available_at > now()), 0),
      'available', coalesce(sum(amount_kobo) filter (where status = 'pending' and available_at <= now()), 0),
      'requested', coalesce(sum(amount_kobo) filter (where status = 'requested'), 0),
      'paid', coalesce(sum(amount_kobo) filter (where status = 'paid'), 0)) b
    from public.partner_commissions where partner_id = p_partner group by currency) x;
$$;

create function public.partner_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.partners;
  v_email text;
begin
  if auth.uid() is null then return null; end if;
  select * into v_p from public.partners where user_id = auth.uid();
  if v_p.id is null then
    -- Set up by the platform owner: show it, so the person can accept the terms and take it up.
    select lower(email) into v_email from auth.users where id = auth.uid();
    select * into v_p from public.partners where user_id is null and lower(email) = v_email;
    if v_p.id is null then return null; end if;
    return jsonb_build_object('invited', true, 'name', v_p.name, 'company', v_p.company, 'programme', public.partner_programme());
  end if;
  return jsonb_build_object(
    'partner', jsonb_build_object('id', v_p.id, 'email', v_p.email, 'name', v_p.name, 'company', v_p.company, 'phone', v_p.phone,
      'country', v_p.country, 'website', v_p.website, 'promotion', v_p.promotion, 'code', v_p.code, 'status', v_p.status,
      'commission_percent', v_p.commission_percent, 'commission_months', v_p.commission_months, 'payout_details', v_p.payout_details,
      'terms_version', v_p.terms_version, 'terms_accepted_at', v_p.terms_accepted_at, 'created_at', v_p.created_at, 'approved_at', v_p.approved_at),
    'programme', public.partner_programme(),
    'clicks', (select jsonb_build_object('total', count(*), 'last30', count(*) filter (where at > now() - interval '30 days'),
        'campaigns', coalesce((select jsonb_agg(jsonb_build_object('campaign', campaign, 'clicks', n) order by n desc)
          from (select campaign, count(*) n from public.partner_clicks where partner_id = v_p.id group by campaign) c), '[]'::jsonb),
        'days', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'clicks', n) order by d)
          from (select to_char(date_trunc('day', at), 'YYYY-MM-DD') d, count(*) n from public.partner_clicks
                where partner_id = v_p.id and at > now() - interval '30 days' group by 1) c), '[]'::jsonb))
      from public.partner_clicks where partner_id = v_p.id),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('firm_id', f.id, 'firm', f.name, 'country', f.country, 'referred_at', f.referred_at,
        'campaign', f.referral_campaign, 'state', private.firm_state(f.id), 'review', f.referral_review is not null,
        'earned', (select coalesce(jsonb_object_agg(currency, s), '{}'::jsonb) from (select currency, sum(amount_kobo) s from public.partner_commissions
                   where firm_id = f.id and partner_id = v_p.id and status <> 'void' group by currency) e)) order by f.referred_at desc)
      from public.firms f where f.referred_by = v_p.id), '[]'::jsonb),
    'commissions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'firm', f.name, 'currency', c.currency, 'base_kobo', c.base_kobo,
        'percent', c.percent, 'amount_kobo', c.amount_kobo, 'status', c.status, 'created_at', c.created_at, 'available_at', c.available_at,
        'payout_id', c.payout_id, 'void_reason', c.void_reason, 'kind', y.kind) order by c.created_at desc)
      from public.partner_commissions c join public.firms f on f.id = c.firm_id join public.payments y on y.id = c.payment_id
      where c.partner_id = v_p.id), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'currency', o.currency, 'amount_kobo', o.amount_kobo, 'status', o.status,
        'requested_at', o.requested_at, 'decided_at', o.decided_at, 'reference', o.reference, 'method', o.method, 'note', o.note) order by o.requested_at desc)
      from public.partner_payouts o where o.partner_id = v_p.id), '[]'::jsonb),
    'balances', private.partner_balances(v_p.id),
    'assets', case when v_p.status = 'active' then coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'kind', a.kind,
        'body', a.body, 'url', a.url) order by a.created_at) from public.partner_assets a), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- The partner keeps their own contact and payout details. The code and terms are the platform owner's.
create function public.partner_update(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.partners set
    company = left(coalesce(p ->> 'company', company), 120),
    phone = left(coalesce(p ->> 'phone', phone), 40),
    website = left(coalesce(p ->> 'website', website), 200),
    promotion = left(coalesce(p ->> 'promotion', promotion), 2000),
    payout_details = case when p ? 'payout_details' and jsonb_typeof(p -> 'payout_details') = 'object' then p -> 'payout_details' else payout_details end
  where user_id = auth.uid();
  if not found then raise exception 'No partner account.' using errcode = 'P0001'; end if;
end;
$$;

-- Moves every available commission in one currency into a payout request.
create function private.make_payout(p_partner uuid, p_currency text, p_by text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.partners;
  v_total bigint;
  v_min bigint;
  v_id uuid;
begin
  select * into v_p from public.partners where id = p_partner for update;
  if v_p.status <> 'active' then
    raise exception 'Payouts are open only to active partners.' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount_kobo), 0) into v_total from public.partner_commissions
    where partner_id = p_partner and currency = p_currency and status = 'pending' and available_at <= now();
  select coalesce((min_payout ->> p_currency)::bigint, 0) into v_min from public.partner_settings;
  if v_total <= 0 then
    raise exception 'Nothing is available to pay out in %.', p_currency using errcode = 'P0001';
  end if;
  if v_p.payout_details = '{}'::jsonb or coalesce(v_p.payout_details ->> 'account_number', v_p.payout_details ->> 'mobile_number', '') = '' then
    raise exception 'Add payout details first.' using errcode = 'P0001';
  end if;
  if p_by = 'partner' and v_total < v_min then
    raise exception 'The least that can be paid out in % is %.', p_currency, to_char(v_min / 100.0, 'FM999,999,990.00') using errcode = 'P0001';
  end if;
  insert into public.partner_payouts (partner_id, currency, amount_kobo, requested_by, payout_details)
    values (p_partner, p_currency, v_total, p_by, v_p.payout_details) returning id into v_id;
  update public.partner_commissions set status = 'requested', payout_id = v_id
    where partner_id = p_partner and currency = p_currency and status = 'pending' and available_at <= now();
  return v_id;
end;
$$;

create function public.partner_request_payout(p_currency text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.partners where user_id = auth.uid();
  if v_id is null then raise exception 'No partner account.' using errcode = 'P0001'; end if;
  return private.make_payout(v_id, upper(p_currency), 'partner');
end;
$$;

-- ---------------------------------------------------------------------------
-- The platform owner
-- ---------------------------------------------------------------------------

create function public.admin_partners() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Not found.' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from public.partner_settings s),
    'partners', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'name', p.name, 'company', p.company, 'phone', p.phone,
        'country', p.country, 'website', p.website, 'promotion', p.promotion, 'code', p.code, 'status', p.status,
        'commission_percent', p.commission_percent, 'commission_months', p.commission_months, 'payout_details', p.payout_details,
        'admin_notes', p.admin_notes, 'terms_version', p.terms_version, 'terms_accepted_at', p.terms_accepted_at, 'has_account', p.user_id is not null,
        'created_by_admin', p.created_by_admin, 'created_at', p.created_at, 'approved_at', p.approved_at,
        'clicks', (select count(*) from public.partner_clicks k where k.partner_id = p.id),
        'clicks30', (select count(*) from public.partner_clicks k where k.partner_id = p.id and k.at > now() - interval '30 days'),
        'referred', (select count(*) from public.firms f where f.referred_by = p.id),
        'paying', (select count(*) from public.firms f where f.referred_by = p.id and exists (select 1 from public.payments y where y.firm_id = f.id and y.status = 'paid')),
        'balances', private.partner_balances(p.id)) order by p.created_at desc)
      from public.partners p), '[]'::jsonb),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('firm_id', f.id, 'firm', f.name, 'country', f.country, 'partner_id', f.referred_by,
        'referred_at', f.referred_at, 'campaign', f.referral_campaign, 'review', f.referral_review, 'state', private.firm_state(f.id)) order by f.referred_at desc)
      from public.firms f where f.referred_by is not null), '[]'::jsonb),
    'commissions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'partner_id', c.partner_id, 'firm_id', c.firm_id, 'firm', f.name,
        'currency', c.currency, 'base_kobo', c.base_kobo, 'percent', c.percent, 'amount_kobo', c.amount_kobo, 'status', c.status,
        'created_at', c.created_at, 'available_at', c.available_at, 'payout_id', c.payout_id, 'void_reason', c.void_reason, 'kind', y.kind) order by c.created_at desc)
      from public.partner_commissions c join public.firms f on f.id = c.firm_id join public.payments y on y.id = c.payment_id), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'partner_id', o.partner_id, 'currency', o.currency, 'amount_kobo', o.amount_kobo,
        'status', o.status, 'requested_at', o.requested_at, 'requested_by', o.requested_by, 'payout_details', o.payout_details,
        'decided_at', o.decided_at, 'reference', o.reference, 'method', o.method, 'note', o.note) order by o.requested_at desc)
      from public.partner_payouts o), '[]'::jsonb),
    'clicks', coalesce((select jsonb_agg(jsonb_build_object('partner_id', partner_id, 'month', m, 'campaign', campaign, 'clicks', n))
      from (select partner_id, to_char(date_trunc('month', at), 'YYYY-MM') m, campaign, count(*) n from public.partner_clicks group by 1, 2, 3) x), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.partner_assets a), '[]'::jsonb)
  );
end;
$$;

create function public.admin_partner_act(p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_s public.partner_settings;
  v_code text;
  v_out jsonb := '{}';
  v_payout public.partner_payouts;
begin
  if not private.is_admin() then raise exception 'Not found.' using errcode = 'P0001'; end if;
  select * into v_s from public.partner_settings;
  v_code := nullif(upper(trim(coalesce(p ->> 'code', ''))), '');
  if v_code is not null and v_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'A code is 4 to 20 letters and numbers.' using errcode = 'P0001';
  end if;
  if v_code is not null and exists (select 1 from public.partners where code = v_code and id is distinct from v_id) then
    raise exception 'Another partner already uses that code.' using errcode = 'P0001';
  end if;

  if p_action = 'create' then
    if coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Enter the partner''s email address.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.partners where lower(email) = lower(trim(p ->> 'email'))) then
      raise exception 'A partner with that email already exists.' using errcode = 'P0001';
    end if;
    -- The partner takes the account up by signing in with this email and accepting the terms.
    insert into public.partners (email, name, company, country, phone, code, status, commission_percent, commission_months, created_by_admin, approved_at, admin_notes)
    values (lower(trim(p ->> 'email')), trim(p ->> 'name'), trim(coalesce(p ->> 'company', '')), coalesce(nullif(upper(p ->> 'country'), ''), 'NG'),
            coalesce(p ->> 'phone', ''), coalesce(v_code, private.new_partner_code(p ->> 'name')), 'active',
            coalesce((p ->> 'percent')::numeric, v_s.default_percent),
            case when p ? 'months' then nullif(p ->> 'months', '')::integer else v_s.default_months end, true, now(), coalesce(p ->> 'admin_notes', ''))
    returning jsonb_build_object('id', id, 'code', code) into v_out;

  elsif p_action = 'update' then
    update public.partners set
      name = coalesce(nullif(trim(p ->> 'name'), ''), name),
      company = coalesce(p ->> 'company', company),
      phone = coalesce(p ->> 'phone', phone),
      country = coalesce(nullif(upper(p ->> 'country'), ''), country),
      code = coalesce(v_code, code),
      commission_percent = coalesce((p ->> 'percent')::numeric, commission_percent),
      commission_months = case when p ? 'months' then nullif(p ->> 'months', '')::integer else commission_months end,
      admin_notes = coalesce(p ->> 'admin_notes', admin_notes)
    where id = v_id;
    if not found then raise exception 'Partner not found.' using errcode = 'P0001'; end if;

  elsif p_action = 'status' then
    if p ->> 'status' not in ('active', 'suspended', 'rejected', 'pending') then
      raise exception 'Unknown status.' using errcode = 'P0001';
    end if;
    update public.partners set status = p ->> 'status',
      approved_at = case when p ->> 'status' = 'active' then coalesce(approved_at, now()) else approved_at end
    where id = v_id;
    if not found then raise exception 'Partner not found.' using errcode = 'P0001'; end if;

  elsif p_action = 'commission_approve' then
    -- A held referral is cleared: its commissions join the normal hold.
    update public.partner_commissions set status = 'pending' where id = v_id and status = 'review';
    if not found then raise exception 'That commission is not awaiting review.' using errcode = 'P0001'; end if;
    update public.firms set referral_review = null where id = (select firm_id from public.partner_commissions where id = v_id);

  elsif p_action = 'commission_void' then
    if length(trim(coalesce(p ->> 'reason', ''))) = 0 then
      raise exception 'Give the reason, such as a refund.' using errcode = 'P0001';
    end if;
    update public.partner_commissions set status = 'void', void_reason = left(trim(p ->> 'reason'), 300), payout_id = null
      where id = v_id and status in ('review', 'pending');
    if not found then raise exception 'Only a commission not yet in a payout can be voided.' using errcode = 'P0001'; end if;

  elsif p_action = 'payout_create' then
    v_out := jsonb_build_object('id', private.make_payout(v_id, upper(p ->> 'currency'), 'admin'));

  elsif p_action = 'payout_paid' then
    if length(trim(coalesce(p ->> 'reference', ''))) = 0 then
      raise exception 'Enter the transfer reference.' using errcode = 'P0001';
    end if;
    update public.partner_payouts set status = 'paid', decided_at = coalesce(nullif(p ->> 'paid_at', '')::timestamptz, now()), decided_by = auth.uid(),
        reference = left(trim(p ->> 'reference'), 120), method = left(coalesce(p ->> 'method', 'Bank transfer'), 60), note = left(coalesce(p ->> 'note', ''), 300)
      where id = v_id and status = 'requested' returning * into v_payout;
    if v_payout.id is null then raise exception 'That payout is not awaiting payment.' using errcode = 'P0001'; end if;
    update public.partner_commissions set status = 'paid' where payout_id = v_id;

  elsif p_action = 'payout_reject' then
    if length(trim(coalesce(p ->> 'note', ''))) = 0 then
      raise exception 'Tell the partner why.' using errcode = 'P0001';
    end if;
    update public.partner_payouts set status = 'rejected', decided_at = now(), decided_by = auth.uid(), note = left(trim(p ->> 'note'), 300)
      where id = v_id and status = 'requested' returning * into v_payout;
    if v_payout.id is null then raise exception 'That payout is not awaiting payment.' using errcode = 'P0001'; end if;
    -- The commissions go back to the balance, to be asked for again.
    update public.partner_commissions set status = 'pending', payout_id = null where payout_id = v_id;

  elsif p_action = 'assign_referral' then
    -- Credits a firm to a partner, or removes the credit, after a dispute. Earlier commissions stay as they are.
    if nullif(p ->> 'partner', '') is not null and not exists (select 1 from public.partners where id = (p ->> 'partner')::uuid) then
      raise exception 'Partner not found.' using errcode = 'P0001';
    end if;
    update public.firms set referred_by = nullif(p ->> 'partner', '')::uuid,
      referred_at = case when nullif(p ->> 'partner', '') is null then null else coalesce(referred_at, now()) end, referral_review = null
      where id = (p ->> 'firm')::uuid;
    if not found then raise exception 'Firm not found.' using errcode = 'P0001'; end if;

  elsif p_action = 'settings' then
    update public.partner_settings set
      open = coalesce((p ->> 'open')::boolean, open),
      default_percent = coalesce((p ->> 'default_percent')::numeric, default_percent),
      default_months = case when p ? 'default_months' then nullif(p ->> 'default_months', '')::integer else default_months end,
      hold_days = coalesce((p ->> 'hold_days')::integer, hold_days),
      cookie_days = coalesce((p ->> 'cookie_days')::integer, cookie_days),
      min_payout = case when jsonb_typeof(p -> 'min_payout') = 'object' then min_payout || (p -> 'min_payout') else min_payout end,
      terms_version = coalesce(nullif(trim(p ->> 'terms_version'), ''), terms_version),
      updated_at = now();

  elsif p_action = 'asset_add' then
    insert into public.partner_assets (title, kind, body, url)
    values (left(trim(p ->> 'title'), 120), coalesce(p ->> 'kind', 'copy'), left(coalesce(p ->> 'body', ''), 4000), left(coalesce(p ->> 'url', ''), 500));

  elsif p_action = 'asset_delete' then
    delete from public.partner_assets where id = v_id;

  else
    raise exception 'Unknown action.' using errcode = 'P0001';
  end if;

  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'partner_' || p_action, p);
  return v_out;
end;
$$;

revoke execute on function public.partner_programme(), public.partner_click(text, text, text, text), public.partner_lookup(text),
  public.claim_referral(text, text), public.partner_apply(jsonb), public.partner_me(), public.partner_update(jsonb),
  public.partner_request_payout(text), public.admin_partners(), public.admin_partner_act(text, jsonb) from public;
grant execute on function public.partner_programme(), public.partner_click(text, text, text, text), public.partner_lookup(text) to anon, authenticated;
grant execute on function public.claim_referral(text, text), public.partner_apply(jsonb), public.partner_me(), public.partner_update(jsonb),
  public.partner_request_payout(text), public.admin_partners(), public.admin_partner_act(text, jsonb) to authenticated;
revoke execute on function private.accrue_commission(uuid), private.on_payment_paid(), private.new_partner_code(text),
  private.partner_balances(uuid), private.make_payout(uuid, text, text), private.guard_firm_referral() from public;
-- Supabase grants new functions to anon by default. These need a signed-in user.
revoke execute on function public.claim_referral(text, text), public.partner_apply(jsonb), public.partner_me(), public.partner_update(jsonb),
  public.partner_request_payout(text), public.admin_partners(), public.admin_partner_act(text, jsonb) from anon;
