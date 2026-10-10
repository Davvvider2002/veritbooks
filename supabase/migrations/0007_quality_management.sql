-- VeritBooks: the firm's system of quality management.
-- Run once, after 0006. It only adds tables and functions.

-- Quality risks with the firm's responses, and findings from monitoring with their remedial actions.
create table public.quality_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  kind text not null check (kind in ('risk', 'finding')),
  component text not null check (component in ('governance', 'ethics', 'acceptance', 'performance', 'resources', 'information', 'monitoring')),
  title text not null check (length(trim(title)) > 0),
  detail text not null default '',   -- risk: what could go wrong. finding: what was found, and its root cause
  response text not null default '', -- risk: the firm's response. finding: the remedial action
  owner text not null default '',
  -- risk: open = response still needed, in_place = response operating. finding: open or closed.
  status text not null default 'open' check (status in ('open', 'in_place', 'closed')),
  severity text check (severity is null or severity in ('finding', 'deficiency', 'severe', 'pervasive')),
  due_date date,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'risk' and status in ('open', 'in_place') and severity is null)
      or (kind = 'finding' and status in ('open', 'closed') and severity is not null))
);
create index quality_items_firm_idx on public.quality_items (firm_id, kind);

-- The evaluation of the system, made at least once a year by the partner with ultimate responsibility.
-- An evaluation is a record of a conclusion reached on a date. It is never changed or removed.
create table public.quality_evaluations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  as_at date not null,
  conclusion text not null check (conclusion in ('effective', 'effective_except', 'not_effective')),
  basis text not null check (length(trim(basis)) > 0),
  concluded_by uuid references auth.users (id),
  concluded_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index quality_evaluations_firm_idx on public.quality_evaluations (firm_id, as_at);

create function private.guard_quality_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.firm_id is distinct from old.firm_id or new.kind is distinct from old.kind then
    raise exception 'A quality record cannot be moved to another firm or changed in kind.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger quality_items_guard before update on public.quality_items
  for each row execute function private.guard_quality_item();

-- The name on an evaluation is taken from the firm's own records, not from the browser.
create function private.stamp_evaluation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.concluded_by := auth.uid();
  select m.full_name into new.concluded_by_name
  from public.firm_members m where m.firm_id = new.firm_id and m.user_id = auth.uid();
  new.concluded_by_name := coalesce(new.concluded_by_name, '');
  new.created_at := now();
  return new;
end;
$$;
create trigger quality_evaluations_stamp before insert on public.quality_evaluations
  for each row execute function private.stamp_evaluation();

create function private.log_quality() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  j jsonb;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  j := to_jsonb(r);
  if not exists (select 1 from public.firms f where f.id = r.firm_id) then return r; end if;
  insert into public.audit_log (firm_id, table_name, action, row_id, user_id, detail)
  values (r.firm_id, tg_table_name, lower(tg_op), r.id, auth.uid(),
          case when tg_table_name = 'quality_items'
               then jsonb_build_object('kind', j -> 'kind', 'title', j -> 'title', 'status', j -> 'status')
               else jsonb_build_object('as_at', j -> 'as_at', 'conclusion', j -> 'conclusion') end);
  return r;
end;
$$;
create trigger quality_items_log after insert or update or delete on public.quality_items
  for each row execute function private.log_quality();
create trigger quality_evaluations_log after insert on public.quality_evaluations
  for each row execute function private.log_quality();

alter table public.quality_items enable row level security;
alter table public.quality_evaluations enable row level security;

-- Everyone in the firm can read the system of quality management. Partners maintain it.
create policy quality_items_select on public.quality_items for select to authenticated
  using (private.is_member(firm_id));
create policy quality_items_insert on public.quality_items for insert to authenticated
  with check (private.is_partner(firm_id));
create policy quality_items_update on public.quality_items for update to authenticated
  using (private.is_partner(firm_id)) with check (private.is_partner(firm_id));
-- A risk that no longer applies can be removed. A finding is part of the monitoring record: it is closed, not removed.
create policy quality_items_delete on public.quality_items for delete to authenticated
  using (private.is_partner(firm_id) and kind = 'risk');

create policy quality_evaluations_select on public.quality_evaluations for select to authenticated
  using (private.is_member(firm_id));
create policy quality_evaluations_insert on public.quality_evaluations for insert to authenticated
  with check (private.is_partner(firm_id));

revoke all on public.quality_items, public.quality_evaluations from anon;
grant select, insert, update, delete on public.quality_items to authenticated;
grant select, insert on public.quality_evaluations to authenticated;
grant execute on all functions in schema private to authenticated;
