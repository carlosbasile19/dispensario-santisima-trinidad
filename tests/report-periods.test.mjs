import assert from "node:assert/strict";
import test from "node:test";

import { periodOf, shortRange, slotTick, slotsOf, stepPeriod } from "../src/lib/crm/reports.ts";

test("each period covers its whole week, month, quarter or year", () => {
  assert.deepEqual(pick(periodOf("semana", "2026-11-12")), ["2026-11-09", "2026-11-15", "day"]);
  assert.deepEqual(pick(periodOf("semana", "2026-11-15")), ["2026-11-09", "2026-11-15", "day"], "Sunday ends the week");
  assert.deepEqual(pick(periodOf("mes", "2026-02-10")), ["2026-02-01", "2026-02-28", "day"]);
  assert.deepEqual(pick(periodOf("mes", "2028-02-10")), ["2028-02-01", "2028-02-29", "day"], "leap year");
  assert.deepEqual(pick(periodOf("trimestre", "2026-11-12")), ["2026-10-01", "2026-12-31", "week"]);
  assert.deepEqual(pick(periodOf("ano", "2026-11-12")), ["2026-01-01", "2026-12-31", "month"]);
});

test("stepping back and forth crosses months and years", () => {
  assert.equal(stepPeriod(periodOf("mes", "2026-01-31"), -1).from, "2025-12-01");
  assert.equal(stepPeriod(periodOf("mes", "2026-01-31"), 1).to, "2026-02-28");
  assert.equal(stepPeriod(periodOf("semana", "2026-12-30"), 1).from, "2027-01-04");
  assert.equal(stepPeriod(periodOf("trimestre", "2026-02-01"), -1).from, "2025-10-01");
  assert.equal(stepPeriod(periodOf("ano", "2026-06-01"), -1).label, "2025");
});

test("comparisons and labels read naturally", () => {
  assert.equal(periodOf("mes", "2026-11-12").label, "noviembre de 2026");
  assert.equal(periodOf("mes", "2026-11-12").versus, "octubre");
  assert.equal(periodOf("mes", "2026-01-12").versus, "diciembre de 2025");
  assert.equal(periodOf("semana", "2026-11-12").label, "9 al 15 de noviembre de 2026");
  assert.equal(periodOf("semana", "2026-12-02").label, "30 de noviembre al 6 de diciembre de 2026");
  assert.equal(periodOf("trimestre", "2026-11-12").label, "4.º trimestre de 2026");
  assert.equal(periodOf("trimestre", "2026-02-12").versus, "el 4.º trimestre de 2025");
});

test("chart slots match what accounting_report returns", () => {
  assert.equal(slotsOf(periodOf("mes", "2026-11-12")).length, 30);
  assert.equal(slotsOf(periodOf("semana", "2026-11-12")).length, 7);
  const quarter = slotsOf(periodOf("trimestre", "2026-11-12"));
  assert.equal(quarter[0], "2026-09-28");
  assert.equal(quarter.at(-1), "2026-12-28");
  assert.deepEqual(slotsOf(periodOf("ano", "2026-11-12")).slice(0, 2), ["2026-01-01", "2026-02-01"]);
  assert.equal(slotTick("2026-11-09", "semana"), "lun 9");
  assert.equal(slotTick("2026-11-01", "ano"), "nov");
});

test("to-date ranges stay short", () => {
  assert.equal(shortRange("2026-10-01", "2026-10-12"), "1–12 oct");
  assert.equal(shortRange("2026-07-01", "2026-08-12"), "1 jul–12 ago");
  assert.equal(shortRange("2025-01-01", "2025-11-12", true), "1 ene–12 nov 2025");
  assert.equal(shortRange("2026-11-02", "2026-11-02"), "2 nov");
});

const pick = (p) => [p.from, p.to, p.bucket];
