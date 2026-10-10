-- VeritBooks: VAT on every payment. Run once, after 0010. Nothing is removed.
-- Prices in the plans and engagement_prices tables are before VAT. VAT is added when a
-- payment is started, at the rate set in the admin console, and kept on the payment.
-- For a payment, amount_kobo is the total charged and vat_kobo is the VAT inside it.

alter table public.platform_settings add column vat_percent numeric(5, 2) not null default 7.5 check (vat_percent >= 0 and vat_percent <= 50);
alter table public.payments add column vat_kobo bigint not null default 0 check (vat_kobo >= 0);

create function private.vat_rate() returns numeric
language sql stable security definer set search_path = '' as $$
  select vat_percent from public.platform_settings;
$$;

-- Credit for the unused part of a plan is worked out on what was paid before VAT.
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
  select price_kobo into v_current from public.plans where code = v_firm.plan;
  if list_kobo > v_current then
    mode := 'upgrade';
    select coalesce(floor(sum((y.amount_kobo - y.vat_kobo + y.credit_kobo)
             * extract(epoch from y.covers_until - greatest(now(), y.covers_until - interval '1 year'))
             / extract(epoch from interval '1 year'))), 0)::bigint
    into credit_kobo
    from public.payments y
    where y.firm_id = p_firm and y.status = 'paid' and y.kind = 'plan' and y.covers_until > now();
    credit_kobo := greatest(least(credit_kobo, amount_kobo - 100000), 0);
    amount_kobo := amount_kobo - credit_kobo;
  elsif v_firm.paid_until - now() > interval '30 days' then
    mode := 'later';
  else
    mode := 'switch';
  end if;
end;
$$;

-- The functions written before VAT keep their work. Each is renamed and wrapped, so the
-- wrapper adds VAT to what the original returns or records.
alter function public.billing_checkout(jsonb) rename to billing_checkout_net;
alter function public.billing_overview() rename to billing_overview_net;
alter function public.payment_receipt(text) rename to payment_receipt_net;
alter function public.admin_overview() rename to admin_overview_net;
alter function public.admin_act(text, jsonb) rename to admin_act_net;

create function public.billing_checkout(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_start jsonb := public.billing_checkout_net(p);
  v_net bigint := (v_start ->> 'amount_kobo')::bigint;
  v_vat bigint := round(v_net * private.vat_rate() / 100);
begin
  update public.payments set vat_kobo = v_vat, amount_kobo = v_net + v_vat where tx_ref = v_start ->> 'tx_ref';
  return v_start || jsonb_build_object('amount_kobo', v_net + v_vat, 'net_kobo', v_net, 'vat_kobo', v_vat);
end;
$$;

create function public.billing_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.billing_overview_net();
  v_firm uuid;
begin
  select firm_id into v_firm from public.firm_members where user_id = auth.uid();
  return v || jsonb_build_object(
    'vat_percent', private.vat_rate(),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', y.id, 'kind', y.kind, 'plan', y.plan, 'engagement_type', y.engagement_type, 'with_group', y.with_group,
        'amount_kobo', y.amount_kobo, 'vat_kobo', y.vat_kobo, 'credit_kobo', y.credit_kobo, 'founding', y.founding, 'source', y.source,
        'paid_at', y.paid_at, 'covers_until', y.covers_until, 'tx_ref', y.tx_ref, 'receipt_no', y.receipt_no) order by y.paid_at desc)
      from public.payments y where y.firm_id = v_firm and y.status = 'paid'), '[]'::jsonb));
end;
$$;

create function public.payment_receipt(p_tx_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.payment_receipt_net(p_tx_ref)
    || jsonb_build_object('vat_kobo', (select vat_kobo from public.payments where tx_ref = p_tx_ref));
$$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := public.admin_overview_net();
begin
  return v || jsonb_build_object(
    'vat_kobo', (select coalesce(sum(vat_kobo), 0) from public.payments where status = 'paid'),
    'vat_month_kobo', (select coalesce(sum(vat_kobo), 0) from public.payments where status = 'paid' and paid_at >= date_trunc('month', now())),
    'settings', (v -> 'settings') || jsonb_build_object('vat_percent', private.vat_rate()));
end;
$$;

create function public.admin_act(p_action text, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric;
begin
  perform public.admin_act_net(p_action, p); -- refuses anyone who is not an admin
  if p_action = 'settings' and p ? 'vat_percent' then
    v_rate := (p ->> 'vat_percent')::numeric;
    if v_rate is null or v_rate < 0 or v_rate > 50 then
      raise exception 'Give a VAT rate between 0 and 50.' using errcode = 'P0001';
    end if;
    update public.platform_settings set vat_percent = v_rate where id;
  elsif p_action = 'record_payment' then
    -- The amount an admin records is what was received, VAT included.
    update public.payments y set vat_kobo = y.amount_kobo - round(y.amount_kobo / (1 + private.vat_rate() / 100))
    where y.id = (select id from public.payments where firm_id = (p ->> 'firm')::uuid and source = 'manual' order by created_at desc limit 1);
  end if;
end;
$$;

revoke execute on function public.billing_checkout_net(jsonb), public.billing_overview_net(), public.admin_overview_net(), public.admin_act_net(text, jsonb) from public, anon, authenticated;
revoke execute on function public.payment_receipt_net(text) from public, anon, authenticated;
revoke execute on function public.billing_checkout(jsonb), public.billing_overview(), public.admin_overview(), public.admin_act(text, jsonb) from public, anon;
revoke execute on function public.payment_receipt(text) from public, anon, authenticated;
grant execute on function public.billing_checkout(jsonb), public.billing_overview(), public.admin_overview(), public.admin_act(text, jsonb) to authenticated;
grant execute on function public.payment_receipt(text) to service_role;
grant execute on all functions in schema private to authenticated;
