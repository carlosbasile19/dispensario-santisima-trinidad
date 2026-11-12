import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// An isolated Postgres with the tables accounting_report reads, filled with a
// small, known month. No production connection or patient records are used.
const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create type public.service_area as enum ('medicina', 'odontologia', 'bioanalisis');
    create type public.appointment_status as enum ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
    create function public.clinic_today() returns date language sql stable as $$ select date '2026-11-12' $$;
    create function public.can_manage_accounting() returns boolean language sql stable as
      $$ select current_setting('test.admin', true) = 'true' $$;
    create table public.profiles (id uuid primary key, full_name text, email text);
    create table public.services (id uuid primary key, area public.service_area not null, name text not null);
    create table public.patients (id uuid primary key, sex text, birth_date date);
    create table public.suppliers (id uuid primary key, name text not null);
    create table public.appointments (
      id uuid primary key, patient_id uuid not null references public.patients,
      starts_at timestamptz not null,
      starts_on date generated always as ((starts_at at time zone 'America/Caracas')::date) stored,
      status public.appointment_status not null, source text not null default 'desk'
    );
    create table public.appointment_items (
      id serial primary key, appointment_id uuid not null references public.appointments,
      service_id uuid not null references public.services, professional_id uuid references public.profiles,
      price_usd numeric(10, 2) not null
    );
    create table public.payments (
      id serial primary key, appointment_id uuid not null references public.appointments,
      paid_on date not null, method text not null, currency text not null,
      amount_usd numeric(12, 2) not null, amount_bs numeric(16, 2) not null, voided_at timestamptz
    );
    create table public.expenses (
      id serial primary key, spent_on date not null, supplier_id uuid references public.suppliers,
      currency text not null, amount_usd numeric(12, 2) not null, amount_bs numeric(16, 2) not null
    );
    create view public.appointment_balances with (security_invoker = true) as
      select a.id as appointment_id, a.starts_on,
        (coalesce((select sum(price_usd) from public.appointment_items where appointment_id = a.id), 0)
         - coalesce((select sum(amount_usd) from public.payments where appointment_id = a.id and voided_at is null), 0))::numeric(12, 2) as balance_usd
      from public.appointments a;

    insert into public.profiles values ('${id(1)}', 'Dra. Lucía Méndez', 'lucia@test'), ('${id(2)}', '  ', 'pedro@test');
    insert into public.services values
      ('${id(11)}', 'medicina', 'Consulta general'),
      ('${id(12)}', 'odontologia', 'Limpieza'),
      ('${id(13)}', 'bioanalisis', 'Hematología');
    insert into public.suppliers values ('${id(31)}', 'Farmacia Central');
    -- 21: new this month (F, 34). 22: came in October too (M, 8). 23: no sex or birth date.
    insert into public.patients values
      ('${id(21)}', 'F', '1992-05-01'), ('${id(22)}', 'M', '2018-01-01'), ('${id(23)}', null, null);
    insert into public.appointments (id, patient_id, starts_at, status, source) values
      ('${id(40)}', '${id(22)}', '2026-10-20T14:00:00Z', 'completed', 'desk'),
      ('${id(41)}', '${id(21)}', '2026-11-02T14:00:00Z', 'completed', 'online'),   -- Monday
      ('${id(42)}', '${id(22)}', '2026-11-02T15:00:00Z', 'completed', 'desk'),     -- Monday
      ('${id(43)}', '${id(21)}', '2026-11-10T14:00:00Z', 'confirmed', 'desk'),     -- Tuesday, past, not marked
      ('${id(44)}', '${id(23)}', '2026-11-20T14:00:00Z', 'scheduled', 'online'),   -- Friday, upcoming
      ('${id(45)}', '${id(23)}', '2026-11-05T14:00:00Z', 'cancelled', 'desk'),
      ('${id(46)}', '${id(22)}', '2026-11-06T14:00:00Z', 'no_show', 'desk'),
      -- 23:30 on 30 November in Caracas is already 1 December in UTC: still November.
      ('${id(47)}', '${id(21)}', '2026-12-01T03:30:00Z', 'completed', 'desk');
    insert into public.appointment_items (appointment_id, service_id, professional_id, price_usd) values
      ('${id(40)}', '${id(11)}', '${id(1)}', 30),
      ('${id(41)}', '${id(11)}', '${id(1)}', 30),
      ('${id(41)}', '${id(13)}', null, 15),
      ('${id(42)}', '${id(12)}', '${id(2)}', 40),
      ('${id(43)}', '${id(11)}', '${id(1)}', 30),
      ('${id(44)}', '${id(11)}', '${id(1)}', 30),
      ('${id(45)}', '${id(12)}', '${id(2)}', 40),
      ('${id(46)}', '${id(11)}', '${id(1)}', 30),
      ('${id(47)}', '${id(11)}', '${id(1)}', 25);
    insert into public.payments (appointment_id, paid_on, method, currency, amount_usd, amount_bs, voided_at) values
      ('${id(41)}', '2026-11-02', 'zelle', 'USD', 45, 10000, null),
      ('${id(42)}', '2026-11-02', 'pago_movil', 'VES', 20, 4500, null),
      ('${id(42)}', '2026-11-03', 'cashea', 'USD', 10, 2250, null),
      ('${id(42)}', '2026-11-03', 'cash_usd', 'USD', 10, 2250, now()),
      ('${id(40)}', '2026-10-20', 'cash_usd', 'USD', 30, 6000, null);
    insert into public.expenses (spent_on, supplier_id, currency, amount_usd, amount_bs) values
      ('2026-11-04', '${id(31)}', 'VES', 12, 2700),
      ('2026-11-09', null, 'USD', 8, 1800);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261112192634_accounting_report.sql", import.meta.url), "utf8"));
});

