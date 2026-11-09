-- Patients, the centre's price list, the agenda, the daily BCV exchange rate
-- and payments.
--
-- · An appointment is one visit of one patient. It carries one or more
--   services (appointment_items), each with its own professional: a visit can
--   have a medical consultation, a lab test and a dental cleaning, each with a
--   different person.
-- · Each service has the centre's price in US dollars, set in Contabilidad.
--   A booked service copies that price (list_price_usd) and the front desk may
--   charge a different one (price_usd).
-- · Balances are in US dollars. A payment is recorded in the currency it was
--   received in, and the database derives the other one from the BCV rate of
--   the day it was received (payments_apply_rate). Every payment of a day uses
--   that day's rate: correcting a day's rate recalculates that day's payments.
-- · The clinic's calendar is America/Caracas time.

create extension if not exists unaccent with schema extensions;

-- Permission helpers -------------------------------------------------------
-- They mirror src/lib/crm/roles.ts and are used by the policies below.

create or replace function public.clinic_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

-- Director, front desk and administrators see every appointment and patient;
-- a doctor only those they are assigned to.
create or replace function public.sees_all_schedule()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) in ('director', 'staff', 'admin'), false);
$$;

-- Book, move and check in appointments; register patients.
create or replace function public.can_manage_schedule()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) in ('staff', 'admin'), false);
$$;

-- Take payments and set today's BCV rate.
create or replace function public.can_collect_payments()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) in ('staff', 'admin'), false);
$$;

-- Contabilidad: the price list, any day's rate, voiding payments.
create or replace function public.can_manage_accounting()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) = 'admin', false);
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.current_app_role()) is not null;
$$;

revoke execute on function public.clinic_today() from public, anon;
revoke execute on function public.sees_all_schedule() from public, anon;
revoke execute on function public.can_manage_schedule() from public, anon;
revoke execute on function public.can_collect_payments() from public, anon;
revoke execute on function public.can_manage_accounting() from public, anon;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.clinic_today() to authenticated;
grant execute on function public.sees_all_schedule() to authenticated;
grant execute on function public.can_manage_schedule() to authenticated;
grant execute on function public.can_collect_payments() to authenticated;
grant execute on function public.can_manage_accounting() to authenticated;
grant execute on function public.is_member() to authenticated;

-- Services and the centre's prices -----------------------------------------

create type public.service_area as enum ('medicina', 'odontologia', 'bioanalisis');

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  area        public.service_area not null,
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  price_usd   numeric(10, 2) not null check (price_usd >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index services_area_name_key on public.services (area, lower(btrim(name)));

create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy "services_select_members" on public.services
  for select to authenticated
  using ((select public.is_member()));

create policy "services_insert_accounting" on public.services
  for insert to authenticated
  with check ((select public.can_manage_accounting()));

create policy "services_update_accounting" on public.services
  for update to authenticated
  using ((select public.can_manage_accounting()))
  with check ((select public.can_manage_accounting()));

revoke all on public.services from anon, authenticated;
grant select on public.services to authenticated;
grant insert (area, name, price_usd, active) on public.services to authenticated;
grant update (area, name, price_usd, active) on public.services to authenticated;

-- Patients -------------------------------------------------------------------

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name   text not null check (char_length(btrim(last_name)) between 1 and 80),
  -- Cédula: V (venezolano), E (extranjero) or P (pasaporte). Optional, since
  -- young children often have none.
  id_type     text check (id_type in ('V', 'E', 'P')),
  id_number   text check (id_number ~ '^[0-9A-Z]{4,15}$'),
  birth_date  date check (birth_date >= date '1900-01-01'),
  sex         text check (sex in ('F', 'M')),
  phone       text check (char_length(phone) <= 30),
  email       text check (char_length(email) <= 120),
  address     text check (char_length(address) <= 300),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint patients_document_complete check ((id_type is null) = (id_number is null))
);

create unique index patients_document_key on public.patients (id_type, id_number) where id_number is not null;
create index patients_name_idx on public.patients (lower(last_name), lower(first_name));
create index patients_created_by_idx on public.patients (created_by);

