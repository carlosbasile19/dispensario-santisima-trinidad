-- Bioanálisis: the laboratory's result reports (the "boletas").
--
-- · A report is one patient's results. Doctors and administrators build them
--   (can_build_lab_reports, mirroring labReports in src/lib/crm/roles.ts);
--   everyone who sees the patient can open, print and send a validated one.
--   A report may point at the visit the sample was taken in.
-- · `sections` holds the results as the editor saves them: one entry per area
--   (Hematología, Química sanguínea, Orina…), each with its rows (the test,
--   the result, its unit, the reference rules and an optional manual flag).
--   The server checks the shape (src/lib/lab/report.ts) before saving it.
-- · A report is a draft until it is validated. finalize_lab_report locks it,
--   stamps who validated it and copies in the patient as identified today and
--   the bioanalyst who signs (lab_settings), so the document never changes
--   afterwards. Every validated version is kept in lab_report_versions. A
--   correction reopens the report (reopen_lab_report) as its next revision.
-- · Deliveries (printed, shared, sent by WhatsApp) are logged in
--   lab_report_deliveries. PDFs are rendered on request and never stored,
--   except the copy WhatsApp downloads: bucket lab-reports, service role only,
--   deleted by the daily job after two days.

-- Who builds reports ------------------------------------------------------------

create or replace function public.can_build_lab_reports()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select public.current_app_role()) in ('doctor', 'admin'), false);
$$;

-- The patients a member may report on: all of them for those who see the
-- whole schedule, a doctor's own patients otherwise (as patients_select).
create or replace function public.sees_patient(patient uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.sees_all_schedule()) or public.is_my_patient(patient);
$$;

revoke execute on function public.can_build_lab_reports() from public, anon;
revoke execute on function public.sees_patient(uuid) from public, anon;
grant execute on function public.can_build_lab_reports() to authenticated;
grant execute on function public.sees_patient(uuid) to authenticated;

-- The bioanalyst who signs ------------------------------------------------------

