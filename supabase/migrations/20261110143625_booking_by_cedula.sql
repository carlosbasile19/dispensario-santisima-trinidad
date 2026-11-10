-- Online booking recognises patients by their identity document (cédula V
-- or E, or a passport) instead of their phone. A document belongs to one
-- person, so a booking always lands on the right record, even when a family
-- shares a phone. A patient the centre does not know yet gives name, last
-- name, email and mobile, and is registered with that document.
--
-- As before, an unverified visitor can only add a visit to a record: online
-- booking never shows or changes a patient's data.

drop function if exists public.book_online(uuid, uuid, date, time, text, text, text, text, text, text);
-- Only the phone matching used it.
drop function if exists public.name_key(text);

-- Books a visit on a calendar for the patient with this document. For the
-- booking page only (service role): the Next.js server passes a hash of the
-- client's IP address for the rate limits. It answers a status, never
-- anything about the patient:
--   booked            the visit is booked (its day, time, length and service)
--   needs_details     no patient has this document: send first name, last
--                     name, email and mobile to register them
--   slot_taken        the slot is no longer free
--   too_many          the patient already has 3 upcoming visits booked online
--   rate_limited      too many attempts from this client, or too many
--                     bookings on this calendar in the last hour
--   closed            the calendar does not take bookings, or does not offer the service
--   invalid_document  not a cédula (5 to 10 digits) or a passport (4 to 15 letters and digits)
--   invalid, invalid_phone, invalid_email   a value is missing or malformed
create or replace function public.book_online(
  calendar uuid,
  service uuid,
  local_day date,
  local_time time,
  document_type text,
  document_number text,
  first_name text default null,
  last_name text default null,
  email text default null,
  phone text default null,
  notes text default null,
  client text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  doc_type constant text := upper(btrim(coalesce(document_type, '')));
  -- "V-12.345.678" keeps its digits; a passport keeps letters too.
  doc_number constant text := case
    when upper(btrim(coalesce(document_type, ''))) = 'P'
      then regexp_replace(upper(coalesce(document_number, '')), '[^0-9A-Z]', '', 'g')
    else regexp_replace(coalesce(document_number, ''), '[^0-9]', '', 'g')
  end;
  mobile constant text := public.normalize_phone(phone);
  given_first constant text := nullif(regexp_replace(btrim(coalesce(first_name, '')), '\s+', ' ', 'g'), '');
  given_last constant text := nullif(regexp_replace(btrim(coalesce(last_name, '')), '\s+', ' ', 'g'), '');
  given_email constant text := nullif(lower(btrim(coalesce(email, ''))), '');
  given_notes constant text := nullif(btrim(left(coalesce(notes, ''), 1000)), '');
  cal record;
  minutes integer;
  service_name text;
  patient uuid;
  registered boolean := false;
  visit uuid;
begin
  delete from public.booking_attempts where created_at < now() - interval '2 days';

  if calendar is null or service is null or local_day is null or local_time is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select c.id, c.professional_id, c.accepting,
         coalesce(nullif(btrim(p.full_name), ''), 'Médico del centro') as professional_name
    into cal
  from public.calendars c
  join public.profiles p on p.id = c.professional_id and p.role in ('doctor', 'director')
  where c.id = calendar;
  if not found or not cal.accepting then
    return jsonb_build_object('status', 'closed');
  end if;

  select cs.duration_minutes, s.name into minutes, service_name
  from public.calendar_services cs
  join public.services s on s.id = cs.service_id and s.active
  where cs.calendar_id = cal.id and cs.service_id = service;
  if not found then
    return jsonb_build_object('status', 'closed');
  end if;

  -- One booking at a time per calendar: the checks below and the insert do
  -- not interleave with another patient's.
  perform pg_advisory_xact_lock(hashtextextended('book_online:' || cal.id::text, 0));

  if client is not null and (
       (select count(*) from public.booking_attempts a
        where a.client_hash = client and a.created_at > now() - interval '15 minutes') >= 12
    or (select count(*) from public.booking_attempts a
        where a.client_hash = client and a.created_at > now() - interval '1 day') >= 40
  ) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.booking_attempts (calendar_id, client_hash) values (cal.id, client);

  if (
    select count(*) from public.appointments a
    where a.source = 'online' and a.created_at > now() - interval '1 hour'
      and exists (
        select 1 from public.appointment_items i
        where i.appointment_id = a.id and i.professional_id = cal.professional_id
      )
  ) >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- The same document rules as the patients form: a cédula V or E has 5 to
  -- 10 digits, a passport 4 to 15 letters and digits.
  if doc_type not in ('V', 'E', 'P')
     or (doc_type = 'P' and doc_number !~ '^[0-9A-Z]{4,15}$')
     or (doc_type <> 'P' and doc_number !~ '^[0-9]{5,10}$') then
    return jsonb_build_object('status', 'invalid_document');
  end if;

  if not exists (
    select 1 from public.calendar_free_slots(cal.id, service, local_day, local_day) as f
    where f.starts = local_time
  ) then
    return jsonb_build_object('status', 'slot_taken');
  end if;

  -- A document belongs to at most one patient (patients_document_key).
  select p.id into patient from public.patients p where p.id_type = doc_type and p.id_number = doc_number;

  if patient is null then
    if given_first is null or given_last is null or given_email is null or mobile is null then
      return jsonb_build_object('status', 'needs_details');
    end if;
    if given_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(given_email) > 120 then
      return jsonb_build_object('status', 'invalid_email');
    end if;
    -- A Venezuelan mobile (04xx) or a number from abroad.
    if mobile like '+58%' and mobile not like '+584%' then
      return jsonb_build_object('status', 'invalid_phone');
    end if;
    if char_length(given_first) > 80 or char_length(given_last) > 80 then
      return jsonb_build_object('status', 'invalid');
    end if;

    insert into public.patients (first_name, last_name, id_type, id_number, phone, email, source)
    values (
      given_first,
      given_last,
      doc_type,
      doc_number,
      case when mobile like '+58%' then '0' || substr(mobile, 4, 3) || '-' || substr(mobile, 7) else mobile end,
      given_email,
      'online'
    )
    on conflict (id_type, id_number) where id_number is not null do nothing
    returning id into patient;
    if patient is null then
      -- Registered a moment ago by someone else: use that record.
      select p.id into patient from public.patients p where p.id_type = doc_type and p.id_number = doc_number;
    else
      registered := true;
    end if;
  end if;

  if (
    select count(*) from public.appointments a
    where a.patient_id = patient and a.source = 'online'
      and a.status in ('scheduled', 'confirmed') and a.starts_at > now()
  ) >= 3 then
    return jsonb_build_object('status', 'too_many');
  end if;

  insert into public.appointments (patient_id, starts_at, duration_minutes, source, patient_notes)
  values (patient, (local_day + local_time) at time zone 'America/Caracas', minutes, 'online', given_notes)
  returning id into visit;

  -- The centre's price and the professional's role are set and checked by
  -- the appointment_items_prepare trigger.
  insert into public.appointment_items (appointment_id, service_id, professional_id)
  values (visit, service, cal.professional_id);

  return jsonb_build_object(
    'status', 'booked',
    'day', local_day,
    'time', to_char(local_time, 'HH24:MI'),
    'minutes', minutes,
    'service', service_name,
    'professional', cal.professional_name,
    'registered', registered
  );
end;
$$;

revoke execute on function public.book_online(uuid, uuid, date, time, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_online(uuid, uuid, date, time, text, text, text, text, text, text, text, text)
  to service_role;
