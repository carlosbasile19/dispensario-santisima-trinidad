import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { zernioConfig } from "@/lib/whatsapp/config";
import { TEMPLATE_LANGUAGE, TEMPLATES, labResultsParams } from "@/lib/whatsapp/templates";
import { sendTemplate, ZernioError } from "@/lib/whatsapp/zernio";
import { pdfFileName } from "./config";
import { getLabReport, type LabReport } from "./data";
import { stampDay } from "./format";
import { pdfKey } from "./pdf-key";
import { reportNumber } from "./report";
import { signatureFor } from "./signature";
import type { AutoSend } from "./types";

// Sending a validated report from the clinic's WhatsApp number: on its own
// when the report is validated (whatsapp_settings.send_lab_results), or by
// hand from the report. The PDF is locked with a key the patient knows
// (pdf-key.ts) and uploaded to the private bucket lab-reports. Meta
// downloads it once from a signed link that expires in a few hours, and the
// daily job deletes the copy after two days. The message itself carries no
// result: only the first name, the day of the sample, which key opens the
// PDF and who validated it. The webhook then marks the delivery as delivered,
// read or failed.

const BUCKET = "lab-reports";
const LINK_SECONDS = 6 * 60 * 60;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type WhatsAppReadiness =
  | { ready: true; phone: string; keyLabel: string }
  | { ready: false; reason: string; fixable?: "patient" | "settings" };

/** The record the PDF's key and the phone come from: today's, else the copy made at validation. */
const keyOf = (report: LabReport) => pdfKey(report.livePatient ?? report.patient);

/**
 * Whether this report can go out from the clinic's number, and if not why
 * (in Spanish, for the member). Reads as the service role, after the caller
 * has checked the member sees the report. `beforeValidation` asks about a
 * draft that is about to be validated.
 */
export async function whatsAppReadiness(
  report: LabReport,
  admin: Admin | null = createAdminClient(),
  { beforeValidation = false }: { beforeValidation?: boolean } = {},
): Promise<WhatsAppReadiness> {
  if (report.status !== "final" && !beforeValidation) return { ready: false, reason: "Valida el informe antes de enviarlo." };
  if (!zernioConfig() || !admin) return { ready: false, reason: "WhatsApp no está configurado en el servidor.", fixable: "settings" };
  const [{ data: settings }, { data: template }] = await Promise.all([
    admin.from("whatsapp_settings").select("connected, zernio_account_id").maybeSingle(),
    admin.from("whatsapp_templates").select("status").eq("name", TEMPLATES.lab_results.name).eq("language", TEMPLATE_LANGUAGE).maybeSingle(),
  ]);
  if (!settings?.connected || !settings.zernio_account_id) return { ready: false, reason: "El número de WhatsApp del centro no está conectado.", fixable: "settings" };
  if (template?.status !== "APPROVED") {
    return { ready: false, reason: "Meta aún no aprueba la plantilla «Resultados de laboratorio» (Administración › WhatsApp).", fixable: "settings" };
  }
  const patient = report.livePatient;
  if (!patient?.phone_e164) return { ready: false, reason: "El paciente no tiene un celular registrado.", fixable: "patient" };
  const { data: reachable } = await admin.rpc("whatsapp_reachable", { phone: patient.phone_e164 });
  if (!reachable) return { ready: false, reason: "El teléfono del paciente no es un celular que reciba WhatsApp.", fixable: "patient" };
  if (patient.whatsapp_consent !== true) {
    return { ready: false, reason: "El paciente no ha aceptado recibir mensajes por WhatsApp (se registra en su ficha).", fixable: "patient" };
  }
  const key = keyOf(report);
  if (!key) {
    return {
      ready: false,
      reason: "Falta la cédula o la fecha de nacimiento del paciente, que es la clave para abrir el PDF. Regístrala en su ficha.",
      fixable: "patient",
    };
  }
  return { ready: true, phone: patient.phone_e164, keyLabel: key.label };
}

/** What happens on WhatsApp when this draft is validated, for the validation dialog. */
export async function automaticSend(report: LabReport): Promise<AutoSend> {
  const admin = createAdminClient();
  if (!admin) return { will: false, reason: "WhatsApp no está configurado en el servidor." };
  const { data: settings } = await admin.from("whatsapp_settings").select("send_lab_results").maybeSingle();
  if (settings && !settings.send_lab_results) {
    return { will: false, reason: "El envío automático de resultados está pausado (Administración › WhatsApp)." };
  }
  const readiness = await whatsAppReadiness(report, admin, { beforeValidation: true });
  return readiness.ready ? { will: true, phone: readiness.phone } : { will: false, reason: readiness.reason };
}

/**
 * The PDF of a report: as members download it, or locked with `password`
 * for WhatsApp. A validated report carries the signer's signature image.
 */
export async function reportPdf(report: LabReport, { password }: { password?: string } = {}) {
  const [{ renderLabReportPdf }, signature] = await Promise.all([
    import("./pdf/render"),
    report.status === "final" ? signatureFor(report.signer, createAdminClient()) : null,
  ]);
  return renderLabReportPdf(
    {
      number: report.number,
      revision: report.revision,
      status: report.status,
      patient: report.patient,
      facts: report.facts,
      content: report.content,
      signer: report.signer,
      finalizedAt: report.finalizedAt,
      generatedAt: new Date().toISOString(),
      signature,
    },
    { password },
  );
}

