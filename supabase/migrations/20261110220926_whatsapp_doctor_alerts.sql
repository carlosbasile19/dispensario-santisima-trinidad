-- WhatsApp alerts to doctors. When a visit is booked with a doctor or the
-- medical director (online, in Nueva cita, or by adding them to a visit
-- later), the clinic's number sends them a message right away with the
-- patient, the day, the time and their services on the visit. It is the same
-- Zernio connection as the patients' messages (20261110160007_whatsapp_messaging),
-- so with Coexistence each alert also shows in the front desk's WhatsApp
-- Business app, in the chat with that doctor.
--
--   - whatsapp_doctor_phones: the number each professional gets alerts on,
--     set by administrators with the professional's consent.
--   - whatsapp_doctor_alerts: one row per professional and visit. A trigger
--     on appointment_items queues it; the server (src/lib/whatsapp/send.ts)
--     sends it right after the booking. Delivery statuses come back through
--     the webhook (whatsapp_record_status). No message text is stored.
--   - whatsapp_settings.send_doctor_alerts: administrators pause them all.
--
-- Writes are for the service role, except the numbers and the switch, which
-- administrators set. Those who see the whole schedule see each visit's
-- alerts, and a doctor sees their own, but never the number they went to.

-- Switch --------------------------------------------------------------------------

alter table public.whatsapp_settings
  add column send_doctor_alerts boolean not null default true;

grant update (send_doctor_alerts) on public.whatsapp_settings to authenticated;

-- The doctors' numbers ----------------------------------------------------------------

create table public.whatsapp_doctor_phones (
  professional_id  uuid primary key references public.profiles (id) on delete cascade,
  -- +58 4xx… or a number from abroad, as for patients (whatsapp_reachable).
  phone            text not null constraint whatsapp_doctor_phones_phone check (public.whatsapp_reachable(phone)),
  updated_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.whatsapp_doctor_phones is
  'The WhatsApp number each doctor (or the medical director) gets new-visit alerts on. Administrators only.';

create index whatsapp_doctor_phones_updated_by_idx on public.whatsapp_doctor_phones (updated_by);

-- Alerts go to doctors and the medical director only. Stamps who set the
-- number. Security definer, like calendars_check_professional, so the check
-- does not depend on who can read other members' profiles.
create or replace function public.whatsapp_doctor_phones_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.professional_id and role in ('doctor', 'director')) then
    raise exception 'Alerts go to a doctor or the medical director'
      using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke execute on function public.whatsapp_doctor_phones_prepare() from public, anon, authenticated;

create trigger whatsapp_doctor_phones_prepare
  before insert or update on public.whatsapp_doctor_phones
  for each row execute function public.whatsapp_doctor_phones_prepare();

alter table public.whatsapp_doctor_phones enable row level security;

create policy "whatsapp_doctor_phones_admins" on public.whatsapp_doctor_phones
  for all to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

revoke all on public.whatsapp_doctor_phones from anon, authenticated;
grant select, delete on public.whatsapp_doctor_phones to authenticated;
-- An upsert sets the key too, so the update grant includes it.
grant insert (professional_id, phone) on public.whatsapp_doctor_phones to authenticated;
grant update (professional_id, phone) on public.whatsapp_doctor_phones to authenticated;

-- Alerts ------------------------------------------------------------------------------