create trigger patients_touch_updated_at
  before update on public.patients
  for each row execute function public.touch_updated_at();

-- Appointments ---------------------------------------------------------------

create type public.appointment_status as enum (
  'scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'
);

create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients (id) on delete restrict,
  starts_at         timestamptz not null,
  -- The clinic's calendar day of the visit, for the agenda's day view.
  starts_on         date generated always as ((starts_at at time zone 'America/Caracas')::date) stored,
  duration_minutes  integer not null default 30 check (duration_minutes between 5 and 480),
  status            public.appointment_status not null default 'scheduled',
  notes             text check (char_length(notes) <= 1000),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index appointments_day_idx on public.appointments (starts_on, starts_at);
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);
create index appointments_created_by_idx on public.appointments (created_by);

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

create table public.appointment_items (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointments (id) on delete cascade,
  service_id       uuid not null references public.services (id) on delete restrict,
  professional_id  uuid references public.profiles (id) on delete set null,
  -- The centre's price for the service when it was booked. Set by the database.
  list_price_usd   numeric(10, 2) not null,
  -- What the patient is charged: the list price unless the front desk changed it.
  price_usd        numeric(10, 2) not null check (price_usd >= 0),
  created_at       timestamptz not null default now()
);

create index appointment_items_appointment_idx on public.appointment_items (appointment_id);
create index appointment_items_professional_idx on public.appointment_items (professional_id);
create index appointment_items_service_idx on public.appointment_items (service_id);

-- Copies the centre's price and checks the professional. Security definer
-- because the front desk cannot read other members' profiles.
create or replace function public.appointment_items_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service record;
begin
  if tg_op = 'INSERT' then
    select price_usd, active into service from public.services where id = new.service_id;
    if not found then
      raise exception 'Unknown service' using errcode = '23503';
    end if;
    if not service.active then
      raise exception 'This service is no longer offered' using errcode = 'P0001', hint = 'inactive_service';
    end if;
    new.list_price_usd := service.price_usd;
    new.price_usd := coalesce(new.price_usd, service.price_usd);
  end if;

  if new.professional_id is not null
     and (tg_op = 'INSERT' or new.professional_id is distinct from old.professional_id)
     and not exists (
       select 1 from public.profiles where id = new.professional_id and role in ('doctor', 'director')
     ) then
    raise exception 'The professional must be a doctor or the medical director'
      using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  return new;
end;
$$;

revoke execute on function public.appointment_items_prepare() from public, anon, authenticated;

create trigger appointment_items_prepare
  before insert or update of professional_id on public.appointment_items
  for each row execute function public.appointment_items_prepare();

-- A doctor's own appointments and patients. Security definer so the policies
-- can look at appointment_items without recursing into its own policy.
create or replace function public.is_my_appointment(appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointment_items
    where appointment_id = appointment and professional_id = (select auth.uid())
  );
$$;

create or replace function public.is_my_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    join public.appointment_items i on i.appointment_id = a.id
    where a.patient_id = patient and i.professional_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_my_appointment(uuid) from public, anon;
revoke execute on function public.is_my_patient(uuid) from public, anon;
grant execute on function public.is_my_appointment(uuid) to authenticated;
grant execute on function public.is_my_patient(uuid) to authenticated;

alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;

create policy "patients_select" on public.patients
  for select to authenticated
  using ((select public.sees_all_schedule()) or public.is_my_patient(id));

create policy "patients_insert_schedulers" on public.patients
  for insert to authenticated
  with check ((select public.can_manage_schedule()));

create policy "patients_update_schedulers" on public.patients
  for update to authenticated
  using ((select public.can_manage_schedule()))
  with check ((select public.can_manage_schedule()));

create policy "appointments_select" on public.appointments
  for select to authenticated
  using ((select public.sees_all_schedule()) or public.is_my_appointment(id));

create policy "appointments_insert_schedulers" on public.appointments
  for insert to authenticated
  with check ((select public.can_manage_schedule()));

create policy "appointments_update_schedulers" on public.appointments
  for update to authenticated
  using ((select public.can_manage_schedule()))
  with check ((select public.can_manage_schedule()));

