-- 0023: integrity found wanting under stress testing.
--
-- 1. One reference per journal on a file. Two people posting at once, or a reference typed
--    twice, could otherwise give two journals called AJ1.
-- 2. Every journal balances, has at least two lines, and posts only to accounts of its own
--    file. The screens already check this; the database now does too, whatever sends the row.
-- 3. Work saved to the file's working papers (planning, programme, testing, disclosures,
--    report) is merged key by key, so two people working on the same file at the same time no
--    longer overwrite each other's sign-offs, conclusions and notes.

create unique index if not exists adjustments_ref_idx on public.adjustments (engagement_id, upper(btrim(ref)));

create or replace function private.check_adjustment() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sum numeric;
  v_n int;
begin
  if new.lines is null or jsonb_typeof(new.lines) <> 'array' then
    raise exception 'A journal needs at least two lines.' using errcode = 'P0001';
  end if;
  select coalesce(sum((x ->> 'amount')::numeric), 0), count(*) into v_sum, v_n from jsonb_array_elements(new.lines) x;
  if v_n < 2 then
    raise exception 'A journal needs at least two lines.' using errcode = 'P0001';
  end if;
  if v_sum <> 0 then
    raise exception 'The journal does not balance.' using errcode = 'P0001';
  end if;
  if btrim(coalesce(new.ref, '')) = '' then
    raise exception 'Give the journal a reference.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.lines) x
    where not exists (select 1 from public.tb_lines t where t.id::text = x ->> 'lineId' and t.engagement_id = new.engagement_id)
  ) then
    raise exception 'A journal line refers to an account that is not in this file.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Named to fire after adjustments_guard, so a signed file still answers "signed and locked".
create trigger adjustments_zcheck before insert or update on public.adjustments
  for each row execute function private.check_adjustment();

-- Merge some keys into one of the file's JSON columns and remove others, in one statement.
-- Runs as the caller, so row-level security and the lock guard apply as to any update.
create or replace function public.merge_engagement(p_engagement uuid, p_field text, p_set jsonb, p_unset text[] default '{}')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows int;
begin
  if p_field not in ('planning', 'programme', 'testing', 'disclosures', 'report') then
    raise exception 'That part of the file cannot be merged.' using errcode = 'P0001';
  end if;
  if p_set is null or jsonb_typeof(p_set) <> 'object' then
    raise exception 'Nothing to save.' using errcode = 'P0001';
  end if;
  execute format(
    'update public.engagements set %1$I = (coalesce(%1$I, ''{}''::jsonb) - $2) || $1 where id = $3',
    p_field
  ) using p_set, coalesce(p_unset, '{}'), p_engagement;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'The engagement was not found.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.merge_engagement(uuid, text, jsonb, text[]) from public, anon;
grant execute on function public.merge_engagement(uuid, text, jsonb, text[]) to authenticated;
