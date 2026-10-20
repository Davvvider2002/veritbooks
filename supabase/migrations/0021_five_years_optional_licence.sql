-- VeritBooks: five years of balances, and licence numbers optional for signing. Run once, after 0020.
-- Nothing is removed.

-- Up to five years can be imported: the current year and four before it. Three years of cash
-- flows need four balance sheets; the fifth year completes the five-year financial summary.
alter table public.tb_lines add column prior3_balance bigint;
alter table public.tb_lines add column prior4_balance bigint;

-- An engagement partner can sign without a practising number on file, and without the firm's.
-- Either is still recorded on the report when it is held.
create or replace function public.sign_engagement_inner(p_engagement uuid)
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
  select * into v_firm from public.firms where id = v_eng.firm_id;
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
revoke execute on function public.sign_engagement_inner(uuid) from public, anon, authenticated;

create or replace function public.sign_engagement(p_engagement uuid) returns public.engagements
language plpgsql security definer set search_path = '' as $$
begin
  return public.sign_engagement_mfa(p_engagement);
end;
$$;
revoke execute on function public.sign_engagement(uuid) from public, anon;
grant execute on function public.sign_engagement(uuid) to authenticated;
