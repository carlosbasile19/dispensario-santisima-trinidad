import "server-only";

import { localDay, localTime } from "@/lib/crm/clinic";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { patientFacts, type PatientFacts } from "./reference";
import { storedSections } from "./report";
import { PATIENT_TYPES, type PatientType, type ReportContent, type ReportPatient, type ReportSigner } from "./types";

// Reads of the laboratory's reports, as the signed-in member (RLS decides
// what comes back: a doctor only gets their own patients' reports).

type Status = Database["public"]["Enums"]["lab_report_status"];

const REPORT_FIELDS =
  "id, number, status, revision, patient_id, appointment_id, patient_type, sampled_at, requested_by, notes, sections, summary, patient_snapshot, signer, finalized_at, finalized_by, reopened_at, reopen_reason, created_by, created_at, updated_at";
const PATIENT_FIELDS = "id, first_name, last_name, id_type, id_number, birth_date, sex, phone, phone_e164, whatsapp_consent";

export type LabPatient = ReportPatient & {
  id: string;
  phone: string | null;
  phone_e164: string | null;
  whatsapp_consent: boolean | null;
};

export type LabReport = {
  id: string;
  number: number;
  status: Status;
  revision: number;
  patientId: string;
  appointmentId: string | null;
  content: ReportContent;
  summary: string[];
  /** The patient as the report identifies them: the copy made at validation, else today's record. */
  patient: ReportPatient;
  /** Today's record (phone and WhatsApp consent for sending). */
  livePatient: LabPatient | null;
  signer: ReportSigner | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Sex and age on the day of the sample, which pick the reference intervals. */
  facts: PatientFacts;
};

const asPatient = (value: unknown): ReportPatient | null => {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Record<string, unknown>;
  const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : null);
  return {
    first_name: text("first_name") ?? "",
    last_name: text("last_name") ?? "",
    id_type: text("id_type"),
    id_number: text("id_number"),
    birth_date: text("birth_date"),
    sex: text("sex"),
  };
};

const asSigner = (value: unknown): ReportSigner | null => {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  const text = (key: string) => (typeof s[key] === "string" && (s[key] as string).trim() ? (s[key] as string) : null);
  const name = text("name");
  return name ? { name, title: text("title") ?? "", id_number: text("id_number"), registry: text("registry"), college: text("college") } : null;
};

type Row = Database["public"]["Tables"]["lab_reports"]["Row"] & { patients: LabPatient | null };

function toReport(row: Row): LabReport {
  const live = row.patients;
  const snapshot = row.status === "final" ? asPatient(row.patient_snapshot) : null;
  const patient: ReportPatient = snapshot ??
    (live
      ? { first_name: live.first_name, last_name: live.last_name, id_type: live.id_type, id_number: live.id_number, birth_date: live.birth_date, sex: live.sex }
      : { first_name: "Paciente", last_name: "", id_type: null, id_number: null, birth_date: null, sex: null });
  const sampledDay = localDay(row.sampled_at);
  const patientType = (PATIENT_TYPES as readonly string[]).includes(row.patient_type) ? (row.patient_type as PatientType) : "contado";
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    revision: row.revision,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    content: {
      sections: storedSections(row.sections),
      notes: row.notes ?? "",
      requestedBy: row.requested_by ?? "",
      patientType,
      sampledDay,
      sampledTime: localTime(row.sampled_at),
    },
    summary: row.summary ?? [],
    patient,
    livePatient: live,
    signer: asSigner(row.signer),
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    reopenedAt: row.reopened_at,
    reopenReason: row.reopen_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    facts: patientFacts(patient, sampledDay),
  };
}

/** One report the member may see, or null. */
export async function getLabReport(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lab_reports")
    .select(`${REPORT_FIELDS}, patients(${PATIENT_FIELDS})`)
    .eq("id", id)
    .maybeSingle();
  return data ? toReport(data as unknown as Row) : null;
}

export type LabSettings = Database["public"]["Tables"]["lab_settings"]["Row"];

export async function getLabSettings(): Promise<LabSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("lab_settings").select("*").maybeSingle();
  return data;
}

/** The signer as a validated report will carry it. */
export const signerOf = (settings: LabSettings | null): ReportSigner | null =>
  settings
    ? {
        name: settings.signer_name,
        title: settings.signer_title,
        id_number: settings.signer_id_number,
        registry: settings.signer_registry,
        college: settings.signer_college,
      }
    : null;

export type Delivery = Database["public"]["Tables"]["lab_report_deliveries"]["Row"];

export async function getDeliveries(reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lab_report_deliveries")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export type ReportListItem = {
  id: string;
  number: number;
  status: Status;
  revision: number;
  summary: string[];
  sampledAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  patient: { id: string; first_name: string; last_name: string; id_type: string | null; id_number: string | null } | null;
  delivered: string[];
};

/** The latest reports, newest first, optionally only drafts or validated ones and of some patients. */
export async function listLabReports({ status, patientIds, limit = 60 }: { status?: Status; patientIds?: string[]; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("lab_reports")
    .select("id, number, status, revision, summary, sampled_at, updated_at, finalized_at, patients(id, first_name, last_name, id_type, id_number), lab_report_deliveries(channel, status)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  if (patientIds) query = query.in("patient_id", patientIds.length ? patientIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query;
  return (data ?? []).map(
    (row): ReportListItem => ({
      id: row.id,
      number: row.number,
      status: row.status,
      revision: row.revision,
      summary: row.summary ?? [],
      sampledAt: row.sampled_at,
      updatedAt: row.updated_at,
      finalizedAt: row.finalized_at,
      patient: row.patients,
      delivered: [
        ...new Set(
          (row.lab_report_deliveries ?? [])
            .filter((d) => d.status === "done" || d.status === "sent")
            .map((d) => d.channel),
        ),
      ],
    }),
  );
}

/** How many drafts and validated reports the member sees. */
export async function countLabReports() {
  const supabase = await createClient();
  const [drafts, finals] = await Promise.all([
    supabase.from("lab_reports").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("lab_reports").select("id", { count: "exact", head: true }).eq("status", "final"),
  ]);
  return { drafts: drafts.count ?? 0, finals: finals.count ?? 0 };
}
