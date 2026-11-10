-- WhatsApp messages to patients from the clinic's own number, sent through
-- Zernio (a Meta Tech Provider) with WhatsApp Coexistence: the number stays in
-- the WhatsApp Business app on the front desk's phone, and the platform sends
-- a confirmation when a visit is booked and a reminder the day before.
--
-- The Next.js server talks to Zernio (src/lib/whatsapp). The database keeps:
--   - each patient's consent (patients.whatsapp_consent),
--   - the connection and its switches (whatsapp_settings, one row),
--   - the templates' review status at Meta (whatsapp_templates),
--   - one row per message (whatsapp_messages): who, which visit, delivery
--     status and the patient's button answer, never the message text,
--   - the ids of the webhook events already handled (whatsapp_webhook_events).
-- A patient's button answer is applied to the visit by whatsapp_apply_reply.
--
-- Everything that writes is for the service role only: the webhook, the
-- reminder job and the server code after it has checked the member. The
-- integration (connection, switches, templates) is visible to administrators
-- only; other members see a visit's messages and whether WhatsApp is connected.

-- Consent ---------------------------------------------------------------------

alter table public.patients
  add column whatsapp_consent boolean,
  add column whatsapp_consent_at timestamptz,
  add column whatsapp_user_id text constraint patients_whatsapp_user_id_length check (char_length(whatsapp_user_id) <= 200);

comment on column public.patients.whatsapp_consent is
  'Confirmations and reminders on WhatsApp: true accepts, false declined or opted out, null never asked.';
comment on column public.patients.whatsapp_consent_at is
  'When whatsapp_consent last changed. Set by the database.';
comment on column public.patients.whatsapp_user_id is
  'The patient''s business-scoped WhatsApp user id (BSUID), learned from their replies.';

-- Stamps when consent changes, and keeps anyone from writing the stamp itself.
create or replace function public.patients_stamp_whatsapp_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.whatsapp_consent is distinct from old.whatsapp_consent then
    new.whatsapp_consent_at := case when new.whatsapp_consent is null then null else now() end;
  else
    new.whatsapp_consent_at := old.whatsapp_consent_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.patients_stamp_whatsapp_consent() from public, anon, authenticated;

create trigger patients_stamp_whatsapp_consent
  before insert or update of whatsapp_consent, whatsapp_consent_at on public.patients
  for each row execute function public.patients_stamp_whatsapp_consent();

-- The front desk records the patient's answer from the patient form.
grant insert (whatsapp_consent) on public.patients to authenticated;
grant update (whatsapp_consent) on public.patients to authenticated;

-- A number WhatsApp messages may go to: a Venezuelan mobile (+584…) or a
-- number from abroad, as online booking accepts (isBookingPhone in
-- src/lib/booking/phone.ts). Never a Venezuelan landline.
create or replace function public.whatsapp_reachable(phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(phone ~ '^\+[1-9][0-9]{7,14}$' and (phone like '+584%' or phone not like '+58%'), false);
$$;

revoke execute on function public.whatsapp_reachable(text) from public, anon;
grant execute on function public.whatsapp_reachable(text) to authenticated, service_role;

-- Connection and switches -------------------------------------------------------

create table public.whatsapp_settings (
  id                  boolean primary key default true constraint whatsapp_settings_single_row check (id),
  -- The Zernio account of the connected number, set when an administrator connects it.
  zernio_account_id   text constraint whatsapp_settings_account_length check (char_length(zernio_account_id) <= 100),
  phone               text constraint whatsapp_settings_phone_length check (char_length(phone) <= 40),
  connected           boolean not null default false,
  connected_at        timestamptz,
  connected_by        uuid references public.profiles (id) on delete set null,
  disconnected_at     timestamptz,
  disconnect_reason   text constraint whatsapp_settings_reason_length check (char_length(disconnect_reason) <= 500),
  -- Administrators can pause either kind of message without disconnecting.
  send_confirmations  boolean not null default true,
  send_reminders      boolean not null default true,
  updated_at          timestamptz not null default now()
);

insert into public.whatsapp_settings (id) values (true);

create trigger whatsapp_settings_touch_updated_at
  before update on public.whatsapp_settings
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_settings enable row level security;

create policy "whatsapp_settings_select_admins" on public.whatsapp_settings
  for select to authenticated
  using ((select public.current_app_role()) = 'admin');

create policy "whatsapp_settings_update_admins" on public.whatsapp_settings
  for update to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

revoke all on public.whatsapp_settings from anon, authenticated;
grant select on public.whatsapp_settings to authenticated;
grant update (send_confirmations, send_reminders) on public.whatsapp_settings to authenticated;

-- Whether the clinic's number is connected, for the members who cannot read
-- the settings (the WhatsApp card of a visit).
create or replace function public.whatsapp_connected()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.connected from public.whatsapp_settings s where s.id), false);
$$;