create policy "appointment_items_select" on public.appointment_items
  for select to authenticated
  using ((select public.sees_all_schedule()) or public.is_my_appointment(appointment_id));

create policy "appointment_items_insert_schedulers" on public.appointment_items
  for insert to authenticated
  with check ((select public.can_manage_schedule()));

create policy "appointment_items_update_schedulers" on public.appointment_items
  for update to authenticated
  using ((select public.can_manage_schedule()))
  with check ((select public.can_manage_schedule()));

create policy "appointment_items_delete_schedulers" on public.appointment_items
  for delete to authenticated
  using ((select public.can_manage_schedule()));

revoke all on public.patients from anon, authenticated;
grant select on public.patients to authenticated;
grant insert (first_name, last_name, id_type, id_number, birth_date, sex, phone, email, address, notes)
  on public.patients to authenticated;
grant update (first_name, last_name, id_type, id_number, birth_date, sex, phone, email, address, notes)
  on public.patients to authenticated;

revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant insert (patient_id, starts_at, duration_minutes, notes) on public.appointments to authenticated;
grant update (starts_at, duration_minutes, status, notes) on public.appointments to authenticated;

revoke all on public.appointment_items from anon, authenticated;
grant select, delete on public.appointment_items to authenticated;
grant insert (appointment_id, service_id, professional_id, price_usd) on public.appointment_items to authenticated;
grant update (professional_id, price_usd) on public.appointment_items to authenticated;

-- Books a visit with its services in one transaction. The date and time are
-- the clinic's local time. Runs with the caller's rights, so RLS applies.
create or replace function public.create_appointment(
  patient uuid,
  local_date date,
  local_time time,
  duration_minutes integer,
  notes text,
  items jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_appointment uuid;
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) = 0 then
    raise exception 'An appointment needs at least one service' using errcode = '22023';
  end if;

  insert into public.appointments (patient_id, starts_at, duration_minutes, notes)
  values (
    patient,
    (local_date + local_time) at time zone 'America/Caracas',
    coalesce(duration_minutes, 30),
    nullif(btrim(notes), '')
  )
  returning id into new_appointment;

  insert into public.appointment_items (appointment_id, service_id, professional_id, price_usd)
  select new_appointment,
         (item ->> 'service_id')::uuid,
         nullif(item ->> 'professional_id', '')::uuid,
         nullif(item ->> 'price_usd', '')::numeric
  from jsonb_array_elements(items) as item;

  return new_appointment;
end;
$$;

-- Moves a visit to another local date and time.
create or replace function public.reschedule_appointment(
  appointment uuid,
  local_date date,
  local_time time,
  duration_minutes integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.appointments
  set starts_at = (local_date + local_time) at time zone 'America/Caracas',
      duration_minutes = coalesce(reschedule_appointment.duration_minutes, appointments.duration_minutes)
  where id = appointment;
  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Patients by name or cédula. Every word must appear somewhere in the name,
-- in any order and ignoring accents ("perez maria" finds "María José Pérez");
-- a query with 3 or more digits also matches the cédula ("V-12.345").
create or replace function public.search_patients(query text default '', max_rows integer default 50)
returns setof public.patients
language sql
stable
set search_path = ''
as $$
  with q as (
    select array_remove(
             regexp_split_to_array(extensions.unaccent(lower(btrim(coalesce(query, '')))), '\s+'), ''
           ) as words,
           regexp_replace(coalesce(query, ''), '[^0-9]', '', 'g') as digits
  )
  select p.*
  from public.patients p, q
  where cardinality(q.words) = 0
     or not exists (
       select 1 from unnest(q.words) as word
       where strpos(extensions.unaccent(lower(p.first_name || ' ' || p.last_name)), word) = 0
     )
     or (char_length(q.digits) >= 3 and strpos(coalesce(p.id_number, ''), q.digits) > 0)
  order by lower(p.last_name), lower(p.first_name)
  limit least(greatest(coalesce(max_rows, 50), 1), 200);
$$;

-- Members who can be assigned to a service (doctors and the medical
-- director), plus anyone already assigned to one, so past visits keep their
-- names. Only ids and names: the front desk cannot read other profiles.
create or replace function public.clinic_professionals()
returns table (id uuid, full_name text, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), p.email, 'Sin nombre'), p.role
  from public.profiles p
  where (select public.current_app_role()) is not null
    and (
      p.role in ('doctor', 'director')
      or exists (select 1 from public.appointment_items i where i.professional_id = p.id)
    )
  order by 2;
