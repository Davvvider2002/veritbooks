-- 0025: the two single-row settings updates name their row.
--
-- Requests through the Supabase API run with pg_safeupdate, which refuses an UPDATE with no
-- WHERE clause: "UPDATE requires a WHERE clause". The partner programme settings and the
-- seller details each update a one-row table without one, so saving them failed on the live
-- site (the test database does not load pg_safeupdate). Each now says which row: the only one,
-- whose id is true. The functions are patched in place, so nothing else in them changes.

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.admin_partner_act(text, jsonb)'::regprocedure);
  if position('updated_at = now();' in v_def) = 0 then
    raise exception 'admin_partner_act is not as expected';
  end if;
  execute replace(v_def, 'updated_at = now();', 'updated_at = now()' || chr(10) || '    where id;');

  v_def := pg_get_functiondef('public.admin_act_net(text, jsonb)'::regprocedure);
  if position('support_email = left(trim(coalesce(p ->> ''support_email'', '''')), 200);' in v_def) = 0 then
    raise exception 'admin_act_net is not as expected';
  end if;
  execute replace(v_def, 'support_email = left(trim(coalesce(p ->> ''support_email'', '''')), 200);',
                  'support_email = left(trim(coalesce(p ->> ''support_email'', '''')), 200)' || chr(10) || '    where id;');
end;
$$;
