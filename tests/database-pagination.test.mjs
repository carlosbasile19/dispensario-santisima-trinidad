import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

// An isolated Postgres instance with the columns and RLS needed by this
// migration. No production connection, patient records, or secrets are used.
const db = new PGlite({ extensions: { unaccent } });
const id = (number) => `00000000-0000-0000-0000-${number.toString(16).padStart(12, "0")}`;

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema extensions;
    create extension unaccent with schema extensions;
    create type public.lab_report_status as enum ('draft', 'final');
    create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
    create table public.patients (
      id uuid primary key, first_name text not null, last_name text not null,
      id_type text, id_number text, birth_date date, phone text,
      created_at timestamptz not null default now(), visible boolean not null default true
    );
    create table public.lab_reports (
      id uuid primary key, patient_id uuid not null references public.patients,
      status public.lab_report_status not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.appointments (
      id uuid primary key, patient_id uuid not null references public.patients,
      starts_at timestamptz not null,
      starts_on date generated always as ((starts_at at time zone 'America/Caracas')::date) stored,
      status public.appointment_status not null, balance_usd numeric not null
    );
    create view public.appointment_balances with (security_invoker = true) as
      select id as appointment_id, patient_id, starts_on, status, balance_usd from public.appointments;
    create function public.clinic_today() returns date language sql stable as $$ select date '2026-11-11' $$;
    create function public.can_collect_payments() returns boolean language sql stable as
      $$ select current_setting('test.collect', true) = 'true' $$;
    create function public.can_manage_accounting() returns boolean language sql stable as $$ select false $$;
    create index patients_name_idx on public.patients (lower(last_name), lower(first_name));
    create index lab_reports_status_idx on public.lab_reports (status, updated_at desc);
    create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);
    alter table public.patients enable row level security;
    alter table public.lab_reports enable row level security;
    alter table public.appointments enable row level security;
    create policy visible_patients on public.patients for select to authenticated using (visible);
    create policy visible_reports on public.lab_reports for select to authenticated using (
      exists (select 1 from public.patients p where p.id = patient_id)
    );
    create policy visible_visits on public.appointments for select to authenticated using (
      exists (select 1 from public.patients p where p.id = patient_id)
    );
    grant usage on schema extensions to authenticated;
    grant select on all tables in schema public to authenticated;
    insert into public.patients (id, first_name, last_name, id_type, id_number)
      select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid,
        'María José', 'Pérez', 'V', (12000000 + i)::text
      from generate_series(1, 260) i;
    insert into public.patients (id, first_name, last_name, visible)
      values ('${id(999)}', 'Oculta', 'Privada', false);
    insert into public.lab_reports (id, patient_id, status, updated_at)
      select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid,
        '${id(260)}', case when i <= 120 then 'final' else 'draft' end::public.lab_report_status,
        '2026-11-11T12:00:00Z' from generate_series(1, 130) i;
    insert into public.lab_reports (id, patient_id, status)
      values ('${id(999)}', '${id(999)}', 'final');
    insert into public.appointments (id, patient_id, starts_at, status, balance_usd)
      select ('00000000-0000-0000-0000-' || lpad(to_hex(i), 12, '0'))::uuid,
        '${id(260)}', '2020-01-01T12:00:00Z', 'completed', 10 from generate_series(1, 110) i;
    insert into public.appointments (id, patient_id, starts_at, status, balance_usd) values
      ('${id(111)}', '${id(260)}', '2020-01-01T12:00:00Z', 'cancelled', 10),
      ('${id(112)}', '${id(260)}', '2020-01-01T12:00:00Z', 'no_show', 10),
      ('${id(113)}', '${id(260)}', '2026-11-11T12:00:00Z', 'completed', 4),
      ('${id(114)}', '${id(260)}', '2027-01-01T12:00:00Z', 'scheduled', 20),
      ('${id(115)}', '${id(260)}', '2020-01-01T12:00:00Z', 'completed', -5),
      ('${id(999)}', '${id(999)}', '2020-01-01T12:00:00Z', 'completed', 9999);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261111144611_paginate_patient_and_lab_lists.sql", import.meta.url), "utf8"));
});

after(async () => { await db.close(); });
beforeEach(async () => { await db.exec("reset role; set test.collect = 'true'; set role authenticated;"); });

