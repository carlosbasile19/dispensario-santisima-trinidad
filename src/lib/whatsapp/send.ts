import "server-only";

import { addDays, clinicToday } from "@/lib/crm/clinic";
import { deleteOldWhatsAppPdfs } from "@/lib/lab/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { zernioConfig } from "./config";
import { doctorAlertParams, TEMPLATE_KINDS, TEMPLATE_LANGUAGE, TEMPLATES, templateParams, type MessageKind } from "./templates";
import { listTemplates, sendTemplate, ZernioError } from "./zernio";

// Sending: the database queues a message (one row, status pending) and this
// module sends it. Every row is claimed first (pending → sending), so the
// booking, the reminder job and a retried webhook never send one twice.
// Everything here uses the service role, so callers check the member first.
// The patients' messages live in whatsapp_messages; the doctors' alerts in
// whatsapp_doctor_alerts, which a trigger on appointment_items fills.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type DeliveryReport = { sent: number; failed: number; skipped: number };

const nowIso = () => new Date().toISOString();

function errorOf(error: unknown) {
  if (error instanceof ZernioError) {
    return { code: (error.platformCode ?? error.code ?? String(error.status)).slice(0, 40), message: error.message.slice(0, 500) };
  }
  return { code: "error", message: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
}

/** The connection, its switches and the templates Meta has approved ("name:language"). */
async function sendingContext(admin: Admin) {
  const [{ data: settings }, { data: templates }] = await Promise.all([
    admin
      .from("whatsapp_settings")
      .select("connected, zernio_account_id, send_confirmations, send_reminders, send_doctor_alerts")
      .maybeSingle(),
    admin.from("whatsapp_templates").select("name, language, status"),
  ]);
  const approved = new Set((templates ?? []).filter((t) => t.status === "APPROVED").map((t) => `${t.name}:${t.language}`));
  return { config: zernioConfig(), settings, approved };
}

/** Sends the queued messages with these ids. Rows that are not pending are left alone. */
export async function deliverMessages(ids: string[], admin: Admin | null = createAdminClient()): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, failed: 0, skipped: 0 };
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length || !admin) return report;

  const [{ config, settings, approved }, { data: outbox, error }] = await Promise.all([
    sendingContext(admin),
    admin.rpc("whatsapp_outbox", { messages: unique }),
  ]);
  if (error) {
    console.error("whatsapp_outbox failed", error.code, error.message);
    return report;
  }

  for (const row of outbox ?? []) {
    if (row.status !== "pending") continue;
    const { data: claimed } = await admin
      .from("whatsapp_messages")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    const kind = row.kind as MessageKind;
    const template = TEMPLATES[kind];
    const startsAt = Date.parse(row.starts_at);
    const skip = !config
      ? "Zernio no está configurado en el servidor."
      : !settings?.connected || !settings.zernio_account_id
        ? "WhatsApp no está conectado."
        : kind === "confirmation" && !settings.send_confirmations
          ? "Las confirmaciones están desactivadas."
          : kind === "reminder" && !settings.send_reminders
            ? "Los recordatorios están desactivados."
            : !row.consent
              ? "El paciente no acepta mensajes por WhatsApp."
              : !["scheduled", "confirmed"].includes(row.visit_status)
                ? "La cita ya no está pendiente."
                : Date.parse(row.visit_starts_at) !== startsAt
                  ? "La cita cambió de hora."
                  : startsAt <= Date.now()
                    ? "La cita ya pasó."
                    : !template || !approved.has(`${template.name}:${TEMPLATE_LANGUAGE}`)
                      ? `La plantilla «${template?.name ?? kind}» aún no está aprobada por Meta.`
                      : null;
    if (skip || !config || !settings?.zernio_account_id) {
      await admin.from("whatsapp_messages").update({ status: "skipped", error: skip }).eq("id", row.id);
      report.skipped++;
      continue;
    }

    try {
      const result = await sendTemplate(config.apiKey, {
        accountId: settings.zernio_account_id,
        toE164: row.to_phone,
        name: template.name,
        language: TEMPLATE_LANGUAGE,
        params: templateParams({
          firstName: row.first_name,
          startsAt: row.starts_at,
          professional: row.professional,
          area: row.area,
        }),
      });
      await admin
        .from("whatsapp_messages")
        .update({
          status: "sent",
          sent_at: nowIso(),
          wamid: result.messageId || null,
          conversation_id: result.conversationId || null,
          template_name: template.name,
          template_language: TEMPLATE_LANGUAGE,
        })
        .eq("id", row.id)
        .eq("status", "sending");
      report.sent++;
    } catch (failure) {
      const { code, message } = errorOf(failure);
      console.error("WhatsApp send failed", row.id, code, message);
      await admin
        .from("whatsapp_messages")
        .update({ status: "failed", failed_at: nowIso(), error_code: code, error: message, template_name: template.name, template_language: TEMPLATE_LANGUAGE })
        .eq("id", row.id);
      report.failed++;
    }
  }
  return report;
}

