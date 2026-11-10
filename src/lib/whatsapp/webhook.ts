import "server-only";

import { formatDay, formatTime, localDay } from "@/lib/crm/clinic";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ZernioConfig } from "./config";
import { syncTemplateStatuses } from "./send";
import { answerFor } from "./templates";
import { sendText } from "./zernio";

// What /api/whatsapp/webhook does with each Zernio event
// (https://docs.zernio.com/webhooks). It answers within Zernio's 5 seconds:
// database work happens here, and the one Zernio call (the reply to a
// patient's button) is handed back to run after the response.
//
// Message text is never stored. With Coexistence every chat of the number
// arrives here too; only button answers to our own messages are used, and
// the front desk keeps answering everything else from the WhatsApp Business app.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Json = Record<string, unknown>;

const obj = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {});
const str = (value: unknown) => (typeof value === "string" ? value : "");

export type ZernioEvent = Json & { id?: string; event?: string };

/** The message id a reply quotes, under whichever key Zernio's metadata uses for it. */
function quotedId(metadata: Json) {
  const context = obj(metadata.context);
  for (const value of [
    metadata.quotedMessageId,
    metadata.replyTo,
    metadata.replyToMessageId,
    metadata.contextMessageId,
    metadata.quotedPlatformMessageId,
    context.id,
    context.message_id,
  ]) {
    if (typeof value === "string" && value) return value;
  }
  return null;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") : null;

/** The text sent back after a button answer, or null to stay quiet. */
function acknowledgement(effect: string, startsAt: string | null) {
  const when = startsAt ? `del ${formatDay(localDay(startsAt), "long")} a las ${formatTime(startsAt)}` : "";
  switch (effect) {
    case "confirmed":
      return `¡Gracias! Tu cita ${when} quedó confirmada. Te esperamos.`;
    case "cancelled":
      return `Listo, cancelamos tu cita ${when}. Si quieres agendar otra, escríbenos por aquí${SITE ? ` o entra a ${SITE}/agendar` : ""}.`;
    case "reschedule":
      return "Con gusto. En breve te escribimos por aquí para buscar otro día y hora.";
    case "outdated":
      return "Recibimos tu respuesta, pero tu cita cambió de horario. En breve te escribimos por aquí para confirmarla.";
    case "unchanged":
      return "Recibimos tu respuesta. En breve te escribimos por aquí.";
    case "ambiguous":
      return "Recibimos tu respuesta. Como tienes más de una cita pendiente, en breve te escribimos por aquí para saber a cuál te refieres.";
    default:
      return null;
  }
}

/**
 * Handles one event. Answers an optional follow-up to run after the
 * response (Zernio calls), or throws so the route answers 500 and Zernio
 * retries the event later.
 */
export async function handleZernioEvent(event: ZernioEvent, admin: Admin, config: ZernioConfig): Promise<(() => Promise<void>) | null> {
  const name = str(event.event);
  const account = obj(event.account);
  const accountId = str(account.accountId) || str(account.id);

  const { data: settings, error } = await admin.from("whatsapp_settings").select("zernio_account_id, connected").maybeSingle();
  if (error) throw new Error(`whatsapp_settings: ${error.message}`);
  // The subscription only covers the clinic's profile; still, act only on the connected number.
  if (!settings?.zernio_account_id || accountId !== settings.zernio_account_id) return null;

  switch (name) {
    case "message.delivered":
    case "message.read":
    case "message.failed": {
      const message = obj(event.message);
      const failure = obj(event.error);
      const status = name.slice("message.".length);
      for (const ref of [str(message.platformMessageId), str(message.id)].filter(Boolean)) {
        const { data: id, error: statusError } = await admin.rpc("whatsapp_record_status", {
          ref,
          new_status: status,
          status_at: str(event.statusAt) || new Date().toISOString(),
          code: failure.code === undefined || failure.code === null ? undefined : String(failure.code),
          detail: str(failure.message) || str(failure.title) || undefined,
        });
        if (statusError) throw new Error(`whatsapp_record_status: ${statusError.message}`);
        if (id) break;
      }
      return null;
    }

    case "message.received":
      return handleReply(event, admin, config, settings.zernio_account_id);

    case "account.disconnected": {
      const reason = [str(account.disconnectionType), str(account.reason)].filter(Boolean).join(": ");
      const { error: updateError } = await admin
        .from("whatsapp_settings")
        .update({ connected: false, disconnected_at: new Date().toISOString(), disconnect_reason: reason.slice(0, 500) || null })
        .eq("id", true);
      if (updateError) throw new Error(`whatsapp_settings: ${updateError.message}`);
      console.warn("WhatsApp number disconnected", reason);
      return null;
    }

    case "whatsapp.template.status_updated": {
      const template = obj(event.template);
      const templateName = str(template.name);
      const language = str(template.language);
      if (!templateName || !language) return null;
      const { error: upsertError } = await admin.from("whatsapp_templates").upsert(
        {
          name: templateName,
          language,
          status: str(template.status).toUpperCase() || "PENDING",
          reason: str(template.reason) && str(template.reason) !== "NONE" ? str(template.reason).slice(0, 1000) : null,
          meta_template_id: str(template.templateId) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "name,language" },
      );
      // A template of the WABA that is not ours fails the name check: ignore it.
      if (upsertError && upsertError.code !== "23514") throw new Error(`whatsapp_templates: ${upsertError.message}`);
      return null;
    }

    case "account.connected":
      // Zernio may report the number connected again (after a reconnect): refresh the templates.
      return async () => {
        await syncTemplateStatuses(admin, config.apiKey, settings.zernio_account_id!).catch((e) => console.error("WhatsApp template sync failed", e));
      };

    default:
      return null;
  }
}

/** A patient's tap on Confirmar asistencia / Reprogramar / Cancelar cita. */
async function handleReply(event: ZernioEvent, admin: Admin, config: ZernioConfig, accountId: string) {
  const message = obj(event.message);
  const metadata = obj(event.metadata);
  if (str(message.platform) && str(message.platform) !== "whatsapp") return null;
  if (str(message.direction) && str(message.direction) !== "incoming") return null;
  // Another app (Meta's Business AI) holds the chat: leave it alone.
  if (metadata.standby === true) return null;

  // A tap carries the button's text (and payload); typing its exact words counts too.
  const typed = answerFor(str(message.text));
  const answer = str(metadata.interactiveType) ? (answerFor(str(metadata.interactiveId)) ?? typed) : typed;
  if (!answer) return null;

  const sender = obj(message.sender);
  const conversation = str(message.conversationId) || str(obj(event.conversation).id);
  const phone = str(sender.phoneNumber) || (/^\d{8,15}$/.test(str(sender.id)) ? `+${str(sender.id)}` : "");

  const { data: target, error } = await admin.rpc("whatsapp_reply_target", {
    conversation,
    phone,
    quoted: quotedId(metadata) ?? undefined,
  });
  if (error) throw new Error(`whatsapp_reply_target: ${error.message}`);
  const found = obj(target);

  let effect: string;
  let startsAt: string | null = null;
  if (typeof found.message === "string") {
    const { data: result, error: applyError } = await admin.rpc("whatsapp_apply_reply", {
      message_id: found.message,
      answer,
      user_id: str(sender.businessScopedUserId) || undefined,
    });
    if (applyError) throw new Error(`whatsapp_apply_reply: ${applyError.message}`);
    effect = str(obj(result).effect);
    startsAt = str(obj(result).starts_at) || null;
  } else if (Number(found.candidates) > 1) {
    effect = "ambiguous";
  } else {
    return null;
  }

  const text = acknowledgement(effect, startsAt);
  const eventId = str(event.id);
  if (!text || !conversation || !eventId) return null;
  return async () => {
    try {
      await sendText(config.apiKey, { accountId, conversationId: conversation, text, idempotencyKey: `ack-${eventId}` });
    } catch (failure) {
      console.error("WhatsApp acknowledgement failed", failure instanceof Error ? failure.message : failure);
    }
  };
}
