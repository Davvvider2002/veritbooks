-- 0024: commission for the years after the first.
--
-- A partner earns their rate for the first period from each referral (12 months by default).
-- The platform owner now also sets a rate for the years after it, and for how many further
-- months it runs (blank: for as long as the firm pays). A later rate of 0 keeps today's rule:
-- nothing after the first period. Set as a default for new partners and per partner.
-- Each commission records whether it was earned in the first period or later.

alter table public.partner_settings
  add column default_later_percent numeric(5, 2) not null default 0 check (default_later_percent >= 0 and default_later_percent <= 100),
  add column default_later_months integer check (default_later_months is null or default_later_months between 1 and 240);

alter table public.partners
  add column later_percent numeric(5, 2) not null default 0 check (later_percent >= 0 and later_percent <= 100),
  add column later_months integer check (later_months is null or later_months between 1 and 240);

alter table public.partner_commissions
  add column period text not null default 'first' check (period in ('first', 'later'));

create or replace function private.accrue_commission(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_firm public.firms;
  v_p public.partners;
  v_hold integer;
  v_base bigint;
  v_paid timestamptz;
  v_first_end timestamptz;
  v_percent numeric;
  v_period text := 'first';
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or v_pay.status <> 'paid' then return; end if;
  select * into v_firm from public.firms where id = v_pay.firm_id;
  if v_firm.referred_by is null then return; end if;
  select * into v_p from public.partners where id = v_firm.referred_by;
  -- A partner who is not active earns nothing on payments made meanwhile.
  if v_p.id is null or v_p.status <> 'active' then return; end if;
  -- The first period earns the partner's rate. After it, the rate for later years, for as many
  -- further months as set (none set: for as long as the firm pays). A later rate of 0 ends it.
  v_paid := coalesce(v_pay.paid_at, now());
  v_percent := v_p.commission_percent;
  if v_p.commission_months is not null then
    v_first_end := v_firm.referred_at + make_interval(months => v_p.commission_months);
    if v_paid > v_first_end then
      if v_p.later_percent <= 0 then return; end if;
      if v_p.later_months is not null and v_paid > v_first_end + make_interval(months => v_p.later_months) then return; end if;
      v_percent := v_p.later_percent;
      v_period := 'later';
    end if;
  end if;
  v_base := v_pay.amount_kobo - v_pay.vat_kobo;
  if v_base <= 0 then return; end if;
  select hold_days into v_hold from public.partner_settings;
  insert into public.partner_commissions (partner_id, firm_id, payment_id, currency, base_kobo, percent, amount_kobo, status, available_at, period)
  values (v_p.id, v_firm.id, v_pay.id, v_pay.currency, v_base, v_percent,
          floor(v_base * v_percent / 100), case when v_firm.referral_review is not null then 'review' else 'pending' end,
          v_paid + make_interval(days => coalesce(v_hold, 45)), v_period)
  on conflict (payment_id) do nothing;
end;
$$;

create or replace function public.partner_programme() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('open', s.open, 'percent', s.default_percent, 'months', s.default_months, 'later_percent', s.default_later_percent, 'later_months', s.default_later_months, 'hold_days', s.hold_days,
    'cookie_days', s.cookie_days, 'min_payout', s.min_payout, 'terms_version', s.terms_version)
  from public.partner_settings s;
$$;

create or replace function public.partner_apply(p jsonb) returns jsonb
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
    insert into public.partners (user_id, email, name, company, phone, country, website, promotion, code, commission_percent, commission_months, later_percent, later_months, terms_version, terms_accepted_at)
    values (auth.uid(), v_email, left(trim(p ->> 'name'), 120), left(trim(coalesce(p ->> 'company', '')), 120), left(coalesce(p ->> 'phone', ''), 40),
            coalesce(nullif(upper(p ->> 'country'), ''), 'NG'), left(coalesce(p ->> 'website', ''), 200), left(coalesce(p ->> 'promotion', ''), 2000),
            private.new_partner_code(p ->> 'name'), v_s.default_percent, v_s.default_months, v_s.default_later_percent, v_s.default_later_months, v_s.terms_version, now())
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.partner_me() returns jsonb
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
      'commission_percent', v_p.commission_percent, 'commission_months', v_p.commission_months, 'later_percent', v_p.later_percent, 'later_months', v_p.later_months, 'payout_details', v_p.payout_details,
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
        'payout_id', c.payout_id, 'void_reason', c.void_reason, 'kind', y.kind, 'period', c.period) order by c.created_at desc)
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

create or replace function public.admin_partners() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Not found.' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from public.partner_settings s),
    'partners', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'name', p.name, 'company', p.company, 'phone', p.phone,
        'country', p.country, 'website', p.website, 'promotion', p.promotion, 'code', p.code, 'status', p.status,
        'commission_percent', p.commission_percent, 'commission_months', p.commission_months, 'later_percent', p.later_percent, 'later_months', p.later_months, 'payout_details', p.payout_details,
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
        'created_at', c.created_at, 'available_at', c.available_at, 'payout_id', c.payout_id, 'void_reason', c.void_reason, 'kind', y.kind, 'period', c.period) order by c.created_at desc)
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

create or replace function public.admin_partner_act(p_action text, p jsonb) returns jsonb
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
    insert into public.partners (email, name, company, country, phone, code, status, commission_percent, commission_months, later_percent, later_months, created_by_admin, approved_at, admin_notes)
    values (lower(trim(p ->> 'email')), trim(p ->> 'name'), trim(coalesce(p ->> 'company', '')), coalesce(nullif(upper(p ->> 'country'), ''), 'NG'),
            coalesce(p ->> 'phone', ''), coalesce(v_code, private.new_partner_code(p ->> 'name')), 'active',
            coalesce((p ->> 'percent')::numeric, v_s.default_percent),
            case when p ? 'months' then nullif(p ->> 'months', '')::integer else v_s.default_months end,
            coalesce(nullif(p ->> 'later_percent', '')::numeric, v_s.default_later_percent),
            case when p ? 'later_months' then nullif(p ->> 'later_months', '')::integer else v_s.default_later_months end,
            true, now(), coalesce(p ->> 'admin_notes', ''))
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
      later_percent = coalesce(nullif(p ->> 'later_percent', '')::numeric, later_percent),
      later_months = case when p ? 'later_months' then nullif(p ->> 'later_months', '')::integer else later_months end,
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
      default_later_percent = coalesce(nullif(p ->> 'default_later_percent', '')::numeric, default_later_percent),
      default_later_months = case when p ? 'default_later_months' then nullif(p ->> 'default_later_months', '')::integer else default_later_months end,
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