/**
 * Queues and sends a visit's booking confirmation, when the patient accepts
 * WhatsApp. With `retry` (the visit page's button), a confirmation that
 * failed or was not sent for the visit's current time is tried again.
 * Answers what happened, or null when there was nothing to send.
 */
export async function sendBookingConfirmation(
  appointmentId: string,
  { retry = false }: { retry?: boolean } = {},
  admin: Admin | null = createAdminClient(),
) {
  if (!admin) return null;
  if (retry) {
    const { data: visit } = await admin.from("appointments").select("starts_at").eq("id", appointmentId).maybeSingle();
    if (visit) {
      await admin
        .from("whatsapp_messages")
        .update({ status: "pending", error: null, error_code: null, failed_at: null })
        .eq("appointment_id", appointmentId)
        .eq("kind", "confirmation")
        .eq("starts_at", visit.starts_at)
        .in("status", ["failed", "skipped"]);
    }
  }
  const { data: id, error } = await admin.rpc("whatsapp_queue_confirmation", { appointment: appointmentId });
  if (error) {
    console.error("whatsapp_queue_confirmation failed", error.code, error.message);
    return null;
  }
  let ids = id ? [id] : [];
  if (!ids.length && retry) {
    const { data: pending } = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("kind", "confirmation")
      .eq("status", "pending");
    ids = (pending ?? []).map((row) => row.id);
  }
  return ids.length ? deliverMessages(ids, admin) : null;
}

/**
 * After an online booking: records the patient's answer to "receive it by
 * WhatsApp" and sends the confirmation of the visit just booked.
 */
export async function afterOnlineBooking(booking: {
  documentType: string;
  documentNumber: string;
  day: string;
  time: string;
  optIn: boolean;
}) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: id, error } = await admin.rpc("whatsapp_queue_online_booking", {
    document_type: booking.documentType,
    document_number: booking.documentNumber,
    local_day: booking.day,
    local_time: booking.time,
    opt_in: booking.optIn,
  });
  if (error) {
    console.error("whatsapp_queue_online_booking failed", error.code, error.message);
    return;
  }
  if (id) await deliverMessages([id], admin);
}

/**
 * Sends the doctors' alerts waiting to go out. The database queues one when
 * a professional with a number is put on an upcoming visit
 * (whatsapp_queue_doctor_alert); every booking calls this right after, and
 * the daily job picks up whatever the last day left behind. Rows that are not
 * pending are left alone.
 */
export async function deliverDoctorAlerts(admin: Admin | null = createAdminClient()): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, failed: 0, skipped: 0 };
  if (!admin) return report;

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: pending, error: pendingError } = await admin
    .from("whatsapp_doctor_alerts")
    .select("id")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at")
    .limit(50);
  if (pendingError) {
    console.error("whatsapp_doctor_alerts failed", pendingError.code, pendingError.message);
    return report;
  }
  if (!pending?.length) return report;

  const [{ config, settings, approved }, { data: outbox, error }] = await Promise.all([
    sendingContext(admin),
    admin.rpc("whatsapp_doctor_alert_outbox", { alerts: pending.map((row) => row.id) }),
  ]);
  if (error) {
    console.error("whatsapp_doctor_alert_outbox failed", error.code, error.message);
    return report;
  }

  const template = TEMPLATES.doctor_alert;
  for (const row of outbox ?? []) {
    if (row.status !== "pending") continue;
    const { data: claimed } = await admin
      .from("whatsapp_doctor_alerts")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    const skip = !config
      ? "Zernio no está configurado en el servidor."
      : !settings?.connected || !settings.zernio_account_id
        ? "WhatsApp no está conectado."
        : !settings.send_doctor_alerts
          ? "Los avisos a médicos están desactivados."
          : !row.phone
            ? "El médico ya no tiene un número para avisos."
            : !row.on_visit
              ? "El médico ya no está en la cita."
              : !["scheduled", "confirmed"].includes(row.visit_status)
                ? "La cita ya no está pendiente."
                : Date.parse(row.visit_starts_at) <= Date.now()
                  ? "La cita ya pasó."
                  : !approved.has(`${template.name}:${TEMPLATE_LANGUAGE}`)
                    ? `La plantilla «${template.name}» aún no está aprobada por Meta.`
                    : null;
    if (skip || !config || !settings?.zernio_account_id || !row.phone) {
      await admin.from("whatsapp_doctor_alerts").update({ status: "skipped", error: skip }).eq("id", row.id);
      report.skipped++;
      continue;
    }

    try {
      const result = await sendTemplate(config.apiKey, {
        accountId: settings.zernio_account_id,
        toE164: row.phone,
        name: template.name,
        language: TEMPLATE_LANGUAGE,
        params: doctorAlertParams({
          firstName: row.first_name,
          lastName: row.last_name,
          startsAt: row.visit_starts_at,
          services: row.services,
        }),
      });
      await admin
        .from("whatsapp_doctor_alerts")
        .update({
          status: "sent",
          sent_at: nowIso(),
          // What actually went out: the number and the visit time as they are now.
          to_phone: row.phone,
          starts_at: row.visit_starts_at,
          wamid: result.messageId || null,
          conversation_id: result.conversationId || null,
          template_name: template.name,
          template_language: TEMPLATE_LANGUAGE,
        })
        .eq("id", row.id)
        .eq("status", "sending");
      report.sent++;
    } catch (failure) {
      const { code, message } = errorOf(failure);
      console.error("WhatsApp doctor alert failed", row.id, code, message);
      await admin
        .from("whatsapp_doctor_alerts")
        .update({ status: "failed", failed_at: nowIso(), error_code: code, error: message, template_name: template.name, template_language: TEMPLATE_LANGUAGE })
        .eq("id", row.id);
      report.failed++;
    }
  }
  return report;
}

