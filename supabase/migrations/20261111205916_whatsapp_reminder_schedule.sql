-- Calls /api/cron/whatsapp/reminders every five minutes, so each reminder
-- leaves 55 to 60 minutes before its visit. Vercel Cron cannot do it on the
-- Hobby plan (once a day, at some point within the hour), so the database
-- schedules it: pg_cron runs the job and pg_net makes the request.
--
-- The request carries a token that lives only in Vault
-- ("whatsapp_reminders_token", made here). The route checks it with
-- whatsapp_reminders_token_ok, so it needs no new environment variable. To
-- change the token, update the Vault secret; nothing else.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'whatsapp_reminders_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'whatsapp_reminders_token',
      'Bearer token of the WhatsApp reminder job (pg_cron → /api/cron/whatsapp/reminders).'
    );
  end if;
end;
$$;

-- Whether a request carries the reminder job's token. Service role only.
create or replace function public.whatsapp_reminders_token_ok(token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(token) >= 32, false) and exists (
    select 1
    from vault.decrypted_secrets
    where name = 'whatsapp_reminders_token'
      and decrypted_secret = token
  );
$$;

revoke execute on function public.whatsapp_reminders_token_ok(text) from public, anon, authenticated;
grant execute on function public.whatsapp_reminders_token_ok(text) to service_role;

-- The production domain (the apex redirects to www). The route answers within
-- a few seconds; the timeout leaves room for a busy hour.
select cron.schedule(
  'whatsapp-reminders',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://www.cmisantisimatrinidad.com/api/cron/whatsapp/reminders',
      headers := jsonb_build_object(
        'authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_reminders_token')
      ),
      timeout_milliseconds := 60000
    );
  $job$
);

-- pg_cron keeps a row per run (288 a day); a week is enough to look back.
select cron.schedule(
  'cron-history-cleanup',
  '17 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '7 days' $job$
);
