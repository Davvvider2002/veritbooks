-- VeritBooks: an engagement partner reopens a signed file, as the auditing standards allow.
-- Run once, after 0021. Nothing is removed.
--
-- ISA 230 (paragraph 16) allows audit documentation to be changed or added to after the file is
-- assembled, provided the auditor records when and by whom the change was made and reviewed, the
-- specific reasons for it, and its effect on the conclusions reached. ISA 560 (paragraphs 10 to 17)
-- covers facts that become known after the auditor's report is dated: if the financial statements
-- are amended, the auditor extends the procedures to the date of a new report and dates the new
-- report no earlier than the approval of the amended statements.
--
-- A partner reopens the file with a reason, the kind of change and its effect. The signed report
-- and who signed it are kept in this table, never lost, and the file returns to work in progress
-- until a partner signs it again.

create table public.engagement_amendments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  kind text not null check (kind in ('documentation', 'subsequent_before_issue', 'subsequent_after_issue')),
  reason text not null check (length(trim(reason)) >= 20),
  effect text not null check (length(trim(effect)) >= 10),
  reopened_by uuid default auth.uid() references auth.users (id),
  reopened_by_name text not null default '',
  reopened_at timestamptz not null default now(),
  previous_signed_by_name text,
  previous_signed_by_frc text,
  previous_signed_at timestamptz,
  previous_report jsonb not null default '{}',
  resigned_by_name text,
  resigned_at timestamptz
);
create index engagement_amendments_engagement_idx on public.engagement_amendments (engagement_id);
alter table public.engagement_amendments enable row level security;
create policy engagement_amendments_read on public.engagement_amendments for select to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)));
revoke all on public.engagement_amendments from anon;
revoke insert, update, delete on public.engagement_amendments from authenticated;
grant select on public.engagement_amendments to authenticated;

-- The lock gives way only to a reopening, which only reopen_engagement sets.
create or replace function private.guard_engagement() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'locked' then
      raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.status = 'locked' and coalesce(current_setting('app.reopening', true), '') <> '1' then
    raise exception 'This engagement is signed and locked.' using errcode = 'P0001';
  end if;
  if coalesce(current_setting('app.signing', true), '') <> '1' then
    if new.status is distinct from old.status
       or new.signed_by is distinct from old.signed_by
       or new.signed_by_name is distinct from old.signed_by_name
       or new.signed_by_frc is distinct from old.signed_by_frc
       or new.firm_frc is distinct from old.firm_frc
       or new.signed_at is distinct from old.signed_at then
      raise exception 'An engagement can only be signed through sign_engagement.' using errcode = 'P0001';
    end if;
  end if;
  if new.firm_id is distinct from old.firm_id or new.client_id is distinct from old.client_id then
    raise exception 'An engagement cannot be moved to another firm or client.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.reopen_engagement(p_engagement uuid, p_kind text, p_reason text, p_effect text)
returns public.engagements
language plpgsql security definer set search_path = '' as $$
declare
  v_eng public.engagements;
  v_member public.firm_members;
begin
  perform private.require_mfa();
  select * into v_eng from public.engagements where id = p_engagement for update;
  if v_eng.id is null then
    raise exception 'Engagement not found.' using errcode = 'P0001';
  end if;
  select * into v_member from public.firm_members where firm_id = v_eng.firm_id and user_id = auth.uid();
  if v_member.user_id is null then
    raise exception 'Engagement not found.' using errcode = 'P0001';
  end if;
  if v_member.role <> 'partner' then
    raise exception 'Only an engagement partner can reopen a signed file.' using errcode = 'P0001';
  end if;
  if v_eng.status <> 'locked' then
    raise exception 'This file is not signed, so there is nothing to reopen.' using errcode = 'P0001';
  end if;
  perform private.require_open(v_eng.firm_id);
  if p_kind not in ('documentation', 'subsequent_before_issue', 'subsequent_after_issue') then
    raise exception 'Choose why the file is being reopened.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Give the specific reason for reopening the file, in at least 20 characters.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_effect, ''))) < 10 then
    raise exception 'Say what effect the change has on the conclusions reached.' using errcode = 'P0001';
  end if;

  insert into public.engagement_amendments (engagement_id, kind, reason, effect, reopened_by_name, previous_signed_by_name, previous_signed_by_frc, previous_signed_at, previous_report)
  values (p_engagement, p_kind, trim(p_reason), trim(p_effect), v_member.full_name, v_eng.signed_by_name, v_eng.signed_by_frc, v_eng.signed_at, coalesce(v_eng.report, '{}'::jsonb));

  perform set_config('app.signing', '1', true);
  perform set_config('app.reopening', '1', true);
  update public.engagements
  set status = 'in_progress', signed_by = null, signed_by_name = null, signed_by_frc = null, firm_frc = null, signed_at = null,
      report = coalesce(report, '{}'::jsonb) - 'signedReport'
  where id = p_engagement
  returning * into v_eng;
  perform set_config('app.reopening', '', true);
  perform set_config('app.signing', '', true);
  return v_eng;
end;
$$;
revoke execute on function public.reopen_engagement(uuid, text, text, text) from public, anon;
grant execute on function public.reopen_engagement(uuid, text, text, text) to authenticated;

-- Signing again closes the open amendment with who signed and when.
create function private.close_amendment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'locked' and old.status is distinct from 'locked' then
    update public.engagement_amendments
    set resigned_by_name = new.signed_by_name, resigned_at = new.signed_at
    where engagement_id = new.id and resigned_at is null;
  end if;
  return new;
end;
$$;
create trigger engagements_close_amendment after update on public.engagements
  for each row execute function private.close_amendment();
revoke execute on function private.close_amendment() from public;