/** Brings Meta's review status of the clinic's templates into whatsapp_templates. */
export async function syncTemplateStatuses(admin: Admin, apiKey: string, accountId: string) {
  const remote = await listTemplates(apiKey, accountId);
  const ours = new Set(TEMPLATE_KINDS.map((kind) => TEMPLATES[kind].name));
  const rows = remote
    .filter((t) => ours.has(t.name) && t.language)
    .map((t) => ({ name: t.name, language: t.language, status: t.status || "PENDING", meta_template_id: t.id || null, updated_at: nowIso() }));
  if (rows.length) {
    const { error } = await admin.from("whatsapp_templates").upsert(rows, { onConflict: "name,language" });
    if (error) throw new Error(`whatsapp_templates: ${error.message}`);
  }
  return remote;
}

/**
 * The daily job (/api/cron/whatsapp, the afternoon before): refreshes the
 * templates' status, sends any doctors' alert left pending, queues
 * tomorrow's reminders, sends them with anything still pending from the last
 * day, and forgets old webhook event ids.
 */
export async function runReminderJob() {
  const admin = createAdminClient();
  const config = zernioConfig();
  if (!admin || !config) return { ok: false as const, reason: "not_configured" };

  const { data: settings } = await admin.from("whatsapp_settings").select("connected, zernio_account_id").maybeSingle();
  if (!settings?.connected || !settings.zernio_account_id) return { ok: true as const, reason: "not_connected" };

  try {
    await syncTemplateStatuses(admin, config.apiKey, settings.zernio_account_id);
  } catch (error) {
    console.error("WhatsApp template sync failed", errorOf(error));
  }

  // A send cut off mid-way (the function was stopped) is not retried blindly: it may have gone out.
  const stuckBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const interrupted = { status: "failed", failed_at: nowIso(), error_code: "interrupted", error: "El envío se interrumpió; no se sabe si salió." };
  await Promise.all([
    admin.from("whatsapp_messages").update(interrupted).eq("status", "sending").lt("created_at", stuckBefore),
    admin.from("whatsapp_doctor_alerts").update(interrupted).eq("status", "sending").lt("created_at", stuckBefore),
  ]);

  // Normally sent seconds after the booking; this catches any the booking could not send.
  const alerts = await deliverDoctorAlerts(admin);

  const tomorrow = addDays(await clinicToday(), 1);
  const { data: queued, error } = await admin.rpc("whatsapp_queue_reminders", { for_day: tomorrow });
  if (error) {
    console.error("whatsapp_queue_reminders failed", error.code, error.message);
    return { ok: false as const, reason: "queue_failed" };
  }
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: pending } = await admin.from("whatsapp_messages").select("id").eq("status", "pending").gte("created_at", since);
  const ids = [...(queued ?? []), ...(pending ?? []).map((row) => row.id)];
  const report = await deliverMessages(ids, admin);

  const forgetBefore = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  await admin.from("whatsapp_webhook_events").delete().lt("received_at", forgetBefore);

  // Copies of lab PDFs that Meta has long since downloaded.
  try {
    await deleteOldWhatsAppPdfs(admin);
  } catch (error) {
    console.error("lab PDF cleanup failed", error instanceof Error ? error.message : error);
  }

  return { ok: true as const, day: tomorrow, queued: queued?.length ?? 0, ...report, alerts };
}
