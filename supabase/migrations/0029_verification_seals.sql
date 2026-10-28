-- 0029: a verification seal on every signed report. Run once, after 0028.
--
-- When an engagement partner signs, the database seals the signed report: who signed it, for
-- which firm and client, the year end, the engagement type and opinion, the headline figures,
-- the report wording, and when. It fingerprints all of it with SHA-256 and gives the seal a
-- short code, printed on the report with a QR code. Anyone holding the report can check it at
-- veritbooks.com/verify. The summary is public to whoever has the code; the full report is
-- shown only when the firm allows it, or with the access code the firm gives its client.
--
-- A seal is never changed by a person. Reopening a signed file marks its seal "reopened";
-- signing again issues a new seal and marks the old one "superseded", pointing to the new one.
-- The seal proves who signed what and when. It says nothing about the quality of the work.

create table public.report_seals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^VB-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  engagement_id uuid not null references public.engagements (id),
  firm_id uuid not null references public.firms (id),
  version integer not null,
  status text not null default 'valid' check (status in ('valid', 'reopened', 'superseded', 'withdrawn')),
  superseded_by uuid references public.report_seals (id),
  firm_name text not null,
  firm_licence text,
  country text,
  partner_name text,
  partner_licence text,
  client_name text not null,
  client_number text,
  year_end date not null,
  engagement_type text not null,
  opinion text,
  currency text,
  figures jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  hash text not null,
  signed_at timestamptz not null,
  reopened_at timestamptz,
  -- The firm chooses whether anyone with the code may read the full report.
  public_report boolean not null default false,
  -- Given by the firm to its client, who shares it with a bank or embassy to show the full report.
  access_code text not null check (access_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  unique (engagement_id, version)
);
create index report_seals_engagement_idx on public.report_seals (engagement_id);

alter table public.report_seals enable row level security;
create policy report_seals_read on public.report_seals for select to authenticated using (private.is_member(firm_id));
revoke all on public.report_seals from anon;
revoke insert, update, delete on public.report_seals from authenticated;
grant select on public.report_seals to authenticated;

-- Random characters from an alphabet with no look-alikes (no 0, O, 1, I or L).
create function private.seal_chars(p_len integer) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_hex text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_out text := '';
  i integer;
begin
  for i in 1..p_len loop
    v_out := v_out || substr(v_alpha, 1 + (('x' || substr(v_hex, i * 2 - 1, 2))::bit(8)::integer % length(v_alpha)), 1);
  end loop;
  return v_out;
end;
$$;

-- Issues the seal when a file is signed, and marks it when the file is reopened.
create function private.seal_on_sign() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_client public.clients;
  v_code text;
  v_version integer;
  v_payload jsonb;
  v_id uuid;
begin
  if new.status = 'locked' and old.status is distinct from 'locked' then
    select * into v_firm from public.firms where id = new.firm_id;
    select * into v_client from public.clients where id = new.client_id;
    select coalesce(max(version), 0) + 1 into v_version from public.report_seals where engagement_id = new.id;
    loop
      v_code := 'VB-' || private.seal_chars(4) || '-' || private.seal_chars(4);
      exit when not exists (select 1 from public.report_seals where code = v_code);
    end loop;
    v_payload := jsonb_build_object(
      'engagement', new.id, 'version', v_version, 'firm', v_firm.name, 'firm_licence', nullif(new.firm_frc, ''),
      'partner', new.signed_by_name, 'partner_licence', nullif(new.signed_by_frc, ''),
      'client', v_client.name, 'client_number', nullif(v_client.rc_number, ''),
      'year_end', new.year_end, 'type', new.type, 'opinion', new.report ->> 'opinion',
      'currency', new.currency, 'figures', coalesce(new.report -> 'signedFigures', '{}'::jsonb),
      'report', coalesce(new.report -> 'signedReport', '{}'::jsonb), 'signed_at', new.signed_at);
    insert into public.report_seals (code, engagement_id, firm_id, version, firm_name, firm_licence, country, partner_name, partner_licence,
      client_name, client_number, year_end, engagement_type, opinion, currency, figures, report, hash, signed_at, access_code)
    values (v_code, new.id, new.firm_id, v_version, v_firm.name, nullif(new.firm_frc, ''), v_firm.country, new.signed_by_name, nullif(new.signed_by_frc, ''),
      v_client.name, nullif(v_client.rc_number, ''), new.year_end, new.type,
      case when new.type = 'compilation' then null else coalesce(new.report ->> 'opinion', 'unmodified') end,
      new.currency, coalesce(new.report -> 'signedFigures', '{}'::jsonb), coalesce(new.report -> 'signedReport', '{}'::jsonb),
      encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex'), coalesce(new.signed_at, now()), private.seal_chars(6))
    returning id into v_id;
    update public.report_seals set status = 'superseded', superseded_by = v_id
    where engagement_id = new.id and id <> v_id and status in ('valid', 'reopened');
  elsif old.status = 'locked' and new.status is distinct from 'locked' then
    update public.report_seals set status = 'reopened', reopened_at = now()
    where engagement_id = new.id and status = 'valid';
  end if;
  return new;
end;
$$;
create trigger engagements_seal after update on public.engagements
  for each row execute function private.seal_on_sign();
revoke execute on function private.seal_on_sign() from public;

-- What anyone holding the code may see: the summary, and whether the full report is open to them.
create function public.verify_seal(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', s.code, 'status', s.status, 'version', s.version,
    'superseded_by', (select n.code from public.report_seals n where n.id = s.superseded_by),
    'firm', s.firm_name, 'firm_licence', s.firm_licence, 'country', s.country,
    'partner', s.partner_name, 'partner_licence', s.partner_licence,
    'client', s.client_name, 'client_number', s.client_number,
    'year_end', s.year_end, 'type', s.engagement_type, 'opinion', s.opinion, 'currency', s.currency,
    'figures', s.figures, 'signed_at', s.signed_at, 'reopened_at', s.reopened_at, 'hash', s.hash,
    'report_open', s.public_report)
  from public.report_seals s
  where s.code = upper(trim(coalesce(p_code, '')));
$$;
revoke execute on function public.verify_seal(text) from public;
grant execute on function public.verify_seal(text) to anon, authenticated;

-- The full report as signed: open when the firm allows it, or with the access code.
create function public.verify_seal_report(p_code text, p_access text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.report_seals;
begin
  select * into v from public.report_seals where code = upper(trim(coalesce(p_code, '')));
  if v.id is null then
    raise exception 'No report carries that code.' using errcode = 'P0001';
  end if;
  if not v.public_report and upper(trim(coalesce(p_access, ''))) <> v.access_code then
    raise exception 'That access code is not right. Ask the company or its accountants for it.' using errcode = 'P0001';
  end if;
  return v.report;
end;
$$;
revoke execute on function public.verify_seal_report(text, text) from public;
grant execute on function public.verify_seal_report(text, text) to anon, authenticated;

-- A partner chooses whether anyone with the code may read the full report.
create function public.set_seal_sharing(p_seal uuid, p_public boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
begin
  select firm_id into v_firm from public.report_seals where id = p_seal;
  if v_firm is null or not private.is_partner(v_firm) then
    raise exception 'Only a partner of the firm can change who may read the report.' using errcode = 'P0001';
  end if;
  update public.report_seals set public_report = coalesce(p_public, false) where id = p_seal;
end;
$$;
revoke execute on function public.set_seal_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_seal_sharing(uuid, boolean) to authenticated;