create table public.whatsapp_doctor_alerts (
  id                 uuid primary key default gen_random_uuid(),
  appointment_id     uuid not null references public.appointments (id) on delete cascade,
  professional_id    uuid not null references public.profiles (id) on delete cascade,
  -- The visit time the alert announces: the visit's time when it was queued,
  -- and again when it was sent.
  starts_at          timestamptz not null,
  to_phone           text not null constraint whatsapp_doctor_alerts_phone check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- As whatsapp_messages: pending → sending → sent → delivered → read, or
  -- failed. skipped: not sent on purpose (paused, the visit was cancelled…).
  status             text not null default 'pending'
                     constraint whatsapp_doctor_alerts_status
                     check (status in ('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  template_name      text constraint whatsapp_doctor_alerts_template_length check (char_length(template_name) <= 512),
  template_language  text constraint whatsapp_doctor_alerts_language_length check (char_length(template_language) <= 10),
  -- WhatsApp's message id (wamid), as Zernio returns it, and Zernio's conversation.
  wamid              text constraint whatsapp_doctor_alerts_wamid_length check (char_length(wamid) <= 200),
  conversation_id    text constraint whatsapp_doctor_alerts_conversation_length check (char_length(conversation_id) <= 100),
  error_code         text constraint whatsapp_doctor_alerts_error_code_length check (char_length(error_code) <= 40),
  error              text constraint whatsapp_doctor_alerts_error_length check (char_length(error) <= 500),
  created_at         timestamptz not null default now(),
  sent_at            timestamptz,
  delivered_at       timestamptz,
  read_at            timestamptz,
  failed_at          timestamptz
);

comment on table public.whatsapp_doctor_alerts is
  'One row per WhatsApp alert to a doctor about a visit booked with them. No message text is stored.';

-- One alert per professional and visit: a second service with the same
-- doctor, or moving the visit, sends no other.
create unique index whatsapp_doctor_alerts_once on public.whatsapp_doctor_alerts (appointment_id, professional_id);
create unique index whatsapp_doctor_alerts_wamid_key on public.whatsapp_doctor_alerts (wamid) where wamid is not null;
create index whatsapp_doctor_alerts_professional_idx on public.whatsapp_doctor_alerts (professional_id, created_at desc);
create index whatsapp_doctor_alerts_created_idx on public.whatsapp_doctor_alerts (created_at desc);
create index whatsapp_doctor_alerts_pending_idx on public.whatsapp_doctor_alerts (created_at) where status = 'pending';

alter table public.whatsapp_doctor_alerts enable row level security;

create policy "whatsapp_doctor_alerts_select" on public.whatsapp_doctor_alerts
  for select to authenticated
  using ((select public.sees_all_schedule()) or professional_id = (select auth.uid()));

revoke all on public.whatsapp_doctor_alerts from anon, authenticated;
-- Everything but the number and Zernio's ids.
grant select (id, appointment_id, professional_id, starts_at, status, error, created_at, sent_at, delivered_at, read_at, failed_at)
  on public.whatsapp_doctor_alerts to authenticated;

-- Queueing --------------------------------------------------------------------------------

-- Queues the alert when a professional is put on an upcoming visit (a new
-- visit's services, a service added later, or a service given to another
-- professional), while the number is connected, alerts are on and the
-- professional has a number. The server sends it right after. Security
-- definer: members cannot read the numbers or write alerts. A failure here
-- never stops the booking.
create or replace function public.whatsapp_queue_doctor_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.professional_id is null
     or (tg_op = 'UPDATE' and new.professional_id is not distinct from old.professional_id) then
    return null;
  end if;

  begin
    insert into public.whatsapp_doctor_alerts (appointment_id, professional_id, starts_at, to_phone)
    select a.id, d.professional_id, a.starts_at, d.phone
    from public.appointments a
    join public.whatsapp_doctor_phones d on d.professional_id = new.professional_id
    cross join public.whatsapp_settings s
    where a.id = new.appointment_id
      and s.id
      and s.connected
      and s.send_doctor_alerts
      and a.status in ('scheduled', 'confirmed')
      and a.starts_at > now()
    on conflict (appointment_id, professional_id) do nothing;
  exception when others then
    raise warning 'whatsapp_queue_doctor_alert: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke execute on function public.whatsapp_queue_doctor_alert() from public, anon, authenticated;

create trigger appointment_items_queue_doctor_alert
  after insert or update of professional_id on public.appointment_items
  for each row execute function public.whatsapp_queue_doctor_alert();

-- What the sender needs to write each alert: the professional's number now
-- (null once removed), the visit as it is now, whether the professional is
-- still on it, the patient's name and the professional's services on the
-- visit, in the order they were added (by name within one booking, whose
-- services all share a created_at).
create or replace function public.whatsapp_doctor_alert_outbox(alerts uuid[])
returns table (
  id uuid,
  status text,
  professional_id uuid,
  phone text,
  visit_status public.appointment_status,
  visit_starts_at timestamptz,
  on_visit boolean,
  first_name text,
  last_name text,
  services text
)
language sql
stable
set search_path = ''
as $$
  select
    al.id,
    al.status,
    al.professional_id,
    d.phone,
    a.status,
    a.starts_at,
    exists (
      select 1 from public.appointment_items i
      where i.appointment_id = a.id and i.professional_id = al.professional_id
    ),
    p.first_name,
    p.last_name,
    (
      select string_agg(s.name, ' · ' order by i.created_at, s.name, i.id)
      from public.appointment_items i
      join public.services s on s.id = i.service_id
      where i.appointment_id = a.id and i.professional_id = al.professional_id
    )
  from public.whatsapp_doctor_alerts al
  join public.appointments a on a.id = al.appointment_id
  join public.patients p on p.id = a.patient_id
  left join public.whatsapp_doctor_phones d on d.professional_id = al.professional_id
  where al.id = any (alerts);
$$;

revoke execute on function public.whatsapp_doctor_alert_outbox(uuid[]) from public, anon, authenticated;
grant execute on function public.whatsapp_doctor_alert_outbox(uuid[]) to service_role;

-- Delivery status --------------------------------------------------------------------------

-- As before for the patients' messages, and now also for the doctors'
-- alerts: the webhook's delivery statuses land on whichever has the wamid.
-- Statuses only move forward; "failed" always lands. Answers the row's id,
-- or null. Same signature, so its grants (service role only) are kept.
create or replace function public.whatsapp_record_status(
  ref text,
  new_status text,
  status_at timestamptz,
  code text default null,
  detail text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  new_rank integer := case new_status when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 end;
  stamp timestamptz := coalesce(status_at, now());
begin
  if coalesce(ref, '') = '' or (new_rank is null and new_status <> 'failed') then
    return null;
  end if;

  update public.whatsapp_messages m
  set
    status = case
      when new_status = 'failed' then 'failed'
      when (case m.status when 'pending' then 0 when 'sending' then 1 when 'sent' then 2
                          when 'delivered' then 3 when 'read' then 4 else -1 end) < new_rank then new_status
      else m.status
    end,
    sent_at = case when new_status in ('sent', 'delivered', 'read') then coalesce(m.sent_at, stamp) else m.sent_at end,
    delivered_at = case when new_status in ('delivered', 'read') then coalesce(m.delivered_at, stamp) else m.delivered_at end,
    read_at = case when new_status = 'read' then coalesce(m.read_at, stamp) else m.read_at end,
    failed_at = case when new_status = 'failed' then coalesce(m.failed_at, stamp) else m.failed_at end,
    error_code = case when new_status = 'failed' then left(code, 40) else m.error_code end,
    error = case when new_status = 'failed' then left(detail, 500) else m.error end
  where m.wamid = ref
  returning m.id into target;

  if target is null then
    update public.whatsapp_doctor_alerts al
    set
      status = case
        when new_status = 'failed' then 'failed'
        when (case al.status when 'pending' then 0 when 'sending' then 1 when 'sent' then 2
                             when 'delivered' then 3 when 'read' then 4 else -1 end) < new_rank then new_status
        else al.status
      end,
      sent_at = case when new_status in ('sent', 'delivered', 'read') then coalesce(al.sent_at, stamp) else al.sent_at end,
      delivered_at = case when new_status in ('delivered', 'read') then coalesce(al.delivered_at, stamp) else al.delivered_at end,
      read_at = case when new_status = 'read' then coalesce(al.read_at, stamp) else al.read_at end,
      failed_at = case when new_status = 'failed' then coalesce(al.failed_at, stamp) else al.failed_at end,
      error_code = case when new_status = 'failed' then left(code, 40) else al.error_code end,
      error = case when new_status = 'failed' then left(detail, 500) else al.error end
    where al.wamid = ref
    returning al.id into target;
  end if;

  return target;
end;
$$;