create table public.lab_settings (
  id                boolean primary key default true constraint lab_settings_single_row check (id),
  signer_name       text not null constraint lab_settings_signer_name check (char_length(btrim(signer_name)) between 3 and 120),
  signer_title      text not null default 'Licenciado en Bioanálisis'
                    constraint lab_settings_signer_title check (char_length(btrim(signer_title)) between 3 and 80),
  -- As printed under the signature: "C.I. 11.171.135", "M.S.A.S. 9577", "Colegio 05-451".
  signer_id_number  text constraint lab_settings_signer_id_number check (char_length(signer_id_number) <= 40),
  signer_registry   text constraint lab_settings_signer_registry check (char_length(signer_registry) <= 80),
  signer_college    text constraint lab_settings_signer_college check (char_length(signer_college) <= 80),
  updated_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

comment on table public.lab_settings is
  'One row: the bioanalyst whose name and registrations sign every validated lab report.';

insert into public.lab_settings (signer_name, signer_title, signer_id_number, signer_registry, signer_college)
values ('Lcdo. Heriberto M. Arteaga R.', 'Licenciado en Bioanálisis', 'C.I. 11.171.135', 'M.S.A.S. 9577', 'Colegio 05-451')
on conflict (id) do nothing;

create or replace function public.lab_settings_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke execute on function public.lab_settings_stamp() from public, anon, authenticated;

create trigger lab_settings_stamp
  before update on public.lab_settings
  for each row execute function public.lab_settings_stamp();

alter table public.lab_settings enable row level security;

create policy "lab_settings_select_members" on public.lab_settings
  for select to authenticated
  using ((select public.is_member()));

create policy "lab_settings_update_admins" on public.lab_settings
  for update to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

revoke all on public.lab_settings from anon, authenticated;
grant select on public.lab_settings to authenticated;
grant update (signer_name, signer_title, signer_id_number, signer_registry, signer_college) on public.lab_settings to authenticated;

-- Reports -------------------------------------------------------------------------

create type public.lab_report_status as enum ('draft', 'final');

create table public.lab_reports (
  id                uuid primary key default gen_random_uuid(),
  -- The "Nº de examen" printed on the report, in order of creation.
  number            bigint generated always as identity constraint lab_reports_number_key unique,
  patient_id        uuid not null references public.patients (id) on delete restrict,
  appointment_id    uuid references public.appointments (id) on delete set null,
  status            public.lab_report_status not null default 'draft',
  -- 1 until the first correction; each reopening adds one.
  revision          integer not null default 1 constraint lab_reports_revision check (revision between 1 and 99),
  -- "Tipo de paciente" on the boleta.
  patient_type      text not null default 'contado'
                    constraint lab_reports_patient_type check (patient_type in ('contado', 'seguro', 'convenio', 'cortesia')),
  -- When the sample was taken ("Fecha / hora de la muestra").
  sampled_at        timestamptz not null default now(),
  requested_by      text constraint lab_reports_requested_by check (char_length(requested_by) <= 120),
  notes             text constraint lab_reports_notes check (char_length(notes) <= 2000),
  sections          jsonb not null default '[]'::jsonb
                    constraint lab_reports_sections check (jsonb_typeof(sections) = 'array' and pg_column_size(sections) <= 262144),
  -- The sections' titles, kept by the database for the lists.
  summary           text[] not null default '{}',
  -- Copied in when the report is validated: the patient as identified on the
  -- document, and the bioanalyst who signs it.
  patient_snapshot  jsonb,
  signer            jsonb,
  finalized_at      timestamptz,
  finalized_by      uuid references public.profiles (id) on delete set null,
  reopened_at       timestamptz,
  reopened_by       uuid references public.profiles (id) on delete set null,
  reopen_reason     text constraint lab_reports_reopen_reason check (char_length(reopen_reason) <= 300),
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint lab_reports_final_stamped
    check (status = 'draft' or (finalized_at is not null and patient_snapshot is not null and signer is not null))
);

comment on table public.lab_reports is
  'Lab result reports. Drafts are edited by doctors and administrators; validated ones never change.';

create index lab_reports_patient_idx on public.lab_reports (patient_id, created_at desc);
create index lab_reports_status_idx on public.lab_reports (status, updated_at desc);
create index lab_reports_created_idx on public.lab_reports (created_at desc);
create index lab_reports_appointment_idx on public.lab_reports (appointment_id) where appointment_id is not null;
create index lab_reports_created_by_idx on public.lab_reports (created_by);
create index lab_reports_finalized_by_idx on public.lab_reports (finalized_by);
create index lab_reports_reopened_by_idx on public.lab_reports (reopened_by);
create index lab_reports_updated_by_idx on public.lab_reports (updated_by);

-- Stamps each change, keeps the list summary and checks that the visit is the
-- patient's. Security definer because a doctor may not see the visit itself.
create or replace function public.lab_reports_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.patient_id is distinct from old.patient_id then
      raise exception 'A report cannot move to another patient' using errcode = 'P0001';
    end if;
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  end if;

  new.summary := case
    when jsonb_typeof(new.sections) = 'array' then coalesce(
      array(
        select left(btrim(section ->> 'title'), 80)
        from jsonb_array_elements(new.sections) with ordinality as s (section, position)
        where jsonb_typeof(section) = 'object' and coalesce(btrim(section ->> 'title'), '') <> ''
        order by position
      ),
      '{}'
    )
    else '{}'
  end;

  if new.appointment_id is not null
     and (tg_op = 'INSERT' or new.appointment_id is distinct from old.appointment_id)
     and not exists (
       select 1 from public.appointments where id = new.appointment_id and patient_id = new.patient_id
     ) then
    raise exception 'The visit belongs to another patient' using errcode = 'P0001', hint = 'invalid_visit';
  end if;
  return new;
end;
$$;

revoke execute on function public.lab_reports_prepare() from public, anon, authenticated;

create trigger lab_reports_prepare
  before insert or update on public.lab_reports
  for each row execute function public.lab_reports_prepare();

alter table public.lab_reports enable row level security;

-- Who sees a report: whoever sees its patient, and its author.
create policy "lab_reports_select" on public.lab_reports
  for select to authenticated
  using (public.sees_patient(patient_id) or created_by = (select auth.uid()));

create policy "lab_reports_insert_builders" on public.lab_reports
  for insert to authenticated
  with check ((select public.can_build_lab_reports()) and status = 'draft' and public.sees_patient(patient_id));

-- Only drafts change. Validating and reopening go through the functions below.
create policy "lab_reports_update_drafts" on public.lab_reports
  for update to authenticated
  using (
    (select public.can_build_lab_reports())
    and status = 'draft'
    and (public.sees_patient(patient_id) or created_by = (select auth.uid()))
  )
  with check (status = 'draft');

-- A draft that was never validated can be discarded.
create policy "lab_reports_delete_drafts" on public.lab_reports
  for delete to authenticated
  using (
    (select public.can_build_lab_reports())
    and status = 'draft'
    and reopened_at is null
    and (public.sees_patient(patient_id) or created_by = (select auth.uid()))
  );

revoke all on public.lab_reports from anon, authenticated;
grant select, delete on public.lab_reports to authenticated;
grant insert (patient_id, appointment_id, patient_type, sampled_at, requested_by, notes, sections)
  on public.lab_reports to authenticated;
grant update (appointment_id, patient_type, sampled_at, requested_by, notes, sections)
  on public.lab_reports to authenticated;

-- Validated versions --------------------------------------------------------------

create table public.lab_report_versions (
  report_id         uuid not null references public.lab_reports (id) on delete cascade,
  revision          integer not null,
  patient_type      text not null,
  sampled_at        timestamptz not null,
  requested_by      text,
  notes             text,
  sections          jsonb not null,
  patient_snapshot  jsonb not null,
  signer            jsonb not null,
  finalized_at      timestamptz not null,
  finalized_by      uuid references public.profiles (id) on delete set null,
  primary key (report_id, revision)
);

comment on table public.lab_report_versions is
  'Each validated version of a lab report, as it was issued. Written by finalize_lab_report only.';

create index lab_report_versions_finalized_by_idx on public.lab_report_versions (finalized_by);

alter table public.lab_report_versions enable row level security;

create policy "lab_report_versions_select" on public.lab_report_versions
  for select to authenticated
  using (exists (select 1 from public.lab_reports r where r.id = report_id));

revoke all on public.lab_report_versions from anon, authenticated;
grant select on public.lab_report_versions to authenticated;

-- Validates (signs) a draft: it must have at least one result. Answers when.
create or replace function public.finalize_lab_report(report uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.lab_reports%rowtype;
  p public.patients%rowtype;
  s public.lab_settings%rowtype;
  stamp timestamptz := now();
  v_patient jsonb;
  v_signer jsonb;
begin
  if not (select public.can_build_lab_reports()) then
    raise exception 'Only doctors and administrators validate lab reports' using errcode = '42501';
  end if;

  select * into r from public.lab_reports where id = report for update;
  if not found or not (public.sees_patient(r.patient_id) or r.created_by = (select auth.uid())) then
    raise exception 'Unknown report' using errcode = 'P0002';
  end if;
  if r.status <> 'draft' then
    raise exception 'The report is already validated' using errcode = 'P0001', hint = 'already_final';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(r.sections) as section,
         jsonb_array_elements(case when jsonb_typeof(section -> 'rows') = 'array' then section -> 'rows' else '[]'::jsonb end) as item
    where coalesce(btrim(item ->> 'value'), '') <> ''
  ) then
    raise exception 'The report has no results' using errcode = 'P0001', hint = 'empty_report';
  end if;

  select * into s from public.lab_settings where id;
  if not found then
    raise exception 'Nobody signs lab reports yet' using errcode = 'P0001', hint = 'missing_signer';
  end if;
  select * into p from public.patients where id = r.patient_id;

  v_patient := jsonb_build_object(
    'first_name', p.first_name,
    'last_name', p.last_name,
    'id_type', p.id_type,
    'id_number', p.id_number,
    'birth_date', p.birth_date,
    'sex', p.sex
  );
  v_signer := jsonb_build_object(
    'name', s.signer_name,
    'title', s.signer_title,
    'id_number', s.signer_id_number,
    'registry', s.signer_registry,
    'college', s.signer_college
  );

  update public.lab_reports
  set status = 'final',
      finalized_at = stamp,
      finalized_by = (select auth.uid()),
      patient_snapshot = v_patient,
      signer = v_signer
  where id = report;

  insert into public.lab_report_versions (
    report_id, revision, patient_type, sampled_at, requested_by, notes, sections,
    patient_snapshot, signer, finalized_at, finalized_by
  )
  values (
    r.id, r.revision, r.patient_type, r.sampled_at, r.requested_by, r.notes, r.sections,
    v_patient, v_signer, stamp, (select auth.uid())
  )
  on conflict (report_id, revision) do update
    set patient_type = excluded.patient_type,
        sampled_at = excluded.sampled_at,
        requested_by = excluded.requested_by,
        notes = excluded.notes,
        sections = excluded.sections,
        patient_snapshot = excluded.patient_snapshot,
        signer = excluded.signer,
        finalized_at = excluded.finalized_at,
        finalized_by = excluded.finalized_by;

  return stamp;
end;
$$;

-- Reopens a validated report to correct it, as its next revision. The
-- version already issued stays in lab_report_versions.
create or replace function public.reopen_lab_report(report uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.lab_reports%rowtype;
begin
  if not (select public.can_build_lab_reports()) then
    raise exception 'Only doctors and administrators correct lab reports' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(reason, ''))) not between 3 and 300 then
    raise exception 'Say why the report is corrected' using errcode = '22023', hint = 'missing_reason';
  end if;

  select * into r from public.lab_reports where id = report for update;
  if not found or not (public.sees_patient(r.patient_id) or r.created_by = (select auth.uid())) then
    raise exception 'Unknown report' using errcode = 'P0002';
  end if;
  if r.status <> 'final' then
    raise exception 'The report is not validated' using errcode = 'P0001', hint = 'not_final';
  end if;
  if r.revision >= 99 then
    raise exception 'Too many corrections' using errcode = 'P0001';
  end if;

  update public.lab_reports
  set status = 'draft',
      revision = r.revision + 1,
      reopened_at = now(),
      reopened_by = (select auth.uid()),
      reopen_reason = btrim(reason),
      finalized_at = null,
      finalized_by = null,
      patient_snapshot = null,
      signer = null
  where id = report;
