-- Booking calendars: one per professional (a doctor or the medical director).
-- Each has the services patients can book on it, the weekly hours, special
-- days (a day off, or other hours on a date) and a public link,
-- /agendar/<slug>, that the centre sends to patients.
--
-- · Slots. Each service of a calendar has slots of 30 minutes or 1 hour,
--   which follow each other from the start of each window of the day: in a
--   07:30–12:00 window a 1-hour service is offered at 07:30, 08:30, 09:30 and
--   10:30, a 30-minute one every half hour.
-- · A slot is free when it fits in that day's hours, is past the minimum
--   notice and within the booking horizon, and does not overlap a visit (any
--   status but cancelled or no-show) where the professional has a service,
--   whoever booked it.
-- · Patients book without an account and only through the Next.js server,
--   which calls the booking functions with the service role. They are
--   recognised by their mobile number (patients.phone_e164). An unverified
--   number can only add a visit to its patient: online booking never shows or
--   changes a patient's data.
-- · Members: everyone sees the calendars (a doctor only their own);
--   administrators create and edit them.

-- Permission helpers -----------------------------------------------------------

-- Create calendars and edit their hours, services and settings.
create or replace function public.can_manage_calendars()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) = 'admin', false);
$$;

revoke execute on function public.can_manage_calendars() from public, anon;
grant execute on function public.can_manage_calendars() to authenticated;

-- Phone numbers ------------------------------------------------------------------

