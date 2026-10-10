-- VeritBooks phase 2, part two: team invitations and evidence files.
-- Run once, after 0002_ledger_and_bank.sql.

-- ---------------------------------------------------------------------------
-- Team
-- ---------------------------------------------------------------------------

create table public.firm_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  role text not null check (role in ('partner', 'manager', 'staff')),
  invited_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  unique (firm_id, email)
);

alter table public.firm_invites enable row level security;
-- Only partners see, create and withdraw invitations.
create policy invites_select on public.firm_invites for select to authenticated
  using (private.is_partner(firm_id));
create policy invites_insert on public.firm_invites for insert to authenticated
  with check (private.is_partner(firm_id) and accepted_at is null and accepted_by is null);
create policy invites_delete on public.firm_invites for delete to authenticated
  using (private.is_partner(firm_id));
revoke all on public.firm_invites from anon;
grant select, insert, delete on public.firm_invites to authenticated;

-- Invitations waiting for the signed-in user. The email on the account must be confirmed,
-- so nobody can claim an invitation by signing up with someone else's address.
create function public.my_invites()
returns table (id uuid, firm_name text, role text)
language sql stable security definer set search_path = '' as $$
  select i.id, f.name, i.role
  from public.firm_invites i
  join public.firms f on f.id = i.firm_id
  join auth.users u on u.id = auth.uid()
  where i.accepted_at is null
    and i.email = lower(u.email)
    and u.email_confirmed_at is not null
  order by i.created_at;
$$;

create function public.accept_invite(p_invite uuid, p_full_name text, p_frc_number text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.firm_invites;
  v_email text;
begin
  select lower(u.email) into v_email from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Confirm your email address first.' using errcode = 'P0001';
  end if;
  select * into v_invite from public.firm_invites
  where id = p_invite and accepted_at is null and email = v_email for update;
  if v_invite.id is null then
    raise exception 'This invitation is not available.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.firm_members where user_id = auth.uid()) then
    raise exception 'You already belong to a firm.' using errcode = 'P0001';
  end if;
  insert into public.firm_members (firm_id, user_id, role, full_name, frc_number)
  values (v_invite.firm_id, auth.uid(), v_invite.role, trim(coalesce(p_full_name, '')), trim(coalesce(p_frc_number, '')));
  update public.firm_invites set accepted_at = now(), accepted_by = auth.uid() where id = p_invite;
end;
$$;

-- Anyone can keep their own name and FRC number up to date. Roles are changed by partners only.
create function public.update_my_profile(p_full_name text, p_frc_number text)
returns void
language sql security definer set search_path = '' as $$
  update public.firm_members
  set full_name = trim(coalesce(p_full_name, '')), frc_number = trim(coalesce(p_frc_number, ''))
  where user_id = auth.uid();
$$;

revoke execute on function public.my_invites() from public, anon;
revoke execute on function public.accept_invite(uuid, text, text) from public, anon;
revoke execute on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.accept_invite(uuid, text, text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;

-- Partners can remove a member. A firm always keeps at least one partner.
create policy members_delete on public.firm_members for delete to authenticated
  using (private.is_partner(firm_id));
grant delete on public.firm_members to authenticated;

create function private.guard_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.firm_id is distinct from old.firm_id or new.user_id is distinct from old.user_id) then
    raise exception 'A membership cannot be moved to another firm or person.' using errcode = 'P0001';
  end if;
  if old.role = 'partner' and (tg_op = 'DELETE' or new.role <> 'partner')
     and exists (select 1 from public.firms f where f.id = old.firm_id)
     and not exists (
       select 1 from public.firm_members m
       where m.firm_id = old.firm_id and m.user_id <> old.user_id and m.role = 'partner'
     ) then
    raise exception 'A firm must keep at least one partner.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger firm_members_guard before update or delete on public.firm_members
  for each row execute function private.guard_member();

-- ---------------------------------------------------------------------------
-- Evidence: files attached to an engagement
-- ---------------------------------------------------------------------------

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  path text not null unique, -- object name in the evidence bucket: firm/engagement/file
  file_name text not null,
  size_bytes bigint not null default 0,
  mime text not null default '',
  ref_type text not null default 'general' check (ref_type in ('general', 'programme', 'journal', 'bank', 'adjustment')),
  ref_id text not null default '',
  note text not null default '',
  uploaded_by uuid default auth.uid() references auth.users (id),
  uploaded_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index evidence_engagement_idx on public.evidence (engagement_id);

create function private.guard_evidence_path() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.path not like private.engagement_firm(new.engagement_id)::text || '/' || new.engagement_id::text || '/%' then
    raise exception 'The file is not stored under this engagement.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger evidence_path_guard before insert or update on public.evidence
  for each row execute function private.guard_evidence_path();
create trigger evidence_guard before insert or update or delete on public.evidence
  for each row execute function private.guard_child();

create function private.log_evidence() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_firm uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select firm_id into v_firm from public.engagements where id = r.engagement_id;
  if v_firm is null then return r; end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_firm, r.engagement_id, 'evidence', lower(tg_op), r.id, auth.uid(),
          jsonb_build_object('file', r.file_name, 'ref_type', r.ref_type, 'ref_id', r.ref_id));
  return r;
end;
$$;
create trigger evidence_log after insert or update or delete on public.evidence
  for each row execute function private.log_evidence();

alter table public.evidence enable row level security;
create policy evidence_all on public.evidence for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));
revoke all on public.evidence from anon;
grant select, insert, update, delete on public.evidence to authenticated;

-- The files themselves live in a private storage bucket, 25 MB a file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 26214400)
on conflict (id) do nothing;

-- Object names are firm/engagement/file. Access follows the engagement:
-- members of its firm can read; they can add and remove only while it is unsigned.
create function private.evidence_access(p_name text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_firm uuid;
  v_engagement uuid;
begin
  if coalesce(array_length(v_parts, 1), 0) <> 3 then return false; end if;
  begin
    v_firm := v_parts[1]::uuid;
    v_engagement := v_parts[2]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1
    from public.engagements e
    join public.firm_members m on m.firm_id = e.firm_id and m.user_id = auth.uid()
    where e.id = v_engagement and e.firm_id = v_firm
      and (not p_write or e.status = 'in_progress')
  );
end;
$$;

create policy evidence_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and private.evidence_access(name, false));
create policy evidence_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and private.evidence_access(name, true));
create policy evidence_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and private.evidence_access(name, true));

grant execute on all functions in schema private to authenticated;