end;
$$;

revoke execute on function public.finalize_lab_report(uuid) from public, anon;
revoke execute on function public.reopen_lab_report(uuid, text) from public, anon;
grant execute on function public.finalize_lab_report(uuid) to authenticated;
grant execute on function public.reopen_lab_report(uuid, text) to authenticated;

-- Deliveries ------------------------------------------------------------------------

create table public.lab_report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.lab_reports (id) on delete cascade,
  -- The revision that was delivered. Set by the database.
  revision    integer not null default 1,
  -- print: printed for the patient · share: shared from the member's device
  -- (WhatsApp or another app) · download: PDF downloaded · whatsapp: sent from
  -- the clinic's number through Zernio.
  channel     text not null constraint lab_report_deliveries_channel check (channel in ('print', 'share', 'download', 'whatsapp')),
  -- done for the first three; whatsapp: sending → sent, or failed.
  status      text not null default 'done' constraint lab_report_deliveries_status check (status in ('done', 'sending', 'sent', 'failed')),
  to_phone    text constraint lab_report_deliveries_phone check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  wamid       text constraint lab_report_deliveries_wamid check (char_length(wamid) <= 200),
  error       text constraint lab_report_deliveries_error check (char_length(error) <= 500),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index lab_report_deliveries_report_idx on public.lab_report_deliveries (report_id, created_at desc);
