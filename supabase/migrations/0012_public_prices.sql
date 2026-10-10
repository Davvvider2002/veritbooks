-- VeritBooks: the prices shown on the public landing page. Run once, after 0011.
-- Anyone can read the price list. It carries nothing about any firm.

create function public.public_prices() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plans', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'price_kobo', price_kobo,
                'max_users', max_users, 'max_engagements', max_engagements) order by sort)
              from public.plans where code <> 'trial'),
    'engagement_prices', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'price_kobo', price_kobo) order by sort)
                          from public.engagement_prices),
    'vat_percent', (select vat_percent from public.platform_settings),
    'founding_left', greatest(20 - private.founding_taken(), 0),
    'support_email', (select support_email from public.platform_settings));
$$;
revoke execute on function public.public_prices() from public;
grant execute on function public.public_prices() to anon, authenticated;
