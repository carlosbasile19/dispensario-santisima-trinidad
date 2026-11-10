import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { zernioConfig } from "@/lib/whatsapp/config";
import { TEMPLATE_LANGUAGE, TEMPLATES, labResultsParams } from "@/lib/whatsapp/templates";
import { sendTemplate, ZernioError } from "@/lib/whatsapp/zernio";
import { pdfFileName } from "./config";
import { getLabReport, type LabReport } from "./data";
import { stampDay } from "./format";
import { renderLabReportPdf } from "./pdf/render";
import { reportNumber } from "./report";

// Sending a validated report from the clinic's WhatsApp number. The PDF is
// uploaded to the private bucket lab-reports and Meta downloads it once from a
// signed link that expires in a few hours; the daily job deletes the copy
// after two days. The message itself carries no result, only the first name,
// the day of the sample and who validated it.

const BUCKET = "lab-reports";
const LINK_SECONDS = 6 * 60 * 60;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type WhatsAppReadiness =
  | { ready: true; phone: string }
  | { ready: false; reason: string; fixable?: "patient" | "settings" };

/**
 * Whether this report can go out from the clinic's number now, and if not
 * why (in Spanish, for the member). Reads as the service role, after the
 * caller has checked the member sees the report.
 */
export async function whatsAppReadiness(report: LabReport, admin: Admin | null = createAdminClient()): Promise<WhatsAppReadiness> {
  if (report.status !== "final") return { ready: false, reason: "Valida el informe antes de enviarlo." };
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
  return { ready: true, phone: patient.phone_e164 };
}

/** The PDF of a report, as the member sees it. */
export function reportPdf(report: LabReport) {
  return renderLabReportPdf({
    number: report.number,
    revision: report.revision,
    status: report.status,
    patient: report.patient,
    facts: report.facts,
    content: report.content,
    signer: report.signer,
    finalizedAt: report.finalizedAt,
    generatedAt: new Date().toISOString(),
  });
}

export async function sendLabResults(reportId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  // RLS: the member must see the report.
  const report = await getLabReport(reportId);
  if (!report) return { ok: false, error: "No encontramos este informe." };
  const admin = createAdminClient();
  const readiness = await whatsAppReadiness(report, admin);
  if (!readiness.ready || !admin) return { ok: false, error: readiness.ready ? "WhatsApp no está configurado en el servidor." : readiness.reason };
  const config = zernioConfig();
  const { data: settings } = await admin.from("whatsapp_settings").select("zernio_account_id").maybeSingle();
  if (!config || !settings?.zernio_account_id || !report.signer) return { ok: false, error: "WhatsApp no está configurado en el servidor." };

  const { data: delivery, error: logError } = await admin
    .from("lab_report_deliveries")
    .insert({ report_id: report.id, channel: "whatsapp", status: "sending", to_phone: readiness.phone })
    .select("id")
    .single();
  if (logError || !delivery) return { ok: false, error: "No se pudo registrar el envío. Inténtalo de nuevo." };

  const fail = async (message: string) => {
    await admin.from("lab_report_deliveries").update({ status: "failed", error: message.slice(0, 500) }).eq("id", delivery.id);
    return { ok: false as const, error: message };
  };

  try {
    const pdf = await reportPdf(report);
    const path = `whatsapp/${stampDay(new Date().toISOString())}/${randomUUID()}.pdf`;
    const upload = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (upload.error) return fail("No se pudo preparar el PDF para WhatsApp.");
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, LINK_SECONDS);
    if (!signed?.signedUrl) return fail("No se pudo preparar el enlace del PDF.");

    const result = await sendTemplate(config.apiKey, {
      accountId: settings.zernio_account_id,
      toE164: readiness.phone,
      name: TEMPLATES.lab_results.name,
      language: TEMPLATE_LANGUAGE,
      params: labResultsParams({ firstName: report.patient.first_name, sampledDay: report.content.sampledDay, signer: report.signer.name }),
      document: { link: signed.signedUrl, filename: pdfFileName(reportNumber(report.number)) },
    });
    await admin
      .from("lab_report_deliveries")
      .update({ status: "sent", wamid: result.messageId || null })
      .eq("id", delivery.id);
    return { ok: true, message: `Resultados enviados por WhatsApp al ${readiness.phone}.` };
  } catch (error) {
    const message = error instanceof ZernioError ? `WhatsApp no aceptó el mensaje: ${error.message}` : "No se pudo enviar por WhatsApp.";
    console.error("lab WhatsApp send failed", report.id, error instanceof Error ? error.message : error);
    return fail(message);
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