test("patient directory reaches later pages with no gaps when names tie", async () => {
  const collected = [];
  for (let offset = 0; offset < 260; offset += 50) {
    const { rows } = await db.query("select id from public.search_patients_page('', $1, 51)", [offset]);
    assert.equal(rows.length > 50, offset < 250);
    collected.push(...rows.slice(0, 50).map((row) => row.id));
  }
  assert.deepEqual(collected, Array.from({ length: 260 }, (_, index) => id(index + 1)));
});

test("patient search keeps accent-insensitive word and formatted document matching", async () => {
  const names = await db.query("select id from public.search_patients_page('perez maria', 200, 51)");
  assert.equal(names.rows.length, 51);
  const document = await db.query("select id from public.search_patients_page('V-12.000.260', 0, 51)");
  assert.deepEqual(document.rows, [{ id: id(260) }]);
  const punctuation = await db.query("select id from public.search_patients_page($1, 0, 51)", ["' OR true --"]);
  assert.equal(punctuation.rows.length, 0);
});

test("search page sizes and offsets are bounded at the database boundary", async () => {
  const oversized = await db.query("select id from public.search_patients_page('', -20, 1000000)");
  assert.equal(oversized.rows.length, 101);
  assert.equal(oversized.rows[0].id, id(1));
  const zero = await db.query("select id from public.search_patients_page('', 0, 0)");
  assert.equal(zero.rows.length, 1);
  const afterEnd = await db.query("select id from public.search_patients_page('', 100000000, 51)");
  assert.equal(afterEnd.rows.length, 0);
});

test("lab search finds a matching patient beyond the old 200-patient lookup limit", async () => {
  const { rows } = await db.query("select id, patient_id from public.search_lab_reports_page('perez maria', 'final', null, 100, 51)");
  assert.equal(rows.length, 20);
  assert.ok(rows.every((row) => row.patient_id === id(260)));
  assert.deepEqual(rows.map((row) => row.id), Array.from({ length: 20 }, (_, index) => id(20 - index)));
});

test("lab pages preserve tied timestamp order, patient and status filters", async () => {
  const first = await db.query("select id from public.search_lab_reports_page('', 'final', $1, 0, 51)", [id(260)]);
  const next = await db.query("select id from public.search_lab_reports_page('', 'final', $1, 50, 51)", [id(260)]);
  assert.equal(first.rows[50].id, next.rows[0].id);
  assert.equal(new Set([...first.rows.slice(0, 50), ...next.rows.slice(0, 50)].map((row) => row.id)).size, 100);
  const drafts = await db.query("select id from public.search_lab_reports_page('', 'draft', $1, 0, 51)", [id(260)]);
  assert.equal(drafts.rows.length, 10);
  const otherPatient = await db.query("select id from public.search_lab_reports_page('', null, $1, 0, 51)", [id(1)]);
  assert.equal(otherPatient.rows.length, 0);
});

test("new search and summary functions respect the caller's RLS visibility", async () => {
  const patients = await db.query("select id from public.search_patients_page('Oculta', 0, 51)");
  const reports = await db.query("select id from public.search_lab_reports_page('', null, $1, 0, 51)", [id(999)]);
  const summary = await db.query("select * from public.patient_visit_summary($1)", [id(999)]);
  assert.equal(patients.rows.length, 0);
  assert.equal(reports.rows.length, 0);
  assert.equal(Number(summary.rows[0].appointments), 0);
  assert.equal(Number(summary.rows[0].owed_usd), 0);
});

test("patient totals include more than 100 visits and exclude future or unbilled debt", async () => {
  const { rows } = await db.query("select * from public.patient_visit_summary($1)", [id(260)]);
  assert.equal(Number(rows[0].appointments), 115);
  assert.equal(Number(rows[0].owed_usd), 1104);
  await db.exec("set test.collect = 'false'");
  const doctor = await db.query("select * from public.patient_visit_summary($1)", [id(260)]);
  assert.equal(Number(doctor.rows[0].appointments), 115);
  assert.equal(doctor.rows[0].owed_usd, null);
});

test("anonymous requests cannot execute any new patient or report RPC", async () => {
  await db.exec("reset role; set role anon");
  for (const sql of [
    "select * from public.search_patients_page()",
    "select * from public.search_lab_reports_page()",
    `select * from public.patient_visit_summary('${id(260)}')`,
  ]) {
    await assert.rejects(db.query(sql), (error) => error.code === "42501");
  }
});
