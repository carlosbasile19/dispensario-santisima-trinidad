"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/crm/clinic";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { getViewer } from "@/lib/crm/viewer";
import { sendLabResults } from "@/lib/lab/whatsapp";
import { parseContent } from "@/lib/lab/report";
import { createClient } from "@/lib/supabase/server";

// Laboratorio. Doctors and administrators build and validate reports
// (permissions.labReports); everyone who sees the patient may print, share
// and send a validated one. RLS and the database functions check again.

const NO_BUILD = "Solo los médicos y los administradores preparan informes de laboratorio.";

const BY_HINT: Record<string, string> = {
  empty_report: "Escribe al menos un resultado antes de validar.",
  already_final: "Este informe ya está validado.",
  missing_signer: "Falta el bioanalista que firma: configúralo en Laboratorio.",
  missing_reason: "Escribe por qué se corrige el informe.",
  not_final: "El informe todavía es un borrador.",
  invalid_visit: "Esa cita es de otro paciente.",
};

const labError = (error: { code?: string; hint?: string | null; message?: string } | null, fallback?: string) =>
  (error?.hint && BY_HINT[error.hint]) || dbErrorMessage(error, fallback);

/** sampled day and time in the clinic's zone, as an instant. */
const sampledAt = (day: string, time: string) => new Date(`${day}T${time}:00-04:00`).toISOString();

/** Starts a draft for a patient (and the visit of the sample) and opens it. */
export async function createLabReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.labReports) return { error: NO_BUILD };
  const patient = formData.get("patient");
  const visit = formData.get("appointment");
  if (!isUuid(patient)) return { error: "Elige el paciente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_reports")
    .insert({ patient_id: patient, appointment_id: isUuid(visit) ? visit : null })
    .select("id")
    .single();
  if (error || !data) return { error: labError(error, "No se pudo crear el informe.") };
  redirect(`/dashboard/laboratorio/${data.id}`);
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; error: string; conflict?: boolean };

/**
 * Autosave of the editor. `expected` is the version the editor started
 * from: if someone else saved in between, nothing is overwritten.
 */
export async function saveLabReport(id: string, raw: unknown, expected: string): Promise<SaveResult> {
  const viewer = await getViewer();
  if (!viewer.permissions.labReports) return { ok: false, error: NO_BUILD };
  if (!isUuid(id) || typeof expected !== "string") return { ok: false, error: "Informe no válido." };
  const parsed = parseContent(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { content } = parsed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_reports")
    .update({
      sections: content.sections,
      notes: content.notes || null,
      requested_by: content.requestedBy || null,
      patient_type: content.patientType,
      sampled_at: sampledAt(content.sampledDay, content.sampledTime),
    })
    .eq("id", id)
    .eq("status", "draft")
    .eq("updated_at", expected)
    .select("updated_at");
  if (error) return { ok: false, error: labError(error) };
  if (!data?.length) {
    const { data: current } = await supabase.from("lab_reports").select("status").eq("id", id).maybeSingle();
    if (!current) return { ok: false, error: "No encontramos este informe." };
    if (current.status !== "draft") return { ok: false, error: "El informe ya fue validado: recarga la página.", conflict: true };
    return { ok: false, error: "Otro miembro guardó cambios en este informe. Recarga la página para ver la última versión.", conflict: true };
  }
  return { ok: true, updatedAt: data[0].updated_at };
}

/** Saves the last changes and validates (signs) the report. */
export async function validateLabReport(id: string, raw: unknown, expected: string): Promise<SaveResult> {
  const saved = await saveLabReport(id, raw, expected);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_lab_report", { report: id });
  if (error) return { ok: false, error: labError(error, "No se pudo validar el informe.") };
  refresh();
  return saved;
}

/** Reopens a validated report as its next revision, with the reason on record. */
export async function reopenLabReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.labReports) return { error: NO_BUILD };
  const id = formData.get("report");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(id)) return { error: "Informe no válido." };
  if (reason.length < 3) return { error: "Escribe por qué se corrige el informe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_lab_report", { report: id, reason: reason.slice(0, 300) });
  if (error) return { error: labError(error) };
  refresh();
  return { message: "Informe reabierto para corregirlo." };
}

/** Discards a draft that was never validated. */
export async function deleteLabReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.labReports) return { error: NO_BUILD };
  const id = formData.get("report");
  if (!isUuid(id)) return { error: "Informe no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lab_reports").delete().eq("id", id).select("id");
  if (error) return { error: labError(error) };
  if (!data?.length) return { error: "Este borrador ya no se puede descartar." };
  redirect("/dashboard/laboratorio");
}

/** Notes that the member printed, downloaded or shared the validated report. */
export async function logLabDelivery(id: string, channel: "print" | "share" | "download") {
  await getViewer();
  if (!isUuid(id) || !["print", "share", "download"].includes(channel)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("lab_report_deliveries").insert({ report_id: id, channel });
  if (error) console.error("lab delivery log failed", error.code, error.message);
}

/** Sends the validated report's PDF from the clinic's WhatsApp number. */
export async function sendLabReportWhatsApp(_prev: FormState, formData: FormData): Promise<FormState> {
  await getViewer();
  const id = formData.get("report");
  if (!isUuid(id)) return { error: "Informe no válido." };
  const result = await sendLabResults(id);
  refresh();
  return result.ok ? { message: result.message } : { error: result.error };
}

/** The bioanalyst whose name and registrations sign the reports (administrators). */
export async function saveLabSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (viewer.role !== "admin") return { error: "Solo un administrador cambia quién firma los informes." };
  const field = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);
  const name = field("signer_name", 120);
  const title = field("signer_title", 80);
  if (name.length < 3) return { error: "Escribe el nombre del bioanalista." };
  if (title.length < 3) return { error: "Escribe su título." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_settings")
    .update({
      signer_name: name,
      signer_title: title,
      signer_id_number: field("signer_id_number", 40) || null,
      signer_registry: field("signer_registry", 80) || null,
      signer_college: field("signer_college", 80) || null,
    })
    .eq("id", true);
  if (error) return { error: labError(error) };
  refresh();
  return { message: "Firma guardada. Se usará en los próximos informes que se validen." };
}
