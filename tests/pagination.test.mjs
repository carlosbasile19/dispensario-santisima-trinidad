import assert from "node:assert/strict";
import test from "node:test";

import { MAX_PAGE, PAGE_SIZE, pageHref, pageNumber } from "../src/lib/crm/pagination.ts";

test("page query parameters cannot create negative, fractional, or unbounded SQL offsets", () => {
  for (const value of [undefined, "", "0", "-3", "1.5", "1e5", "Infinity", "99999999999999999", "1;drop table patients"]) {
    assert.equal(pageNumber(value), 1, String(value));
  }
  assert.equal(pageNumber(["3", "9"]), 3);
  assert.equal(pageNumber("999999"), MAX_PAGE);
  assert.ok((pageNumber("999999") - 1) * PAGE_SIZE < 1_000_000);
});

test("pagination preserves encoded patient searches and tabs without interpreting query text", () => {
  const text = "María & José?estado=validados#x";
  const url = new URL(pageHref("/dashboard/laboratorio", { q: text, estado: "borradores" }, 3), "https://clinic.test");
  assert.equal(url.pathname, "/dashboard/laboratorio");
  assert.equal(url.searchParams.get("q"), text);
  assert.equal(url.searchParams.get("estado"), "borradores");
  assert.equal(url.searchParams.get("pagina"), "3");
  assert.equal(url.hash, "");
});

test("a new search resets pagination and drops every empty filter", () => {
  assert.equal(pageHref("/dashboard/pacientes", { q: "", paciente: "", pagina: "9" }, 1), "/dashboard/pacientes");
});

test("patient history and upcoming pagination preserve each other's page", () => {
  const url = new URL(pageHref("/dashboard/pacientes/id", { citas: "3", historial: "6" }, 1, "historial"), "https://clinic.test");
  assert.equal(url.searchParams.get("citas"), "3");
  assert.equal(url.searchParams.has("historial"), false);
});