type SendResult = { ok: true; message: string } | { ok: false; error: string };

/** Locks the PDF, uploads it, sends the template and logs the delivery. */
async function deliver(
  report: LabReport,
  phone: string,
  admin: Admin,
  { automatic, by }: { automatic: boolean; by: string | null },
): Promise<SendResult> {
  const config = zernioConfig();
  const key = keyOf(report);
  const { data: settings } = await admin.from("whatsapp_settings").select("zernio_account_id").maybeSingle();
  if (!config || !settings?.zernio_account_id || !report.signer || !key) return { ok: false, error: "WhatsApp no está configurado en el servidor." };

  const { data: delivery, error: logError } = await admin
    .from("lab_report_deliveries")
    .insert({ report_id: report.id, channel: "whatsapp", status: "sending", to_phone: phone, automatic, created_by: by })
    .select("id")
    .single();
  if (logError || !delivery) return { ok: false, error: "No se pudo registrar el envío. Inténtalo de nuevo." };

  const fail = async (message: string) => {
    await admin
      .from("lab_report_deliveries")
      .update({ status: "failed", failed_at: new Date().toISOString(), error: message.slice(0, 500) })
      .eq("id", delivery.id);
    return { ok: false as const, error: message };
  };

  try {
    const pdf = await reportPdf(report, { password: key.password });
    const path = `whatsapp/${stampDay(new Date().toISOString())}/${randomUUID()}.pdf`;
    // cacheControl 0: Meta takes this copy once; nothing should keep it.
    const upload = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
    if (upload.error) return fail("No se pudo preparar el PDF para WhatsApp.");
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, LINK_SECONDS);
    if (!signed?.signedUrl) return fail("No se pudo preparar el enlace del PDF.");

    const result = await sendTemplate(config.apiKey, {
      accountId: settings.zernio_account_id,
      toE164: phone,
      name: TEMPLATES.lab_results.name,
      language: TEMPLATE_LANGUAGE,
      params: labResultsParams({
        firstName: report.patient.first_name,
        sampledDay: report.content.sampledDay,
        keyHint: key.hint,
        signer: report.signer.name,
      }),
      document: { link: signed.signedUrl, filename: pdfFileName(reportNumber(report.number)) },
    });
    await admin
      .from("lab_report_deliveries")
      .update({ status: "sent", wamid: result.messageId || null })
      .eq("id", delivery.id);
    return { ok: true, message: `Resultados enviados por WhatsApp al ${phone}.` };
  } catch (error) {
    const message = error instanceof ZernioError ? `WhatsApp no aceptó el mensaje: ${error.message}` : "No se pudo enviar por WhatsApp.";
    console.error("lab WhatsApp send failed", report.id, error instanceof Error ? error.message : error);
    return fail(message);
  }
}

/** Sends the validated report by hand (the member `by` pressed the button). */
export async function sendLabResults(reportId: string, { by = null }: { by?: string | null } = {}): Promise<SendResult> {
  // RLS: the member must see the report.
  const report = await getLabReport(reportId);
  if (!report) return { ok: false, error: "No encontramos este informe." };
  const admin = createAdminClient();
  const readiness = await whatsAppReadiness(report, admin);
  if (!readiness.ready || !admin) return { ok: false, error: readiness.ready ? "WhatsApp no está configurado en el servidor." : readiness.reason };
  return deliver(report, readiness.phone, admin, { automatic: false, by });
}

/**
 * The automatic send, right after a report is validated: only when the
 * administrators left it on, everything is in place and this revision has
 * not gone out by WhatsApp yet. It never throws: the validation stands
 * either way, and the report page shows what happened.
 */
export async function sendOnValidation(reportId: string): Promise<SendResult | null> {
  try {
    const admin = createAdminClient();
    if (!admin) return null;
    const { data: settings } = await admin.from("whatsapp_settings").select("send_lab_results").maybeSingle();
    if (!settings?.send_lab_results) return null;
    const report = await getLabReport(reportId);
    if (!report || report.status !== "final") return null;
    const { data: earlier } = await admin
      .from("lab_report_deliveries")
      .select("id")
      .eq("report_id", report.id)
      .eq("channel", "whatsapp")
      .eq("revision", report.revision)
      .neq("status", "failed")
      .limit(1);
    if (earlier?.length) return null;
    const readiness = await whatsAppReadiness(report, admin);
    if (!readiness.ready) return null;
    return await deliver(report, readiness.phone, admin, { automatic: true, by: null });
  } catch (error) {
    console.error("lab WhatsApp automatic send failed", reportId, error instanceof Error ? error.message : error);
    return null;
  }
}

/** The daily job's cleanup: copies for WhatsApp older than two days. */
export async function deleteOldWhatsAppPdfs(admin: Admin) {
  const { data: days } = await admin.storage.from(BUCKET).list("whatsapp", { limit: 100 });
  const keepFrom = stampDay(new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString());
  for (const day of days ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.name) || day.name >= keepFrom) continue;
    const { data: files } = await admin.storage.from(BUCKET).list(`whatsapp/${day.name}`, { limit: 1000 });
    const paths = (files ?? []).map((file) => `whatsapp/${day.name}/${file.name}`);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  }
}