-- A phone number as + country code + number, or null when it is not one.
-- Venezuelan numbers are written many ways (0412-1234567, 0414 123 45 67,
-- +58 424 1234567, 412.123.4567): all of them become +58 and ten digits.
-- Numbers from other countries must be written with + and their country code.
create or replace function public.normalize_phone(raw text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when n.digits ~ '^0[24][0-9]{9}$' then '+58' || substr(n.digits, 2)
    when n.digits ~ '^58[24][0-9]{9}$' then '+' || n.digits
    when n.digits ~ '^0058[24][0-9]{9}$' then '+' || substr(n.digits, 3)
    when n.digits ~ '^[24][0-9]{9}$' and not n.plus then '+58' || n.digits
    when n.plus and char_length(n.digits) between 8 and 15 then '+' || n.digits
  end
  from (
    select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as digits,
           left(btrim(coalesce(raw, '')), 1) = '+' as plus
  ) as n;
$$;

revoke execute on function public.normalize_phone(text) from public, anon;
grant execute on function public.normalize_phone(text) to authenticated;

alter table public.patients
  add column phone_e164 text generated always as (public.normalize_phone(phone)) stored,
  add column source text not null default 'desk' constraint patients_source_check check (source in ('desk', 'online'));

comment on column public.patients.phone_e164 is
  'The phone in international form (+58…), derived from phone. Online booking finds patients by it.';
comment on column public.patients.source is
  'desk: registered by the front desk. online: registered by the patient while booking online.';

create index patients_phone_e164_idx on public.patients (phone_e164) where phone_e164 is not null;

-- Visits booked online ---------------------------------------------------------------

alter table public.appointments
  add column source text not null default 'desk' constraint appointments_source_check check (source in ('desk', 'online')),
  add column patient_notes text constraint appointments_patient_notes_length check (char_length(patient_notes) <= 1000);

comment on column public.appointments.source is
  'desk: booked by the front desk. online: booked by the patient on a booking calendar.';
comment on column public.appointments.patient_notes is
  'What the patient wrote when booking online. The team''s own note is notes.';

create index appointments_online_idx on public.appointments (patient_id, starts_at) where source = 'online';

-- Calendars ----------------------------------------------------------------------------

create table public.calendars (
  id                uuid primary key default gen_random_uuid(),
  professional_id   uuid not null unique references public.profiles (id) on delete cascade,
  -- The public link: /agendar/<slug>.
  slug              text not null unique constraint calendars_slug_format
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  -- Shown to patients under the professional's name ("Medicina general").
  specialty         text constraint calendars_specialty_length check (char_length(specialty) <= 80),
  -- A few words for patients on the booking page.
  intro             text constraint calendars_intro_length check (char_length(intro) <= 400),
  -- Takes bookings online. A paused calendar's page asks patients to write instead.
  accepting         boolean not null default true,
  -- How close to a slot it can still be booked online, and how far ahead.
  min_notice_hours  smallint not null default 2 constraint calendars_min_notice_range check (min_notice_hours between 0 and 72),
  horizon_days      smallint not null default 30 constraint calendars_horizon_range check (horizon_days between 7 and 120),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger calendars_touch_updated_at
  before update on public.calendars
  for each row execute function public.touch_updated_at();

-- A calendar belongs to a doctor or the medical director. Security definer,
-- like appointment_items_prepare, so the check does not depend on who can
-- read other members' profiles.
create or replace function public.calendars_check_professional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.professional_id and role in ('doctor', 'director')) then
    raise exception 'A calendar belongs to a doctor or the medical director'
      using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  return new;
end;
$$;

revoke execute on function public.calendars_check_professional() from public, anon, authenticated;

create trigger calendars_check_professional
  before insert on public.calendars
  for each row execute function public.calendars_check_professional();

-- The services patients can book on a calendar, each with its slot length.
create table public.calendar_services (
  calendar_id       uuid not null references public.calendars (id) on delete cascade,
  service_id        uuid not null references public.services (id) on delete cascade,
  duration_minutes  smallint not null default 30 constraint calendar_services_duration check (duration_minutes in (30, 60)),
  -- Order on the booking page.
  position          smallint not null default 0,
  primary key (calendar_id, service_id)
);

create index calendar_services_service_idx on public.calendar_services (service_id);

-- Weekly hours: one or more ranges per weekday, on half hours.
create table public.calendar_hours (
  calendar_id  uuid not null references public.calendars (id) on delete cascade,
  -- 0 Sunday … 6 Saturday, as extract(dow) counts them.
  weekday      smallint not null constraint calendar_hours_weekday check (weekday between 0 and 6),
  starts       time not null,
  ends         time not null,
  primary key (calendar_id, weekday, starts),
  constraint calendar_hours_order check (starts < ends),
  constraint calendar_hours_half_hours check (
    date_part('second', starts) = 0 and date_part('second', ends) = 0
    and date_part('minute', starts) in (0, 30) and date_part('minute', ends) in (0, 30)
  )
);

-- Special days. On a date that has them, the weekly hours do not apply: a
-- row without times means the professional does not see patients that day;
-- rows with times are that day's hours.
create table public.calendar_overrides (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references public.calendars (id) on delete cascade,
  day          date not null,
  starts       time,
  ends         time,
  -- Why, for the team ("Vacaciones", "Jornada médica"). Not shown to patients.
  note         text constraint calendar_overrides_note_length check (char_length(note) <= 120),
  created_at   timestamptz not null default now(),
  constraint calendar_overrides_range check ((starts is null) = (ends is null) and (starts is null or starts < ends)),
  constraint calendar_overrides_half_hours check (
    starts is null or (
      date_part('second', starts) = 0 and date_part('second', ends) = 0
      and date_part('minute', starts) in (0, 30) and date_part('minute', ends) in (0, 30)
    )
  )
);

create index calendar_overrides_day_idx on public.calendar_overrides (calendar_id, day);

-- Whether the signed-in member may see a calendar. Security definer so the
-- policies of the calendar's rows do not depend on the calendars policy.
create or replace function public.can_see_calendar(calendar uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.sees_all_schedule())
      or exists (select 1 from public.calendars c where c.id = calendar and c.professional_id = (select auth.uid()));
$$;

revoke execute on function public.can_see_calendar(uuid) from public, anon;
grant execute on function public.can_see_calendar(uuid) to authenticated;

-- The professional of each calendar the signed-in member may see: name,
-- photo and role. Security definer because the front desk and the director
-- cannot read other members' profiles (like clinic_professionals).
create or replace function public.calendar_professionals()
returns table (calendar_id uuid, professional_id uuid, full_name text, avatar_url text, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.id, coalesce(nullif(btrim(p.full_name), ''), p.email, 'Sin nombre'), p.avatar_url, p.role
  from public.calendars c
  join public.profiles p on p.id = c.professional_id
  where (select public.sees_all_schedule()) or c.professional_id = (select auth.uid());
$$;

revoke execute on function public.calendar_professionals() from public, anon;
grant execute on function public.calendar_professionals() to authenticated;

alter table public.calendars enable row level security;
alter table public.calendar_services enable row level security;
alter table public.calendar_hours enable row level security;
alter table public.calendar_overrides enable row level security;

create policy "calendars_select" on public.calendars
  for select to authenticated
  using ((select public.sees_all_schedule()) or professional_id = (select auth.uid()));

create policy "calendars_insert_admins" on public.calendars
  for insert to authenticated
  with check ((select public.can_manage_calendars()));

create policy "calendars_update_admins" on public.calendars
  for update to authenticated
  using ((select public.can_manage_calendars()))
  with check ((select public.can_manage_calendars()));

create policy "calendars_delete_admins" on public.calendars
  for delete to authenticated
  using ((select public.can_manage_calendars()));

create policy "calendar_services_select" on public.calendar_services
  for select to authenticated
  using (public.can_see_calendar(calendar_id));

create policy "calendar_services_insert_admins" on public.calendar_services
  for insert to authenticated
  with check ((select public.can_manage_calendars()));

create policy "calendar_services_update_admins" on public.calendar_services
  for update to authenticated
  using ((select public.can_manage_calendars()))
  with check ((select public.can_manage_calendars()));

create policy "calendar_services_delete_admins" on public.calendar_services
  for delete to authenticated
  using ((select public.can_manage_calendars()));

create policy "calendar_hours_select" on public.calendar_hours
  for select to authenticated
  using (public.can_see_calendar(calendar_id));

create policy "calendar_hours_insert_admins" on public.calendar_hours
  for insert to authenticated
  with check ((select public.can_manage_calendars()));

create policy "calendar_hours_delete_admins" on public.calendar_hours
  for delete to authenticated
  using ((select public.can_manage_calendars()));

create policy "calendar_overrides_select" on public.calendar_overrides
  for select to authenticated
  using (public.can_see_calendar(calendar_id));

create policy "calendar_overrides_insert_admins" on public.calendar_overrides
  for insert to authenticated
  with check ((select public.can_manage_calendars()));

create policy "calendar_overrides_delete_admins" on public.calendar_overrides
  for delete to authenticated
  using ((select public.can_manage_calendars()));

revoke all on public.calendars, public.calendar_services, public.calendar_hours, public.calendar_overrides
  from anon, authenticated;
grant select on public.calendars, public.calendar_services, public.calendar_hours, public.calendar_overrides
  to authenticated;
grant insert (professional_id, slug, specialty, intro, accepting, min_notice_hours, horizon_days)
  on public.calendars to authenticated;
grant update (slug, specialty, intro, accepting, min_notice_hours, horizon_days) on public.calendars to authenticated;
grant delete on public.calendars to authenticated;
-- Hours, services and special days are replaced through the functions below.
grant insert, delete on public.calendar_services, public.calendar_hours, public.calendar_overrides to authenticated;
grant update (duration_minutes, position) on public.calendar_services to authenticated;

-- Editing a calendar (administrators; the functions run with the caller's
-- rights, so RLS applies) --------------------------------------------------------

-- Ranges [{starts, ends}] in "HH:MM", as rows. Raises on ranges that overlap
-- within the same group (a weekday, or a special day).
create or replace function public.calendar_check_ranges(ranges jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1
    from (
      select (r ->> 'starts')::time as starts,
             lag((r ->> 'ends')::time) over (partition by coalesce(r ->> 'weekday', '') order by (r ->> 'starts')::time) as previous_end
      from jsonb_array_elements(ranges) as r
    ) as x
    where x.previous_end > x.starts
  ) then
    raise exception 'Ranges of the same day overlap' using errcode = '22023', hint = 'overlapping_hours';
  end if;
end;
$$;

revoke execute on function public.calendar_check_ranges(jsonb) from public, anon;
grant execute on function public.calendar_check_ranges(jsonb) to authenticated;

-- Replaces a calendar's weekly hours: hours is [{weekday, starts, ends}].
create or replace function public.save_calendar_hours(calendar uuid, hours jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.can_manage_calendars()) then
    raise exception 'Only administrators edit calendars' using errcode = '42501';
  end if;
  if jsonb_typeof(hours) is distinct from 'array' or jsonb_array_length(hours) > 70 then
    raise exception 'hours must be a list of ranges' using errcode = '22023', hint = 'invalid_hours';
  end if;
  perform public.calendar_check_ranges(hours);

  delete from public.calendar_hours where calendar_id = calendar;
  insert into public.calendar_hours (calendar_id, weekday, starts, ends)
  select calendar, (r ->> 'weekday')::smallint, (r ->> 'starts')::time, (r ->> 'ends')::time
  from jsonb_array_elements(hours) as r;
end;
$$;

-- Replaces the services of a calendar, in order: offered is [{service_id, minutes}].
create or replace function public.save_calendar_services(calendar uuid, offered jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.can_manage_calendars()) then
    raise exception 'Only administrators edit calendars' using errcode = '42501';
  end if;
  if jsonb_typeof(offered) is distinct from 'array' or jsonb_array_length(offered) > 60 then
    raise exception 'offered must be a list of services' using errcode = '22023', hint = 'invalid_services';
  end if;

  delete from public.calendar_services where calendar_id = calendar;
  insert into public.calendar_services (calendar_id, service_id, duration_minutes, position)
  select calendar, (e.value ->> 'service_id')::uuid, coalesce((e.value ->> 'minutes')::smallint, 30), e.ordinality - 1
  from jsonb_array_elements(offered) with ordinality as e (value, ordinality);
end;
$$;

-- Sets a special day: ranges [{starts, ends}] are that day's hours, an empty
-- list means no patients that day. Replaces what the day had.
create or replace function public.save_calendar_special_day(calendar uuid, special_day date, ranges jsonb, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.can_manage_calendars()) then
    raise exception 'Only administrators edit calendars' using errcode = '42501';
  end if;
  if special_day is null or jsonb_typeof(ranges) is distinct from 'array' or jsonb_array_length(ranges) > 10 then
    raise exception 'A special day needs a date and a list of ranges' using errcode = '22023', hint = 'invalid_hours';
  end if;
  perform public.calendar_check_ranges(ranges);

  delete from public.calendar_overrides where calendar_id = calendar and day = special_day;
  if jsonb_array_length(ranges) = 0 then
    insert into public.calendar_overrides (calendar_id, day, note)
    values (calendar, special_day, nullif(btrim(reason), ''));
  else
    insert into public.calendar_overrides (calendar_id, day, starts, ends, note)
    select calendar, special_day, (r ->> 'starts')::time, (r ->> 'ends')::time, nullif(btrim(reason), '')
    from jsonb_array_elements(ranges) as r;
  end if;
end;
$$;

create or replace function public.delete_calendar_special_day(calendar uuid, special_day date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.can_manage_calendars()) then
    raise exception 'Only administrators edit calendars' using errcode = '42501';
  end if;
  delete from public.calendar_overrides where calendar_id = calendar and day = special_day;
end;
$$;

-- Creates a professional's calendar with its services and, to start from,
-- Monday to Friday 07:30–12:00. The link is made from link_name ("Dr. José
-- Morales" → dr-jose-morales), with -2, -3… when it is taken.
create or replace function public.create_calendar(professional uuid, link_name text, specialty_label text, offered jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix integer := 1;
  new_calendar uuid;
begin
  if not (select public.can_manage_calendars()) then
    raise exception 'Only administrators create calendars' using errcode = '42501';
  end if;

  base := btrim(left(btrim(regexp_replace(lower(extensions.unaccent(coalesce(link_name, ''))), '[^a-z0-9]+', '-', 'g'), '-'), 50), '-');
  if char_length(base) < 3 then
    base := 'medico';
  end if;
  candidate := base;
  while exists (select 1 from public.calendars c where c.slug = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  end loop;

  insert into public.calendars (professional_id, slug, specialty)
  values (professional, candidate, nullif(btrim(specialty_label), ''))
  returning id into new_calendar;

  insert into public.calendar_hours (calendar_id, weekday, starts, ends)
  select new_calendar, d, time '07:30', time '12:00' from generate_series(1, 5) as d;

  perform public.save_calendar_services(new_calendar, coalesce(offered, '[]'::jsonb));
  return new_calendar;
end;
$$;

revoke execute on function public.save_calendar_hours(uuid, jsonb) from public, anon;
revoke execute on function public.save_calendar_services(uuid, jsonb) from public, anon;
revoke execute on function public.save_calendar_special_day(uuid, date, jsonb, text) from public, anon;
revoke execute on function public.delete_calendar_special_day(uuid, date) from public, anon;
revoke execute on function public.create_calendar(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_calendar_hours(uuid, jsonb) to authenticated;
grant execute on function public.save_calendar_services(uuid, jsonb) to authenticated;
grant execute on function public.save_calendar_special_day(uuid, date, jsonb, text) to authenticated;
grant execute on function public.delete_calendar_special_day(uuid, date) to authenticated;
grant execute on function public.create_calendar(uuid, text, text, jsonb) to authenticated;

-- Availability ---------------------------------------------------------------------

-- The hours a calendar is open on each day from from_day to to_day (at most
-- 400 days): a date's special hours when it has special days, otherwise the
-- weekly hours of its weekday. A special day without hours has none.
create or replace function public.calendar_windows(calendar uuid, from_day date, to_day date)
returns table (day date, starts time, ends time, special boolean)
language sql
stable
set search_path = ''
as $$
  with days as (
    select d::date as day
    from generate_series(from_day::timestamp, least(to_day, from_day + 400)::timestamp, interval '1 day') as d
  )
  select days.day, o.starts, o.ends, true
  from days
  join public.calendar_overrides o on o.calendar_id = calendar_windows.calendar and o.day = days.day
  where o.starts is not null
  union all
  select days.day, h.starts, h.ends, false
  from days
  join public.calendar_hours h on h.calendar_id = calendar_windows.calendar and h.weekday = extract(dow from days.day)
  where not exists (
    select 1 from public.calendar_overrides o
    where o.calendar_id = calendar_windows.calendar and o.day = days.day
  )
  order by 1, 2;
$$;

-- The free start times of a service on a calendar from from_day to to_day,
-- as clinic dates and times, past the calendar's minimum notice and within
-- its horizon. Slots last as long as the service and follow each other from
-- the start of each window.
create or replace function public.calendar_free_slots(calendar uuid, service uuid, from_day date, to_day date)
returns table (day date, starts time)
language sql
stable
set search_path = ''
as $$
  with cal as (
    select c.professional_id,
           greatest(from_day, public.clinic_today()) as first_day,
           least(to_day, public.clinic_today() + c.horizon_days) as last_day,
           now() + make_interval(hours => c.min_notice_hours) as earliest
    from public.calendars c
    where c.id = calendar_free_slots.calendar
  ),
  offer as (
    select cs.duration_minutes::integer as minutes
    from public.calendar_services cs
    join public.services s on s.id = cs.service_id and s.active
    where cs.calendar_id = calendar_free_slots.calendar and cs.service_id = calendar_free_slots.service
  ),
  candidates as (
    select w.day,
           (w.day + w.starts + make_interval(mins => n * offer.minutes)) at time zone 'America/Caracas' as slot_start,
           offer.minutes
    from cal, offer,
         public.calendar_windows(calendar_free_slots.calendar, cal.first_day, cal.last_day) as w,
         generate_series(0, (extract(epoch from w.ends - w.starts)::integer / 60) / offer.minutes - 1) as n
  ),
  busy as (
    select tstzrange(a.starts_at, a.starts_at + make_interval(mins => a.duration_minutes)) as span
    from public.appointments a, cal
    where a.starts_on between cal.first_day - 1 and cal.last_day + 1
      and a.status not in ('cancelled', 'no_show')
      and exists (
        select 1 from public.appointment_items i
        where i.appointment_id = a.id and i.professional_id = cal.professional_id
      )
  )
  select c.day, (c.slot_start at time zone 'America/Caracas')::time
  from candidates c, cal
  where c.slot_start >= cal.earliest
    and not exists (
      select 1 from busy b
      where b.span && tstzrange(c.slot_start, c.slot_start + make_interval(mins => c.minutes))
    )
  order by 1, 2;
$$;

revoke execute on function public.calendar_windows(uuid, date, date) from public, anon;
revoke execute on function public.calendar_free_slots(uuid, uuid, date, date) from public, anon;
grant execute on function public.calendar_windows(uuid, date, date) to authenticated;
grant execute on function public.calendar_free_slots(uuid, uuid, date, date) to authenticated;

-- Public booking pages (service role only: the Next.js server) ------------------------

-- Booking attempts, for the rate limits of book_online. Kept two days.
create table public.booking_attempts (
  id           bigint generated always as identity primary key,
  calendar_id  uuid references public.calendars (id) on delete cascade,
  -- A hash of the client's IP address, never the address itself.
  client_hash  text,
  created_at   timestamptz not null default now()
);

create index booking_attempts_client_idx on public.booking_attempts (client_hash, created_at);
create index booking_attempts_created_idx on public.booking_attempts (created_at);
create index booking_attempts_calendar_idx on public.booking_attempts (calendar_id);

alter table public.booking_attempts enable row level security;
revoke all on public.booking_attempts from anon, authenticated;

-- What a calendar's public page shows: the professional's name and photo,
-- the calendar's specialty and intro, its services with their slot length
-- and, while it takes bookings, each service's free slots by day. Only for
-- calendars of a doctor or the medical director. Never contact details, and
-- nothing about patients.
create or replace function public.booking_calendar(calendar_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'name', coalesce(nullif(btrim(p.full_name), ''), 'Médico del centro'),
    'avatar_url', p.avatar_url,
    'specialty', c.specialty,
    'intro', c.intro,
    'accepting', c.accepting,
    'today', public.clinic_today(),
    'horizon_days', c.horizon_days,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'area', s.area,
               'minutes', cs.duration_minutes,
               'slots', case when c.accepting then (
                 select coalesce(jsonb_object_agg(f.day, f.times), '{}'::jsonb)
                 from (
                   select fs.day::text as day, jsonb_agg(to_char(fs.starts, 'HH24:MI') order by fs.starts) as times
                   from public.calendar_free_slots(c.id, s.id, public.clinic_today(), public.clinic_today() + c.horizon_days) as fs
                   group by fs.day
                 ) as f
               ) else '{}'::jsonb end
             ) order by cs.position, s.name)
      from public.calendar_services cs
      join public.services s on s.id = cs.service_id and s.active
      where cs.calendar_id = c.id
    ), '[]'::jsonb)
  )
  from public.calendars c
  join public.profiles p on p.id = c.professional_id and p.role in ('doctor', 'director')
  where c.slug = lower(btrim(calendar_slug));
$$;

-- The calendars taking bookings, for /agendar: the medical director first.
create or replace function public.booking_directory()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', c.slug,
           'name', coalesce(nullif(btrim(p.full_name), ''), 'Médico del centro'),
           'avatar_url', p.avatar_url,
           'specialty', c.specialty,
           'services', (
             select jsonb_agg(s.name order by cs.position, s.name)
             from public.calendar_services cs
             join public.services s on s.id = cs.service_id and s.active
             where cs.calendar_id = c.id
           )
         ) order by p.role desc, lower(coalesce(p.full_name, ''))), '[]'::jsonb)
  from public.calendars c
  join public.profiles p on p.id = c.professional_id and p.role in ('doctor', 'director')
  where c.accepting
    and exists (
      select 1 from public.calendar_services cs
      join public.services s on s.id = cs.service_id and s.active
      where cs.calendar_id = c.id
    );
