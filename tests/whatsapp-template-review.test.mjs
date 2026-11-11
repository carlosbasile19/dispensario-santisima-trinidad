import "../scripts/lib/load-typescript.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { templateReviewAction } = await import("../src/lib/whatsapp/template-review.ts");
const { saveTemplateStatuses } = await import("../src/lib/whatsapp/template-status.ts");
const { TEMPLATE_LANGUAGE, TEMPLATE_TTL_SECONDS, TEMPLATES, templateComponents, labResultsParams } = await import("../src/lib/whatsapp/templates.ts");
const { listTemplates, updateTemplate, ZernioError } = await import("../src/lib/whatsapp/zernio.ts");

test("only missing and rejected templates can be submitted for review", () => {
  assert.equal(templateReviewAction(undefined), "create");
  assert.equal(templateReviewAction("REJECTED"), "update");
  for (const status of ["PENDING", "APPROVED", "IN_APPEAL", "PAUSED", "DISABLED", "PENDING_DELETION", "UNKNOWN"]) {
    assert.equal(templateReviewAction(status), null, status);
  }
});

test("lab review retains a PDF header and four parameters matching real delivery", () => {
  const samplePdfUrl = "https://clinic.test/laboratorio/informe-de-ejemplo.pdf";
  const components = templateComponents("lab_results", { samplePdfUrl });
  assert.deepEqual(components[0], { type: "header", format: "document", example: { header_handle: [samplePdfUrl] } });
  const body = components.find((component) => component.type === "body");
  assert.deepEqual([...body.text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => match[1]), ["1", "2", "3", "4"]);
  assert.equal(body.example.body_text[0].length, 4);
  const params = labResultsParams({ firstName: "Ana María", sampledDay: "2026-11-11", keyHint: "tu número de cédula, solo los números", signer: "Lcdo. Ejemplo" });
  assert.equal(params.length, 4);
  assert.equal(params[0], "Ana");
  assert.equal(params[2], "tu número de cédula, solo los números");
});

test("resubmission patches the exact language with lowercase components and preserves Meta's response", async (t) => {
  const components = templateComponents("lab_results", { samplePdfUrl: "https://clinic.test/sample.pdf" });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.href, `https://zernio.com/api/v1/whatsapp/templates/${TEMPLATES.lab_results.name}`);
    assert.equal(init.method, "PATCH");
    assert.equal(init.headers.Authorization, "Bearer test-key");
    assert.equal(url.search, "");
    assert.deepEqual(JSON.parse(init.body), { accountId: "clinic-account", language: "es", components, message_send_ttl_seconds: 43200 });
    return Response.json({ success: true, template: { id: "meta-id", status: "PENDING" } });
  });
  const result = await updateTemplate("test-key", { accountId: "clinic-account", name: TEMPLATES.lab_results.name, language: TEMPLATE_LANGUAGE, components, ttlSeconds: TEMPLATE_TTL_SECONDS });
  assert.equal(result.id, "meta-id");
  assert.equal(result.name, TEMPLATES.lab_results.name);
  assert.equal(result.language, "es");
  assert.equal(result.status, "PENDING");
  assert.equal(result.reason, null);
});

test("a stale rejected PATCH response is never reported as pending or retried", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ success: true, template: { id: "meta-id", status: "REJECTED", rejected_reason: "INCORRECT_CATEGORY" } });
  });
  const result = await updateTemplate("test-key", { accountId: "clinic-account", name: "lab", language: "es", components: [] });
  assert.equal(result.status, "REJECTED");
  assert.equal(result.reason, "INCORRECT_CATEGORY");
  assert.equal(requests, 1);
});

test("template reads retain rejection details and clear stale reasons after acceptance", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ templates: [
    { id: "a", name: "lab", language: "es", status: "rejected", rejected_reason: "TAG_CONTENT_MISMATCH" },
    { id: "b", name: "lab", language: "en", status: "approved", rejected_reason: "INCORRECT_CATEGORY" },
  ] }));
  const templates = await listTemplates("test-key", "clinic-account");
  assert.equal(templates[0].status, "REJECTED");
  assert.equal(templates[0].reason, "TAG_CONTENT_MISMATCH");
  assert.equal(templates[1].reason, null);
});

test("provider rejection propagates its status and codes without retrying", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ error: "Template cannot be edited", code: "platform_api_error", platformError: { code: 100 } }, { status: 400 });
  });
  await assert.rejects(updateTemplate("test-key", { accountId: "clinic-account", name: "lab", language: "es", components: [] }), (error) =>
    error instanceof ZernioError && error.status === 400 && error.code === "platform_api_error" && error.platformCode === "100");
  assert.equal(requests, 1);
});

test("status sync clears resolved rejections without erasing webhook details omitted by the provider", async () => {
  const saved = new Map([
    ["approved", { reason: "INCORRECT_CATEGORY" }],
    ["pending", { reason: "INCORRECT_CATEGORY" }],
    ["rejected", { reason: "INCORRECT_CATEGORY" }],
  ]);
  const batches = [];
  const admin = { from: () => ({ upsert: async (rows) => {
    batches.push(rows);
    const keys = new Set(rows.flatMap(Object.keys));
    for (const row of rows) {
      const values = Object.fromEntries([...keys].map((key) => [key, row[key] ?? null]));
      saved.set(row.name, { ...saved.get(row.name), ...values });
    }
    return { error: null };
  } }) };
  await saveTemplateStatuses(admin, [
    { id: "a", name: "approved", language: "es", status: "APPROVED", reason: null },
    { id: "b", name: "pending", language: "es", status: "PENDING", reason: null },
    { id: "c", name: "rejected", language: "es", status: "REJECTED", reason: null },
    { id: "d", name: "known", language: "es", status: "REJECTED", reason: "TAG_CONTENT_MISMATCH" },
  ]);
  assert.equal(batches.length, 2);
  assert.equal(saved.get("approved").reason, null);
  assert.equal(saved.get("pending").reason, null);
  assert.equal(saved.get("rejected").reason, "INCORRECT_CATEGORY");
  assert.equal(saved.get("known").reason, "TAG_CONTENT_MISMATCH");
});

test("a status persistence failure does not report success", async () => {
  const admin = { from: () => ({ upsert: async () => ({ error: { message: "unavailable" } }) }) };
  await assert.rejects(saveTemplateStatuses(admin, [{ name: "lab", language: "es", status: "PENDING", reason: null }]), /whatsapp_templates: unavailable/);
});
