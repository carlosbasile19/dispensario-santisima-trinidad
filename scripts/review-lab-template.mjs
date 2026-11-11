// Inspect by default. --submit creates the missing lab variant or corrects a
// rejected one. Run in an authorized server environment with its own secrets.
import "./lib/load-typescript.mjs";
import { createClient } from "@supabase/supabase-js";

const { TEMPLATE_LANGUAGE, TEMPLATE_TTL_SECONDS, TEMPLATES, templateComponents } = await import("../src/lib/whatsapp/templates.ts");
const { templateReviewAction } = await import("../src/lib/whatsapp/template-review.ts");
const { saveTemplateStatuses } = await import("../src/lib/whatsapp/template-status.ts");
const { createTemplate, listTemplates, listWhatsAppAccounts, updateTemplate } = await import("../src/lib/whatsapp/zernio.ts");

const submit = process.argv.includes("--submit");
const name = TEMPLATES.lab_results.name;
for (const key of ["ZERNIO_API_KEY", "ZERNIO_PROFILE_ID", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SITE_URL"]) {
  if (!process.env[key] || process.env[key] === "[SENSITIVE]") throw new Error(`Missing ${key}`);
}
const apiKey = process.env.ZERNIO_API_KEY;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: settings, error: settingsError } = await admin.from("whatsapp_settings").select("connected,zernio_account_id").single();
if (settingsError) throw settingsError;
if (!settings?.connected || !settings.zernio_account_id) throw new Error("Clinic WhatsApp account is not connected");
const accountId = settings.zernio_account_id;
const accounts = await listWhatsAppAccounts(apiKey, process.env.ZERNIO_PROFILE_ID);
if (!accounts.some((account) => account.id === accountId && account.active)) throw new Error("Connected account does not belong to the configured clinic profile");

const read = async () => (await listTemplates(apiKey, accountId)).find((t) => t.name === name && t.language === TEMPLATE_LANGUAGE);
const existing = await read();
console.log("Lab template before review:", JSON.stringify(existing ?? { name, status: "MISSING" }));
const action = templateReviewAction(existing?.status);
if (!submit || !action) {
  if (submit && existing) await saveTemplateStatuses(admin, [existing]);
  console.log(submit ? "No submission needed for the current status." : "Read-only check. Pass --submit to submit a missing or rejected variant.");
} else {
  if (existing?.category && existing.category !== "UTILITY") throw new Error(`Existing category is ${existing.category}; requires a separate category review`);
  const samplePdfUrl = new URL("/laboratorio/informe-de-ejemplo.pdf", process.env.NEXT_PUBLIC_SITE_URL).href;
  if (!samplePdfUrl.startsWith("https://")) throw new Error("Review sample must use public HTTPS");
  const sample = await fetch(samplePdfUrl, { signal: AbortSignal.timeout(20_000) });
  const bytes = Buffer.from(await sample.arrayBuffer());
  if (!sample.ok || !sample.headers.get("content-type")?.includes("application/pdf") || bytes.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error(`Sample PDF is not downloadable: HTTP ${sample.status}`);
  }
  console.log("Sample PDF verified:", JSON.stringify({ status: sample.status, bytes: bytes.length }));
  const review = action === "update" ? updateTemplate : createTemplate;
  const result = await review(apiKey, {
    accountId, name, language: TEMPLATE_LANGUAGE, category: "UTILITY",
    components: templateComponents("lab_results", { samplePdfUrl }), ttlSeconds: TEMPLATE_TTL_SECONDS,
  });
  console.log("Meta submission response:", JSON.stringify(result));
  // A readback is verification, not a second submission. Webhooks may update it later.
  const current = await read();
  if (!current) throw new Error("Submitted template missing from Meta readback");
  await saveTemplateStatuses(admin, [current]);
  console.log("Verified lab template:", JSON.stringify(current));
  if (!["PENDING", "APPROVED", "IN_APPEAL"].includes(current.status)) process.exitCode = 2;
}