revoke execute on function public.whatsapp_connected() from public, anon;
grant execute on function public.whatsapp_connected() to authenticated, service_role;

-- Templates ---------------------------------------------------------------------

-- The review status of each template at Meta, kept up to date by the
-- whatsapp.template.status_updated webhook and by "Actualizar estado".
create table public.whatsapp_templates (
  name              text not null constraint whatsapp_templates_name_format check (name ~ '^[a-z][a-z0-9_]*$' and char_length(name) <= 512),
  language          text not null constraint whatsapp_templates_language_format check (language ~ '^[a-z]{2,3}(_[A-Z]{2})?$'),
  status            text not null constraint whatsapp_templates_status_length check (char_length(status) between 1 and 40),
  reason            text constraint whatsapp_templates_reason_length check (char_length(reason) <= 1000),
  meta_template_id  text constraint whatsapp_templates_meta_id_length check (char_length(meta_template_id) <= 100),
  updated_at        timestamptz not null default now(),
  primary key (name, language)
);

alter table public.whatsapp_templates enable row level security;

create policy "whatsapp_templates_select_admins" on public.whatsapp_templates
  for select to authenticated
  using ((select public.current_app_role()) = 'admin');

revoke all on public.whatsapp_templates from anon, authenticated;
grant select on public.whatsapp_templates to authenticated;

-- Messages ----------------------------------------------------------------------

