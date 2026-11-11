-- WhatsApp reminders go out one hour before the visit instead of the
-- afternoon before, so they no longer repeat the booking confirmation a few
-- hours later. A job every five minutes (/api/cron/whatsapp/reminders, called
-- by pg_cron, see 20261111205916_whatsapp_reminder_schedule) queues and sends
-- them. The daily job keeps its housekeeping.

drop function if exists public.whatsapp_queue_reminders(date);

-- Queues the reminders of the visits that start between 15 and 60 minutes
-- from now. A visit whose confirmation went out less than three hours before
-- it starts (booked the same morning, or a walk-in) gets no reminder: the
-- confirmation is fresh. One reminder per visit and time (the unique index),
-- so running every few minutes sends each one once. Answers the new ids.
create or replace function public.whatsapp_queue_reminders()
returns setof uuid
language sql
set search_path = ''
as $$
  insert into public.whatsapp_messages (kind, appointment_id, patient_id, starts_at, to_phone)
  select 'reminder', a.id, a.patient_id, a.starts_at, p.phone_e164
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  cross join public.whatsapp_settings s
  where a.starts_at > now() + interval '15 minutes'
    and a.starts_at <= now() + interval '60 minutes'
    and s.connected
    and s.send_reminders
    and a.status in ('scheduled', 'confirmed')
    and p.whatsapp_consent
    and public.whatsapp_reachable(p.phone_e164)
    and not exists (
      select 1
      from public.whatsapp_messages c
      where c.appointment_id = a.id
        and c.kind = 'confirmation'
        and c.starts_at = a.starts_at
        and c.status in ('sending', 'sent', 'delivered', 'read')
        and c.created_at > a.starts_at - interval '3 hours'
    )
  on conflict (appointment_id, kind, starts_at) do nothing
  returning id;
$$;

revoke execute on function public.whatsapp_queue_reminders() from public, anon, authenticated;
grant execute on function public.whatsapp_queue_reminders() to service_role;

-- The reminder query looks up upcoming visits by time, not by day.
create index if not exists appointments_upcoming_idx on public.appointments (starts_at)
  where status in ('scheduled', 'confirmed');

comment on column public.whatsapp_settings.send_reminders is
  'Reminder one hour before each visit.';