after(() => db.close());

const report = async (from, to, bucket) => {
  const { rows } = await db.query("select public.accounting_report($1, $2, $3) as r", [from, to, bucket]);
  return rows[0].r;
};
const asAdmin = (admin) => db.exec(`set test.admin = '${admin}'`);

test("only administrators can read the report", async () => {
  await asAdmin(false);
  await assert.rejects(report("2026-11-01", "2026-11-30", "day"), /Only administrators/);
});

test("the range and the bucket are checked", async () => {
  await asAdmin(true);
  await assert.rejects(report("2026-11-30", "2026-11-01", "day"), /1 to 401 days/);
  await assert.rejects(report("2025-01-01", "2026-12-31", "month"), /1 to 401 days/);
  await assert.rejects(report("2026-11-01", "2026-11-30", "hour"), /Unknown bucket/);
});

test("a month: patients, visits, money and the breakdowns", async () => {
  await asAdmin(true);
  const r = await report("2026-11-01", "2026-11-30", "day");
  const t = r.totals;

  assert.equal(t.patients, 3);
  assert.equal(t.new_patients, 2, "22 came in October, so only 21 and 23 are new");
  assert.equal(t.visits, 5, "cancelled and missed visits are counted apart");
  assert.equal(t.attended, 3);
  assert.equal(t.unmarked, 1);
  assert.equal(t.upcoming, 1);
  assert.equal(t.cancelled, 1);
  assert.equal(t.no_show, 1);
  assert.equal(t.online, 2);
  assert.equal(Number(t.billed_usd), 170);
  assert.equal(Number(t.collected_usd), 75, "the voided payment is left out");
  assert.equal(Number(t.collected_bs), 16750);
  assert.equal(Number(t.received_usd), 45);
  assert.equal(Number(t.received_bs), 4500);
  assert.equal(Number(t.financed_usd), 10);
  assert.equal(Number(t.expenses_usd), 20);
  assert.equal(Number(t.expenses_bs), 4500);
  assert.equal(Number(t.owed_usd), 40, "up to today: 41 is paid, 42 owes 10 (the voided 10 does not count), 43 owes 30");

  assert.equal(r.series.length, 30);
  assert.equal(r.series[0].slot, "2026-11-01");
  const nov2 = r.series.find((s) => s.slot === "2026-11-02");
  assert.deepEqual(
    { patients: nov2.patients, new_patients: nov2.new_patients, visits: nov2.visits, billed: Number(nov2.billed_usd), collected: Number(nov2.collected_usd) },
    { patients: 2, new_patients: 1, visits: 2, billed: 85, collected: 65 },
  );
  assert.equal(r.series.find((s) => s.slot === "2026-11-30").visits, 1, "a late visit stays on its Caracas day");

  assert.deepEqual(r.areas.map((a) => [a.area, a.visits, Number(a.billed_usd)]), [
    ["medicina", 4, 115],
    ["odontologia", 1, 40],
    ["bioanalisis", 1, 15],
  ]);
  assert.equal(r.methods[0].method, "zelle");
  assert.equal(r.methods.length, 3);
  assert.equal(r.services[0].service, "Consulta general");
  assert.equal(r.services[0].count, 4);
  assert.deepEqual(r.professionals.map((p) => p.name), ["Dra. Lucía Méndez", "pedro@test", "Sin asignar"]);
  assert.deepEqual(r.suppliers.map((s) => s.name), ["Farmacia Central", "Sin proveedor"]);
  assert.deepEqual(r.sex, [1, 1, 1]);
  assert.deepEqual(r.ages, [1, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(r.weekdays, [3, 1, 0, 0, 1, 0, 0]);
});

test("weeks start on Monday and months on the 1st", async () => {
  await asAdmin(true);
  const quarter = await report("2026-10-01", "2026-12-31", "week");
  assert.equal(quarter.series[0].slot, "2026-09-28", "the week of 1 October starts on Monday 28 September");
  assert.ok(quarter.series.every((s) => new Date(`${s.slot}T12:00:00Z`).getUTCDay() === 1));

  const year = await report("2026-01-01", "2026-12-31", "month");
  assert.equal(year.series.length, 12);
  assert.equal(year.series[9].visits, 1, "October");
  assert.equal(year.series[10].visits, 5, "November");
  assert.equal(year.totals.new_patients, 3);
});