create table public.whatsapp_messages (
  id                 uuid primary key default gen_random_uuid(),
  -- confirmation: sent when the visit is booked · reminder: the day before.
  kind               text not null constraint whatsapp_messages_kind check (kind in ('confirmation', 'reminder')),
  appointment_id     uuid not null references public.appointments (id) on delete cascade,
  patient_id         uuid not null references public.patients (id) on delete cascade,
  -- The visit time the message announces. A visit moved later gets a new
  -- reminder, and an answer to the old time does not change the visit.
  starts_at          timestamptz not null,
  to_phone           text not null constraint whatsapp_messages_phone check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- pending → sending → sent → delivered → read, or failed. skipped: not sent
  -- on purpose (switched off, consent withdrawn, template not approved).
  status             text not null default 'pending'
                     constraint whatsapp_messages_status
                     check (status in ('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  template_name      text constraint whatsapp_messages_template_length check (char_length(template_name) <= 512),
  template_language  text constraint whatsapp_messages_language_length check (char_length(template_language) <= 10),
  -- WhatsApp's message id (wamid), as Zernio returns it, and Zernio's conversation.
  wamid              text constraint whatsapp_messages_wamid_length check (char_length(wamid) <= 200),
  conversation_id    text constraint whatsapp_messages_conversation_length check (char_length(conversation_id) <= 100),
  error_code         text constraint whatsapp_messages_error_code_length check (char_length(error_code) <= 40),
  error              text constraint whatsapp_messages_error_length check (char_length(error) <= 500),
  -- The patient's button answer and what it did to the visit.
  reply              text constraint whatsapp_messages_reply check (reply in ('confirm', 'reschedule', 'cancel')),
  reply_effect       text constraint whatsapp_messages_reply_effect
                     check (reply_effect in ('confirmed', 'cancelled', 'reschedule', 'unchanged', 'outdated', 'already')),
  replied_at         timestamptz,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz,
  delivered_at       timestamptz,
  read_at            timestamptz,
  failed_at          timestamptz
);

comment on table public.whatsapp_messages is
  'One row per WhatsApp message to a patient. No message text is stored.';

-- One confirmation and one reminder per visit and time.
create unique index whatsapp_messages_once on public.whatsapp_messages (appointment_id, kind, starts_at);
create unique index whatsapp_messages_wamid_key on public.whatsapp_messages (wamid) where wamid is not null;
create index whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id, created_at desc)
  where conversation_id is not null;
create index whatsapp_messages_phone_idx on public.whatsapp_messages (to_phone, created_at desc);
create index whatsapp_messages_patient_idx on public.whatsapp_messages (patient_id);
create index whatsapp_messages_created_idx on public.whatsapp_messages (created_at desc);
create index whatsapp_messages_pending_idx on public.whatsapp_messages (created_at) where status = 'pending';

alter table public.whatsapp_messages enable row level security;

-- Members see the messages of the visits they see.
create policy "whatsapp_messages_select" on public.whatsapp_messages
  for select to authenticated
  using ((select public.sees_all_schedule()) or public.is_my_appointment(appointment_id));

revoke all on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to authenticated;

-- Webhook events already handled. Zernio may deliver an event more than once.
create table public.whatsapp_webhook_events (
  id           text primary key constraint whatsapp_webhook_events_id_length check (char_length(id) between 1 and 200),
  event        text not null constraint whatsapp_webhook_events_event_length check (char_length(event) <= 100),
  received_at  timestamptz not null default now()
);

create index whatsapp_webhook_events_received_idx on public.whatsapp_webhook_events (received_at);

alter table public.whatsapp_webhook_events enable row level security;
revoke all on public.whatsapp_webhook_events from anon, authenticated;

-- Queueing ------------------------------------------------------------------------

-- Queues the booking confirmation of a visit, when the number is connected,
-- confirmations are on, the visit is upcoming and the patient accepts
-- WhatsApp on a mobile number. Answers the new message's id, or null.
create or replace function public.whatsapp_queue_confirmation(appointment uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  queued uuid;
begin
  insert into public.whatsapp_messages (kind, appointment_id, patient_id, starts_at, to_phone)
  select 'confirmation', a.id, a.patient_id, a.starts_at, p.phone_e164
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  cross join public.whatsapp_settings s
  where a.id = appointment
    and s.connected
    and s.send_confirmations
    and a.status in ('scheduled', 'confirmed')
    and a.starts_at > now()
    and p.whatsapp_consent
    and public.whatsapp_reachable(p.phone_e164)
  on conflict (appointment_id, kind, starts_at) do nothing
  returning id into queued;
  return queued;
end;
$$;

-- After an online booking: records the patient's answer to "receive it by
-- WhatsApp" and queues the confirmation of the visit just booked. The
-- booking page knows the document, day and time, not the visit's id.
create or replace function public.whatsapp_queue_online_booking(
  document_type text,
  document_number text,
  local_day date,
  local_time time,
  opt_in boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  patient uuid;
  visit uuid;
begin
  select p.id into patient
  from public.patients p
  where p.id_type = document_type and p.id_number = document_number;
  if patient is null or opt_in is null then
    return null;
  end if;

  update public.patients
  set whatsapp_consent = opt_in
  where id = patient and whatsapp_consent is distinct from opt_in;

  if not opt_in then
    return null;
  end if;

  select a.id into visit
  from public.appointments a
  where a.patient_id = patient
    and a.source = 'online'
    and a.starts_at = (local_day + local_time) at time zone 'America/Caracas'
    and a.created_at > now() - interval '15 minutes'
  order by a.created_at desc
  limit 1;
  if visit is null then
    return null;
  end if;

  return public.whatsapp_queue_confirmation(visit);
end;
$$;

-- Queues the reminders of a day's visits (the reminder job runs the day
-- before). Skips a visit booked in the last 12 hours, whose confirmation just
-- went out. Answers the new messages' ids.
create or replace function public.whatsapp_queue_reminders(for_day date)
returns setof uuid
language sql
set search_path = ''
as $$
  insert into public.whatsapp_messages (kind, appointment_id, patient_id, starts_at, to_phone)
  select 'reminder', a.id, a.patient_id, a.starts_at, p.phone_e164
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  cross join public.whatsapp_settings s
  where a.starts_on = for_day
    and s.connected
    and s.send_reminders
    and a.status in ('scheduled', 'confirmed')
    and a.starts_at > now()
    and p.whatsapp_consent
    and public.whatsapp_reachable(p.phone_e164)
    and not exists (
      select 1
      from public.whatsapp_messages c
      where c.appointment_id = a.id
        and c.kind = 'confirmation'
        and c.starts_at = a.starts_at
        and c.status in ('sending', 'sent', 'delivered', 'read')
        and c.created_at > now() - interval '12 hours'
    )
  on conflict (appointment_id, kind, starts_at) do nothing
  returning id;
$$;

-- What the sender needs to write each message: the visit as it is now, the
-- patient's first name and consent, and the professional and area of the
-- visit's first service.
create or replace function public.whatsapp_outbox(messages uuid[])
returns table (
  id uuid,
  kind text,
  status text,
  to_phone text,
  starts_at timestamptz,
  visit_status public.appointment_status,
  visit_starts_at timestamptz,
  first_name text,
  consent boolean,
  professional text,
  area public.service_area
)
language sql
stable
set search_path = ''
as $$
  select
    m.id,
    m.kind,
    m.status,
    m.to_phone,
    m.starts_at,
    a.status,
    a.starts_at,
    p.first_name,
    p.whatsapp_consent,
    (
      select nullif(btrim(pr.full_name), '')
      from public.appointment_items i
      join public.profiles pr on pr.id = i.professional_id
      where i.appointment_id = a.id
      order by i.created_at, i.id
      limit 1
    ),
    (
      select s.area
      from public.appointment_items i
      join public.services s on s.id = i.service_id
      where i.appointment_id = a.id
      order by i.created_at, i.id
      limit 1
    )
  from public.whatsapp_messages m
  join public.appointments a on a.id = m.appointment_id
  join public.patients p on p.id = m.patient_id
  where m.id = any (messages);
$$;

-- Delivery status and replies -------------------------------------------------------

-- Records a delivery status from the webhook for the message with this wamid.
-- Statuses only move forward (an older "delivered" arriving after "read" is
-- ignored); "failed" always lands. Answers the message's id, or null.
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
  return target;
end;
$$;

-- The message a button tap answers. With the id of the message it quotes,
-- that one. Otherwise the latest confirmation or reminder sent to this
-- conversation or phone, but only when all of them are about the same
-- upcoming visit: with two visits pending, a bare "Confirmar" could be about
-- either, so nothing is changed and the front desk answers instead.
-- Answers { message, candidates }: the visits the answer could be about.
create or replace function public.whatsapp_reply_target(conversation text, phone text, quoted text default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  target uuid;
  visits integer;
begin
  if coalesce(quoted, '') <> '' then
    select m.id into target from public.whatsapp_messages m where m.wamid = quoted;
    if target is not null then
      return jsonb_build_object('message', target, 'candidates', 1);
    end if;
  end if;

  with recent as (
    select m.id, m.appointment_id, coalesce(m.sent_at, m.created_at) as sent_on
    from public.whatsapp_messages m
    join public.appointments a on a.id = m.appointment_id
    where m.kind in ('confirmation', 'reminder')
      and m.status in ('sent', 'delivered', 'read')
      and m.starts_at = a.starts_at
      and a.starts_at > now() - interval '12 hours'
      and a.status in ('scheduled', 'confirmed')
      and (
        (coalesce(conversation, '') <> '' and m.conversation_id = conversation)
        or (coalesce(phone, '') <> '' and m.to_phone = phone)
      )
  )
  select count(distinct r.appointment_id), (select r2.id from recent r2 order by r2.sent_on desc limit 1)
  into visits, target
  from recent r;

  if visits = 1 then
    return jsonb_build_object('message', target, 'candidates', 1);
  end if;
  return jsonb_build_object('message', null, 'candidates', visits);
end;
$$;

-- Applies a patient's button answer to the visit the message is about:
--   confirm     a scheduled visit becomes confirmed
--   cancel      an upcoming scheduled or confirmed visit is cancelled
--   reschedule  nothing changes; the front desk follows up in the chat
-- An answer to a time the visit no longer has changes nothing (outdated).
-- A patient may change their answer (confirm, then cancel). Also keeps the
-- patient's WhatsApp user id. Answers { effect, reply, appointment, status, starts_at }.
create or replace function public.whatsapp_apply_reply(message_id uuid, answer text, user_id text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  m public.whatsapp_messages%rowtype;
  visit public.appointments%rowtype;
  effect text;
begin
  if answer is null or answer not in ('confirm', 'reschedule', 'cancel') then
    raise exception 'whatsapp_apply_reply: invalid answer %', answer using errcode = '22023';
  end if;

  select * into m from public.whatsapp_messages where id = message_id for update;
  if not found then
    return jsonb_build_object('effect', 'missing');
  end if;
  select * into visit from public.appointments where id = m.appointment_id for update;

  if m.reply = answer then
    effect := 'already';
  elsif visit.starts_at <> m.starts_at then
    effect := 'outdated';
  elsif answer = 'confirm' then
    if visit.status = 'scheduled' then
      update public.appointments set status = 'confirmed' where id = visit.id;
      effect := 'confirmed';
    elsif visit.status = 'confirmed' then
      effect := 'confirmed';
    else
      effect := 'unchanged';
    end if;
  elsif answer = 'cancel' then
    if visit.status in ('scheduled', 'confirmed') and visit.starts_at > now() then
      update public.appointments set status = 'cancelled' where id = visit.id;
      effect := 'cancelled';
    else
      effect := 'unchanged';
    end if;
  else
    effect := case when visit.status in ('scheduled', 'confirmed') then 'reschedule' else 'unchanged' end;
  end if;

  if effect <> 'already' then
    update public.whatsapp_messages
    set reply = answer, reply_effect = effect, replied_at = now()
    where id = m.id;
  end if;

  if coalesce(user_id, '') <> '' then
    update public.patients
    set whatsapp_user_id = left(user_id, 200)
    where id = m.patient_id and whatsapp_user_id is distinct from left(user_id, 200);
  end if;

  return jsonb_build_object(
    'effect', effect,
    'reply', answer,
    'appointment', visit.id,
    'status', (select a.status from public.appointments a where a.id = visit.id),
    'starts_at', visit.starts_at
  );
end;
$$;

-- Service role only ------------------------------------------------------------------

revoke execute on function public.whatsapp_queue_confirmation(uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_queue_online_booking(text, text, date, time, boolean) from public, anon, authenticated;
revoke execute on function public.whatsapp_queue_reminders(date) from public, anon, authenticated;
revoke execute on function public.whatsapp_outbox(uuid[]) from public, anon, authenticated;
revoke execute on function public.whatsapp_record_status(text, text, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_reply_target(text, text, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_apply_reply(uuid, text, text) from public, anon, authenticated;

grant execute on function public.whatsapp_queue_confirmation(uuid) to service_role;
grant execute on function public.whatsapp_queue_online_booking(text, text, date, time, boolean) to service_role;
grant execute on function public.whatsapp_queue_reminders(date) to service_role;
grant execute on function public.whatsapp_outbox(uuid[]) to service_role;
grant execute on function public.whatsapp_record_status(text, text, timestamptz, text, text) to service_role;
grant execute on function public.whatsapp_reply_target(text, text, text) to service_role;
grant execute on function public.whatsapp_apply_reply(uuid, text, text) to service_role;
