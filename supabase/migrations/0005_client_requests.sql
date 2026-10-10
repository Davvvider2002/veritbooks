-- VeritBooks: client requests, and a link the client uses to upload what was asked for.
-- Run once, after 0004. The client has no account: the link carries a long random token,
-- and only a hash of it is stored here.

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  detail text not null default '',
  due_date date,
  status text not null default 'open' check (status in ('open', 'received', 'accepted', 'returned')),
  note text not null default '', -- the firm's message to the client when an item is returned
  sort integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index client_requests_engagement_idx on public.client_requests (engagement_id, sort);

create table public.request_links (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (length(trim(label)) > 0), -- who the link was given to
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index request_links_engagement_idx on public.request_links (engagement_id);

alter table public.evidence add column request_id uuid references public.client_requests (id) on delete set null;
alter table public.evidence add column from_client boolean not null default false;
alter table public.evidence drop constraint evidence_ref_type_check;
alter table public.evidence add constraint evidence_ref_type_check
  check (ref_type in ('general', 'programme', 'journal', 'bank', 'adjustment', 'request'));

create trigger client_requests_guard before insert or update or delete on public.client_requests
  for each row execute function private.guard_child();
create trigger request_links_guard before insert or update or delete on public.request_links
  for each row execute function private.guard_child();

create function private.log_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  j jsonb; -- the row as JSON, because the two tables this serves have different columns
  v_firm uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  j := to_jsonb(r);
  select firm_id into v_firm from public.engagements where id = r.engagement_id;
  if v_firm is null then return r; end if;
  insert into public.audit_log (firm_id, engagement_id, table_name, action, row_id, user_id, detail)
  values (v_firm, r.engagement_id, tg_table_name, lower(tg_op), r.id, auth.uid(),
          case when tg_table_name = 'client_requests'
               then jsonb_build_object('title', j -> 'title', 'status', j -> 'status')
               else jsonb_build_object('label', j -> 'label', 'revoked', (j ->> 'revoked_at') is not null) end);
  return r;
end;
$$;
create trigger client_requests_log after insert or update or delete on public.client_requests
  for each row execute function private.log_request();
-- Links are logged when made and when revoked, not on every visit.
create trigger request_links_log after insert or delete or update of revoked_at on public.request_links
  for each row execute function private.log_request();

alter table public.client_requests enable row level security;
alter table public.request_links enable row level security;
create policy client_requests_all on public.client_requests for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));
create policy request_links_all on public.request_links for all to authenticated
  using (private.is_member(private.engagement_firm(engagement_id)))
  with check (private.is_member(private.engagement_firm(engagement_id)));
revoke all on public.client_requests, public.request_links from anon;
grant select, insert, update, delete on public.client_requests, public.request_links to authenticated;

-- ---------------------------------------------------------------------------
-- The client's side. Everything a link holder can do goes through the two functions
-- and the one storage rule below. A link holder can see the list of requests and the
-- names of files already sent, and can add files. They cannot read any file back.
-- ---------------------------------------------------------------------------

-- The link behind a token, if it is still usable.
create function private.live_link(p_token text) returns public.request_links
language sql stable security definer set search_path = '' as $$
  select l.*
  from public.request_links l
  where p_token ~ '^[A-Za-z0-9_-]{43}$'
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.revoked_at is null
    and l.expires_at > now();
$$;

create function public.portal_view(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.request_links := private.live_link(p_token);
  v_eng public.engagements;
begin
  if v_link.id is null then
    return null; -- unknown, expired and revoked links all look the same from outside
  end if;
  select * into v_eng from public.engagements where id = v_link.engagement_id;
  update public.request_links set last_used_at = now() where id = v_link.id and v_eng.status = 'in_progress';
  return jsonb_build_object(
    'firm', (select name from public.firms where id = v_eng.firm_id),
    'client', (select name from public.clients where id = v_eng.client_id),
    'year_end', v_eng.year_end,
    'closed', v_eng.status <> 'in_progress',
    'folder', v_eng.firm_id::text || '/' || v_eng.id::text,
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'detail', r.detail, 'due_date', r.due_date,
        'status', r.status, 'note', r.note,
        'files', coalesce((
          select jsonb_agg(jsonb_build_object('name', e.file_name, 'at', e.created_at) order by e.created_at)
          from public.evidence e where e.request_id = r.id and e.from_client), '[]'::jsonb)
      ) order by r.sort, r.created_at)
      from public.client_requests r where r.engagement_id = v_eng.id), '[]'::jsonb)
  );
end;
$$;

-- Records a file the client has just uploaded against the request it answers.
create function public.portal_attach(p_token text, p_request uuid, p_path text, p_file_name text, p_size bigint, p_mime text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.request_links := private.live_link(p_token);
  v_firm uuid;
begin
  if v_link.id is null then
    raise exception 'This link is no longer valid.' using errcode = 'P0001';
  end if;
  v_firm := private.engagement_firm(v_link.engagement_id);
  if not exists (select 1 from public.client_requests where id = p_request and engagement_id = v_link.engagement_id) then
    raise exception 'That request is not on this list.' using errcode = 'P0001';
  end if;
  if p_path not like v_firm::text || '/' || v_link.engagement_id::text || '/p\_' || p_token || '\_%'
     or not exists (select 1 from storage.objects where bucket_id = 'evidence' and name = p_path) then
    raise exception 'The file was not received. Please try again.' using errcode = 'P0001';
  end if;
  insert into public.evidence (engagement_id, path, file_name, size_bytes, mime, ref_type, ref_id, request_id, from_client, uploaded_by, uploaded_by_name)
  values (v_link.engagement_id, p_path, left(trim(p_file_name), 200), greatest(coalesce(p_size, 0), 0), left(coalesce(p_mime, ''), 100),
          'request', p_request::text, p_request, true, null, v_link.label);
  update public.client_requests set status = 'received' where id = p_request and status in ('open', 'returned');
end;
$$;

revoke execute on function public.portal_view(text) from public;
revoke execute on function public.portal_attach(text, uuid, text, text, bigint, text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;
grant execute on function public.portal_attach(text, uuid, text, text, bigint, text) to anon, authenticated;

-- A link holder may add a file named firm/engagement/p_<token>_<anything> while the link is
-- live and the engagement is unsigned. At most 300 client files are held per engagement.
create function private.portal_upload_ok(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_link public.request_links;
begin
  if coalesce(array_length(v_parts, 1), 0) <> 3 or v_parts[3] !~ '^p_[A-Za-z0-9_-]{43}_[A-Za-z0-9.-]{1,80}$' then
    return false;
  end if;
  v_link := private.live_link(substr(v_parts[3], 3, 43));
  if v_link.id is null or v_link.engagement_id::text <> v_parts[2] then return false; end if;
  if not exists (
    select 1 from public.engagements e
    where e.id = v_link.engagement_id and e.firm_id::text = v_parts[1] and e.status = 'in_progress'
  ) then return false; end if;
  return (select count(*) from storage.objects o
          where o.bucket_id = 'evidence' and o.name like v_parts[1] || '/' || v_parts[2] || '/p\_%') < 300;
end;
$$;

create policy evidence_objects_portal_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'evidence' and private.portal_upload_ok(name));

grant usage on schema private to anon;
grant execute on function private.portal_upload_ok(text) to anon, authenticated;
grant execute on all functions in schema private to authenticated;
