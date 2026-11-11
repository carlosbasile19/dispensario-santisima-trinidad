import assert from "node:assert/strict";
import test from "node:test";

import { performancePath } from "../src/lib/performance-path.ts";
import { SlowSpanProcessor } from "../src/lib/slow-span-processor.ts";

test("performance paths remove identifiers, searches, fragments and unknown paths", () => {
  assert.equal(performancePath("https://clinic.test/dashboard/pacientes/patient-123?q=Maria#notes"), "/dashboard/pacientes/[id]");
  assert.equal(performancePath("/dashboard/laboratorio/report-123/pdf?descargar=1"), "/dashboard/laboratorio/[id]/pdf");
  assert.equal(performancePath("/agendar/doctor-name?phone=123"), "/agendar/[slug]");
  assert.equal(performancePath("/dashboard/pacientes?q=Maria"), "/dashboard/pacientes");
  assert.equal(performancePath("/dashboard/pacientes/nuevo"), "/dashboard/pacientes/nuevo");
  assert.equal(performancePath("/imprimir/laboratorio/report-123"), "/imprimir/laboratorio/[id]");
  assert.equal(performancePath("/unexpected/patient-123"), "/other");
  assert.equal(performancePath("/dashboard/"), "/dashboard");
});

test("slow span logs contain timings and trace IDs, never URLs or clinical data", (t) => {
  const messages = [];
  t.mock.method(console, "info", (message) => messages.push(JSON.parse(message)));
  const span = {
    duration: [1, 234_500_000],
    name: "GET /dashboard/pacientes/private-patient?search=Maria",
    attributes: { "next.span_type": "AppRender.fetch", "http.url": "https://clinic.test?patient=Maria" },
    status: { code: 2, message: "Patient Maria not found" },
    events: [{ name: "clinical details" }],
    spanContext: () => ({ traceId: "trace", spanId: "span" }),
  };
  new SlowSpanProcessor().onEnd(span);
  assert.deepEqual(messages, [{
    event: "slow_span", operation: "AppRender.fetch", durationMs: 1235,
    traceId: "trace", spanId: "span", status: 2,
  }]);
  new SlowSpanProcessor().onEnd({ ...span, duration: [0, 999_000_000] });
  assert.equal(messages.length, 1);
  new SlowSpanProcessor().onEnd({ ...span, attributes: { "next.span_type": "Patient Maria" } });
  assert.equal(messages[1].operation, "request");
});