$$;

-- "María José" → "maria": the first word of a name, lower case, without accents.
create or replace function public.name_key(name text)
returns text
language sql
stable
set search_path = ''
as $$
  select split_part(extensions.unaccent(lower(btrim(coalesce(name, '')))), ' ', 1);
$$;

-- Books a visit on a calendar for the patient with this mobile number. For
-- the booking page only (service role): the Next.js server passes a hash of
-- the client's IP address for the rate limits. It answers a status, never
-- anything about the patient:
--   booked         the visit is booked (its day, time, length and service)
--   needs_details  no patient has this number, or none with the name given:
--                  send first name, last name and email to register them
--   needs_name     several patients share this number: send the patient's
--                  first and last name
--   slot_taken     the slot is no longer free
--   too_many       the patient already has 3 upcoming visits booked online
--   rate_limited   too many attempts from this client, or too many bookings
--                  on this calendar in the last hour
--   closed         the calendar does not take bookings, or does not offer the service
--   invalid, invalid_phone, invalid_email   a value is missing or malformed
create or replace function public.book_online(
  calendar uuid,
  service uuid,
  local_day date,
  local_time time,
  phone text,
  first_name text default null,
  last_name text default null,
  email text default null,
  notes text default null,
  client text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  mobile constant text := public.normalize_phone(phone);
  given_first constant text := nullif(regexp_replace(btrim(coalesce(first_name, '')), '\s+', ' ', 'g'), '');
  given_last constant text := nullif(regexp_replace(btrim(coalesce(last_name, '')), '\s+', ' ', 'g'), '');
  given_email constant text := nullif(lower(btrim(coalesce(email, ''))), '');
  given_notes constant text := nullif(btrim(left(coalesce(notes, ''), 1000)), '');
  cal record;
  minutes integer;
  service_name text;
  matches uuid[];
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

  -- A Venezuelan mobile (04xx) or a number from abroad.
  if mobile is null or (mobile like '+58%' and mobile not like '+584%') then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  if not exists (
    select 1 from public.calendar_free_slots(cal.id, service, local_day, local_day) as f
    where f.starts = local_time
  ) then
    return jsonb_build_object('status', 'slot_taken');
  end if;

  if given_first is not null and given_last is not null then
    -- A name was given: the patient with this number and that name, or a new one.
    select p.id into patient
    from public.patients p
    where p.phone_e164 = mobile
      and public.name_key(p.first_name) = public.name_key(given_first)
      and public.name_key(p.last_name) = public.name_key(given_last)
    order by p.updated_at desc
    limit 1;

    if patient is null then
      if given_email is null then
        return jsonb_build_object('status', 'needs_details');
      end if;
      if given_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(given_email) > 120 then
        return jsonb_build_object('status', 'invalid_email');
      end if;
      if char_length(given_first) > 80 or char_length(given_last) > 80 then
        return jsonb_build_object('status', 'invalid');
      end if;
      insert into public.patients (first_name, last_name, phone, email, source)
      values (
        given_first,
        given_last,
        case when mobile like '+58%' then '0' || substr(mobile, 4, 3) || '-' || substr(mobile, 7) else mobile end,
        given_email,
        'online'
      )
      returning id into patient;
      registered := true;
    end if;
  else
    -- Only the number: its patient, when exactly one patient has it.
    select array_agg(p.id) into matches from public.patients p where p.phone_e164 = mobile;
    if coalesce(cardinality(matches), 0) = 0 then
      return jsonb_build_object('status', 'needs_details');
    elsif cardinality(matches) > 1 then
      return jsonb_build_object('status', 'needs_name');
    end if;
    patient := matches[1];
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

revoke execute on function public.booking_calendar(text) from public, anon, authenticated;
revoke execute on function public.booking_directory() from public, anon, authenticated;
revoke execute on function public.name_key(text) from public, anon, authenticated;
revoke execute on function public.book_online(uuid, uuid, date, time, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.booking_calendar(text) to service_role;
grant execute on function public.booking_directory() to service_role;
grant execute on function public.name_key(text) to service_role;
grant execute on function public.book_online(uuid, uuid, date, time, text, text, text, text, text, text) to service_role;
