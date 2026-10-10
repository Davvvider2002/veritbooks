-- VeritBooks phase 2: general ledger for journal testing, and bank statements for reconciliation.
-- Run once, after 0001_init.sql.

alter table public.engagements add column testing jsonb not null default '{}';

create table public.gl_entries (
  id bigint generated always as identity primary key,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  entry_no text not null,
  entry_date date not null,
  account_code text not null,
  description text not null default '',
  amount bigint not null, -- kobo, debit positive
  posted_by text not null default '',
  row_no integer not null
);
create index gl_entries_engagement_idx on public.gl_entries (engagement_id, row_no);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  account_code text not null, -- the trial balance account this statement supports
  opening bigint,
  closing bigint not null, -- balance per statement at the year end
  breaks integer not null default 0, -- rows where the running balance does not follow
  file_name text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index bank_accounts_engagement_idx on public.bank_accounts (engagement_id);

create table public.bank_lines (
  id bigint generated always as identity primary key,
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  txn_date date not null,
  description text not null default '',
  amount bigint not null, -- kobo, money in positive
  balance bigint,
  row_no integer not null
);
create index bank_lines_account_idx on public.bank_lines (bank_account_id, row_no);
create index bank_lines_engagement_idx on public.bank_lines (engagement_id);

-- A bank line must sit in the same engagement as its account.
create function private.guard_bank_line() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.bank_accounts a
    where a.id = new.bank_account_id and a.engagement_id = new.engagement_id
  ) then
    raise exception 'The bank account does not belong to this engagement.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger bank_lines_account_guard before insert or update on public.bank_lines
  for each row execute function private.guard_bank_line();

-- Lock: nothing changes once the engagement is signed.
create trigger gl_entries_guard before insert or update or delete on public.gl_entries
  for each row execute function private.guard_child();
create trigger bank_accounts_guard before insert or update or delete on public.bank_accounts
  for each row execute function private.guard_child();
create trigger bank_lines_guard before insert or update or delete on public.bank_lines
  for each row execute function private.guard_child();

-- Audit trail. Ledgers and statements arrive thousands of rows at a time,
-- so each import or removal is logged once, with a row count.
create function private.log_bulk() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (firm_id, engagement_id, table_name, action, user_id, detail)
  select e.firm_id, c.engagement_id, tg_table_name,
         case when tg_op = 'INSERT' then 'import' else 'remove' end,
         auth.uid(), jsonb_build_object('rows', count(*))
  from changed c
  join public.engagements e on e.id = c.engagement_id
  group by e.firm_id, c.engagement_id;
  return null;
end;
$$;

create trigger gl_entries_log_insert after insert on public.gl_entries
  referencing new table as changed for each statement execute function private.log_bulk();
create trigger gl_entries_log_delete after delete on public.gl_entries
  referencing old table as changed for each statement execute function private.log_bulk();
create trigger bank_lines_log_insert after insert on public.bank_lines
  referencing new table as changed for each statement execute function private.log_bulk();
create trigger bank_lines_log_delete after delete on public.bank_lines
  referencing old table as changed for each statement execute function private.log_bulk();

create function private.log_bank_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_firm uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select firm_id into v_firm from public.engagements where id = r.engagement_id;
  if v_firm is null then return r; end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_firm, r.engagement_id, 'bank_accounts', lower(tg_op), r.id, auth.uid(),
          jsonb_build_object('name', r.name, 'account_code', r.account_code, 'closing', r.closing, 'file', r.file_name));
  return r;
end;
$$;
create trigger bank_accounts_log after insert or update or delete on public.bank_accounts
  for each row execute function private.log_bank_account();

-- Record changes to journal testing conclusions in the engagement log entry.
create or replace function private.log_engagement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id)
    values (old.firm_id, old.id, 'engagements', 'delete', old.id, auth.uid());
    return old;
  end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (
    new.firm_id, new.id, 'engagements', lower(tg_op), new.id, auth.uid(),
    case when tg_op = 'UPDATE' then jsonb_strip_nulls(jsonb_build_object(
      'status', case when new.status is distinct from old.status then new.status end,
      'planning', case when new.planning is distinct from old.planning then new.planning end,
      'report', case when new.report is distinct from old.report then new.report end,
      'testing', case when new.testing is distinct from old.testing then new.testing end,
      'programme_changed', case when new.programme is distinct from old.programme then true end
    )) end
  );
  return new;
end;
$$;

-- Row level security: same rule as the trial balance. Members of the engagement's firm only.
alter table public.gl_entries enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_lines enable row level security;

create policy gl_entries_all on public.gl_entries for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));
create policy bank_accounts_all on public.bank_accounts for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));
create policy bank_lines_all on public.bank_lines for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));

revoke all on public.gl_entries, public.bank_accounts, public.bank_lines from anon;
grant select, insert, update, delete on public.gl_entries, public.bank_accounts, public.bank_lines to authenticated;
grant execute on all functions in schema private to authenticated;
