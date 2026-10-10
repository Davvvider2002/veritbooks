-- VeritBooks: the daily reminder run. Run once, after migration 0010, in the Supabase SQL editor.
-- Replace YOUR-PROJECT with your project reference. It needs the pg_cron and pg_net extensions.
-- Every morning at 07:00 Lagos time the database calls the billing function, which emails the
-- trial and renewal reminders that are due. The call carries a token only the database knows.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'veritbooks-billing-reminders',
  '0 6 * * *',
  $job$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/billing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select token from private.cron_token)),
    body := '{}'::jsonb
  );
  $job$
);
