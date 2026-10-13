-- VeritBooks: report branding, client logos and audit file numbers. Run once, after 0012.
-- Nothing is removed.

-- A logo is kept as a small image (a data URL, resized in the browser before it is saved).
alter table public.clients add column logo text check (logo is null or (logo like 'data:image/%' and length(logo) <= 400000));
alter table public.clients add column logo_placement text not null default 'centre' check (logo_placement in ('left', 'centre', 'right'));

-- How the firm's reports look: its logo and watermark, typeface, and the footer on every page.
alter table public.firms add column branding jsonb not null default '{}';
-- How engagements are numbered: by hand, or automatically from a pattern.
alter table public.firms add column file_numbering jsonb not null default '{"mode": "manual"}';
alter table public.firms add column next_file_no integer not null default 1 check (next_file_no > 0);

alter table public.engagements add column file_no text not null default '' check (length(file_no) <= 60);
create unique index engagements_file_no_idx on public.engagements (firm_id, lower(file_no)) where file_no <> '';

-- Partners and managers set the branding. Partners alone may change the rest of the firm's details.
create function public.set_firm_branding(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
begin
  select m.firm_id into v_firm from public.firm_members m
  where m.user_id = auth.uid() and m.role in ('partner', 'manager');
  if v_firm is null then
    raise exception 'Only a partner or manager can change the report branding.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p) <> 'object' or length(p::text) > 450000 then
    raise exception 'The branding is too large. Use a smaller logo.' using errcode = 'P0001';
  end if;
  if p ? 'logo' and p ->> 'logo' is not null and p ->> 'logo' not like 'data:image/%' then
    raise exception 'The logo must be an image.' using errcode = 'P0001';
  end if;
  perform private.require_open(v_firm);
  update public.firms set branding = p where id = v_firm;
end;
$$;

create function public.set_file_numbering(p_mode text, p_pattern text, p_next integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
begin
  select m.firm_id into v_firm from public.firm_members m where m.user_id = auth.uid() and m.role = 'partner';
  if v_firm is null then
    raise exception 'Only a partner can change how files are numbered.' using errcode = 'P0001';
  end if;
  if p_mode not in ('manual', 'auto') then
    raise exception 'Choose manual or automatic numbering.' using errcode = 'P0001';
  end if;
  if p_mode = 'auto' and (coalesce(trim(p_pattern), '') = '' or p_pattern not like '%{N}%' or length(p_pattern) > 40) then
    raise exception 'An automatic pattern needs {N} where the number goes, for example VB/{YYYY}/{N}.' using errcode = 'P0001';
  end if;
  if p_next is null or p_next < 1 then
    raise exception 'The next number must be 1 or more.' using errcode = 'P0001';
  end if;
  perform private.require_open(v_firm);
  update public.firms
  set file_numbering = jsonb_build_object('mode', p_mode, 'pattern', trim(coalesce(p_pattern, ''))), next_file_no = p_next
  where id = v_firm;
end;
$$;

-- With automatic numbering, a new engagement takes the next number unless one is given.
-- {YYYY} is the year of the year end, {YY} its last two digits, {N} the number (at least three digits).
create function private.assign_file_no() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_firm public.firms;
  v_no text;
begin
  if coalesce(trim(new.file_no), '') <> '' then
    new.file_no := trim(new.file_no);
    return new;
  end if;
  select * into v_firm from public.firms where id = new.firm_id for update;
  if v_firm.file_numbering ->> 'mode' is distinct from 'auto' then
    return new;
  end if;
  loop
    v_no := replace(replace(replace(v_firm.file_numbering ->> 'pattern',
              '{YYYY}', to_char(new.year_end, 'YYYY')),
              '{YY}', to_char(new.year_end, 'YY')),
              '{N}', lpad(v_firm.next_file_no::text, 3, '0'));
    v_firm.next_file_no := v_firm.next_file_no + 1;
    exit when not exists (select 1 from public.engagements where firm_id = new.firm_id and lower(file_no) = lower(v_no));
  end loop;
  update public.firms set next_file_no = v_firm.next_file_no where id = new.firm_id;
  new.file_no := v_no;
  return new;
end;
$$;
create trigger engagements_file_no before insert on public.engagements
  for each row execute function private.assign_file_no();

revoke execute on function public.set_firm_branding(jsonb), public.set_file_numbering(text, text, integer) from public, anon;
grant execute on function public.set_firm_branding(jsonb), public.set_file_numbering(text, text, integer) to authenticated;
grant execute on all functions in schema private to authenticated;