create index lab_report_deliveries_created_by_idx on public.lab_report_deliveries (created_by);

-- Stamps the report's current revision on each delivery.
create or replace function public.lab_report_deliveries_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select revision into new.revision from public.lab_reports where id = new.report_id;
  return new;
end;
$$;

revoke execute on function public.lab_report_deliveries_prepare() from public, anon, authenticated;

create trigger lab_report_deliveries_prepare
  before insert on public.lab_report_deliveries
  for each row execute function public.lab_report_deliveries_prepare();

alter table public.lab_report_deliveries enable row level security;

create policy "lab_report_deliveries_select" on public.lab_report_deliveries
  for select to authenticated
  using (exists (select 1 from public.lab_reports r where r.id = report_id));

-- Members log what they did with a validated report they see. WhatsApp
-- sends are written by the server with the service role.
create policy "lab_report_deliveries_insert_members" on public.lab_report_deliveries
  for insert to authenticated
  with check (
    channel in ('print', 'share', 'download')
    and status = 'done'
    and exists (select 1 from public.lab_reports r where r.id = report_id and r.status = 'final')
  );

revoke all on public.lab_report_deliveries from anon, authenticated;
grant select on public.lab_report_deliveries to authenticated;
grant insert (report_id, channel) on public.lab_report_deliveries to authenticated;

-- The copy WhatsApp downloads ---------------------------------------------------------

-- Private: no policies, so only the service role reads or writes it. The
-- server uploads the PDF, hands Meta a signed link for a few hours and the
-- daily job deletes it after two days.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-reports', 'lab-reports', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
