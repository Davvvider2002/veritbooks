-- VeritBooks: an invited colleague joins the firm that invited them. Run once, after 0019.
--
-- The invitation carries the firm's details, so the person invited only confirms their own
-- name and licence number. Someone with an open invitation cannot set up a firm of their own
-- instead: the firm's name and details come from the partner who invited them.

-- What the invited person sees: the firm, where it practises, and who invited them.
create function public.my_invite_details()
returns table (id uuid, firm_name text, role text, country text, address text, firm_licence text, invited_by text)
language sql stable security definer set search_path = '' as $$
  select i.id, f.name, i.role, f.country, f.address, f.frc_number,
         coalesce(nullif(m.full_name, ''), (select email from auth.users where id = i.invited_by), '')
  from public.firm_invites i
  join public.firms f on f.id = i.firm_id
  join auth.users u on u.id = auth.uid()
  left join public.firm_members m on m.firm_id = i.firm_id and m.user_id = i.invited_by
  where i.accepted_at is null
    and i.email = lower(u.email)
    and u.email_confirmed_at is not null
  order by i.created_at;
$$;
revoke execute on function public.my_invite_details() from public, anon;
grant execute on function public.my_invite_details() to authenticated;

-- A firm cannot be set up by someone who has been invited to join one.
create function private.guard_invited_firm() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_firm text;
begin
  if auth.uid() is null then return new; end if;
  select f.name into v_firm
  from public.firm_invites i
  join public.firms f on f.id = i.firm_id
  join auth.users u on u.id = auth.uid()
  where i.accepted_at is null and i.email = lower(u.email)
  order by i.created_at limit 1;
  if v_firm is not null then
    raise exception 'You have been invited to join %. Accept that invitation instead of setting up a new firm.', v_firm using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger firms_invited_guard before insert on public.firms
  for each row execute function private.guard_invited_firm();
revoke execute on function private.guard_invited_firm() from public;