$$;

revoke execute on function public.create_appointment(uuid, date, time, integer, text, jsonb) from public, anon;
revoke execute on function public.reschedule_appointment(uuid, date, time, integer) from public, anon;
revoke execute on function public.search_patients(text, integer) from public, anon;
revoke execute on function public.clinic_professionals() from public, anon;
grant execute on function public.create_appointment(uuid, date, time, integer, text, jsonb) to authenticated;
grant execute on function public.reschedule_appointment(uuid, date, time, integer) to authenticated;
grant execute on function public.search_patients(text, integer) to authenticated;
grant execute on function public.clinic_professionals() to authenticated;

-- BCV exchange rate, one per day -------------------------------------------

create table public.exchange_rates (
  rate_date   date primary key,
  -- Bolívares per US dollar, as published by the BCV (up to 8 decimals).
  bs_per_usd  numeric(20, 8) not null check (bs_per_usd > 0),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index exchange_rates_updated_by_idx on public.exchange_rates (updated_by);

create trigger exchange_rates_touch_updated_at
  before update on public.exchange_rates
  for each row execute function public.touch_updated_at();

alter table public.exchange_rates enable row level security;

create policy "exchange_rates_select_members" on public.exchange_rates
  for select to authenticated
  using ((select public.is_member()));

-- Written only through set_exchange_rate().
revoke all on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to authenticated;

-- Sets or corrects a day's rate. The front desk may set today's; Contabilidad
-- any day's. Correcting a rate recalculates that day's payments (trigger below).
create or replace function public.set_exchange_rate(rate_day date, bs_per_usd numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    (select public.can_manage_accounting())
    or ((select public.can_collect_payments()) and rate_day = public.clinic_today())
  ) then
    raise exception 'Not allowed to set the rate for %', rate_day using errcode = '42501';
  end if;
  if bs_per_usd is null or bs_per_usd <= 0 then
    raise exception 'The rate must be greater than zero' using errcode = '22023';
  end if;

  insert into public.exchange_rates (rate_date, bs_per_usd, updated_by)
  values (rate_day, set_exchange_rate.bs_per_usd, (select auth.uid()))
  on conflict (rate_date) do update
    set bs_per_usd = excluded.bs_per_usd,
        updated_by = excluded.updated_by;
end;
$$;

revoke execute on function public.set_exchange_rate(date, numeric) from public, anon;
grant execute on function public.set_exchange_rate(date, numeric) to authenticated;

-- Payments ---------------------------------------------------------------------

create type public.payment_method as enum (
  'cash_usd', 'zelle', 'pago_movil', 'card_bs', 'transfer_bs', 'cash_bs'
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete restrict,
  -- The clinic's day the money was received. Its rate is the one applied.
  paid_on         date not null default public.clinic_today() references public.exchange_rates (rate_date),
  method          public.payment_method not null,
  -- Derived from the method: cash_usd and zelle are dollars, the rest bolívares.
  currency        text not null check (currency in ('USD', 'VES')),
  -- The BCV rate of paid_on, kept in step with exchange_rates.
  rate            numeric(20, 8) not null,
  -- For dollar payments amount_usd is what was received and amount_bs its
  -- equivalent; for bolívar payments the other way round.
  amount_usd      numeric(12, 2) not null check (amount_usd > 0),
  amount_bs       numeric(16, 2) not null check (amount_bs > 0),
  reference       text check (char_length(reference) <= 60),
  received_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_reason     text check (char_length(void_reason) <= 200)
);

create index payments_appointment_idx on public.payments (appointment_id);
create index payments_paid_on_idx on public.payments (paid_on);
create index payments_received_by_idx on public.payments (received_by);
create index payments_voided_by_idx on public.payments (voided_by);

-- The conversion, done in one place with exact decimals.
create or replace function public.payments_apply_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day_rate numeric(20, 8);
begin
  select bs_per_usd into day_rate from public.exchange_rates where rate_date = new.paid_on;
  if day_rate is null then
    raise exception 'There is no BCV rate for %', new.paid_on using errcode = 'P0001', hint = 'missing_rate';
  end if;

  new.rate := day_rate;
  if new.method in ('cash_usd', 'zelle') then
    new.currency := 'USD';
    new.amount_bs := round(new.amount_usd * day_rate, 2);
  else
    new.currency := 'VES';
    new.amount_usd := round(new.amount_bs / day_rate, 2);
  end if;
  return new;
end;
$$;

-- A payment cannot be more than what is still owed.
create or replace function public.payments_check_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  due numeric(12, 2);
begin
  select coalesce((select sum(price_usd) from public.appointment_items where appointment_id = new.appointment_id), 0)
       - coalesce((select sum(amount_usd) from public.payments where appointment_id = new.appointment_id and voided_at is null), 0)
    into due;
  if new.amount_usd > due then
    raise exception 'The payment (% USD) is more than the balance due (% USD)', new.amount_usd, due
      using errcode = 'P0001', hint = 'exceeds_balance';
  end if;
  return new;
end;
$$;

revoke execute on function public.payments_apply_rate() from public, anon, authenticated;
revoke execute on function public.payments_check_balance() from public, anon, authenticated;

-- Triggers fire in name order: the rate is applied before the balance check.
create trigger payments_apply_rate
  before insert or update of paid_on, method, amount_usd, amount_bs, rate on public.payments
  for each row execute function public.payments_apply_rate();

create trigger payments_check_balance
  before insert on public.payments
  for each row execute function public.payments_check_balance();

-- When a day's rate is corrected, every payment of that day follows it.
create or replace function public.exchange_rates_recalculate_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments set rate = new.bs_per_usd where paid_on = new.rate_date;
  return null;
end;
$$;

revoke execute on function public.exchange_rates_recalculate_day() from public, anon, authenticated;

create trigger exchange_rates_recalculate_day
  after update of bs_per_usd on public.exchange_rates
  for each row
  when (old.bs_per_usd is distinct from new.bs_per_usd)
  execute function public.exchange_rates_recalculate_day();

alter table public.payments enable row level security;

create policy "payments_select_collectors" on public.payments
  for select to authenticated
  using ((select public.can_collect_payments()) or (select public.can_manage_accounting()));

create policy "payments_insert_collectors" on public.payments
  for insert to authenticated
  with check ((select public.can_collect_payments()));

-- Payments are never edited or deleted by members: they are voided.
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant insert (appointment_id, method, amount_usd, amount_bs, reference) on public.payments to authenticated;

-- Contabilidad only: voids a payment, keeping it on record.
create or replace function public.void_payment(payment uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.can_manage_accounting()) then
    raise exception 'Only administrators can void payments' using errcode = '42501';
  end if;
  update public.payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = nullif(btrim(reason), '')
  where id = payment and voided_at is null;
  if not found then
    raise exception 'Payment not found or already voided' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.void_payment(uuid, text) to authenticated;

-- What each visit costs, what was paid and what is still owed, in dollars.
create view public.appointment_balances
with (security_invoker = true)
as
select a.id as appointment_id,
       a.patient_id,
       a.starts_at,
       a.starts_on,
       a.status,
       coalesce(i.total, 0)::numeric(12, 2) as total_usd,
       coalesce(p.paid, 0)::numeric(12, 2) as paid_usd,
       (coalesce(i.total, 0) - coalesce(p.paid, 0))::numeric(12, 2) as balance_usd
from public.appointments a
left join lateral (
  select sum(price_usd) as total from public.appointment_items where appointment_id = a.id
) i on true
left join lateral (
  select sum(amount_usd) as paid from public.payments where appointment_id = a.id and voided_at is null
) p on true;

revoke all on public.appointment_balances from anon, authenticated;
grant select on public.appointment_balances to authenticated;
