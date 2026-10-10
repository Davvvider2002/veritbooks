-- VeritBooks: disclosures the trial balance cannot supply (directors, fixed asset disposals,
-- tax reconciliation, related parties, earlier years). Run once, after 0003.

alter table public.engagements add column disclosures jsonb not null default '{}';

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
      'disclosures', case when new.disclosures is distinct from old.disclosures then new.disclosures end,
      'programme_changed', case when new.programme is distinct from old.programme then true end
    )) end
  );
  return new;
end;
$$;
