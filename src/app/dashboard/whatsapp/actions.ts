"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { isBookingPhone, normalizePhone } from "@/lib/booking/phone";
import { isUuid } from "@/lib/crm/clinic";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { getViewer } from "@/lib/crm/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHONE_DISPLAY } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/server";
import { CONNECT_COOKIE, zernioConfig } from "@/lib/whatsapp/config";
import { QUALITY_LABEL, templateStatus, tierLabel } from "@/lib/whatsapp/labels";
import { syncTemplateStatuses } from "@/lib/whatsapp/send";
import { templateReviewAction } from "@/lib/whatsapp/template-review";
import { saveTemplateStatuses } from "@/lib/whatsapp/template-status";
import { TEMPLATE_KINDS, TEMPLATE_LANGUAGE, TEMPLATE_TTL_SECONDS, TEMPLATES, templateComponents } from "@/lib/whatsapp/templates";
import { createTemplate, getConnectUrl, getNumberInfo, listWhatsAppAccounts, updateTemplate, ZernioError } from "@/lib/whatsapp/zernio";

// The WhatsApp page (administrators only). Every action checks the member
// first; the settings' RLS lets only administrators change the switches,
// and the connection itself is written by /api/whatsapp/callback.

const NO_ACCESS = "Solo un administrador puede configurar WhatsApp.";
const NOT_CONFIGURED = "Falta configurar Zernio en el servidor: sigue los pasos de esta página.";
const NOT_CONNECTED = "Conecta primero el número de WhatsApp del centro.";

/** The address this request came to (the production domain or a preview). */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

const zernioProblem = (error: unknown, fallback: string) => {
  if (error instanceof ZernioError) {
    if (error.status === 401 || error.status === 403) return "Zernio rechazó la clave: revisa ZERNIO_API_KEY.";
    return `${fallback} Zernio respondió: ${error.message}`;
  }
  return fallback;
};

async function connectedAccount() {
  const supabase = await createClient();
  const { data } = await supabase.from("whatsapp_settings").select("connected, zernio_account_id").maybeSingle();
  return data?.zernio_account_id ? data : null;
}

/**
 * Starts the connection: Zernio's hosted signup (in Spanish) opens Meta's
 * Embedded Signup, where the administrator logs in with Facebook, enters the
 * clinic's number and scans a QR code with the WhatsApp Business app. The
 * browser comes back to /api/whatsapp/callback.
 */
export async function connectWhatsApp(): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const config = zernioConfig();
  if (!config) return { error: NOT_CONFIGURED };

  const state = randomUUID();
  const redirectUrl = `${await requestOrigin()}/api/whatsapp/callback?state=${state}`;
  let authUrl: string;
  try {
    // Reconnecting keeps the same Zernio account (and its history).
    const saved = await connectedAccount();
    const accounts = saved ? await listWhatsAppAccounts(config.apiKey, config.profileId) : [];
    const reconnectAccountId = accounts.some((a) => a.id === saved?.zernio_account_id) ? (saved?.zernio_account_id ?? undefined) : undefined;
    authUrl = await getConnectUrl(config.apiKey, { profileId: config.profileId, redirectUrl, reconnectAccountId });
  } catch (error) {
    console.error("WhatsApp connect failed", error instanceof Error ? error.message : error);
    return { error: zernioProblem(error, "No se pudo iniciar la conexión.") };
  }

  (await cookies()).set({
    name: CONNECT_COOKIE,
    value: state,
    httpOnly: true,
    secure: redirectUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/whatsapp/callback",
    // Zernio's hosted signup page expires after 60 minutes.
    maxAge: 60 * 60,
  });
  redirect(authUrl);
}

/** Pauses or resumes each kind of automatic message. */
export async function saveWhatsAppSwitches(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_settings")
    .update({
      send_confirmations: formData.get("send_confirmations") === "on",
      send_reminders: formData.get("send_reminders") === "on",
      send_doctor_alerts: formData.get("send_doctor_alerts") === "on",
      send_lab_results: formData.get("send_lab_results") === "on",
    })
    .eq("id", true);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { message: "Guardado." };
}

/**
 * Sets, changes or removes ("remove" = "1") the number a doctor gets the
 * new-visit alerts on. The table's RLS lets only administrators write it,
 * and the database checks the member is a doctor or the medical director.
 */
export async function saveDoctorWhatsApp(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const professional = formData.get("professional");
  if (!isUuid(professional)) return { error: "Médico no válido." };
  const supabase = await createClient();

  if (formData.get("remove") === "1") {
    const { error } = await supabase.from("whatsapp_doctor_phones").delete().eq("professional_id", professional);
    if (error) return { error: dbErrorMessage(error, "No se pudo quitar el número.") };
    refresh();
    return { message: "Número quitado: ya no recibe avisos." };
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!isBookingPhone(phone)) {
    return { error: "Escribe un celular: 04xx-xxxxxxx, o con el código del país si es del exterior (+…)." };
  }
  // WhatsApp cannot send a message from a number to itself.
  const { data: settings } = await supabase.from("whatsapp_settings").select("phone").maybeSingle();
  if (phone === normalizePhone(PHONE_DISPLAY) || phone === normalizePhone(settings?.phone)) {
    return { error: "Ese es el número del centro. Escribe el celular del médico." };
  }
  const { error } = await supabase
    .from("whatsapp_doctor_phones")
    .upsert({ professional_id: professional, phone }, { onConflict: "professional_id" });
  if (error) return { error: dbErrorMessage(error, "No se pudo guardar el número. Revisa que sea un celular con WhatsApp.") };
  refresh();
  return { message: "Número guardado." };
}

/** Creates missing templates and resubmits corrected rejected variants for review. */
export async function submitWhatsAppTemplates(): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const config = zernioConfig();
  const admin = createAdminClient();
  if (!config || !admin) return { error: NOT_CONFIGURED };
  const account = await connectedAccount();
  if (!account?.connected || !account.zernio_account_id) return { error: NOT_CONNECTED };

  try {
    const remote = await syncTemplateStatuses(admin, config.apiKey, account.zernio_account_id);
    const submissions = TEMPLATE_KINDS.flatMap((kind) => {
      const existing = remote.find((t) => t.name === TEMPLATES[kind].name && t.language === TEMPLATE_LANGUAGE);
      const action = templateReviewAction(existing?.status);
      return action ? [{ kind, action }] : [];
    });
    // The results template's review needs a sample PDF Meta can download: a report of a fictitious patient.
    const samplePdfUrl = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (await requestOrigin())}/laboratorio/informe-de-ejemplo.pdf`;
    for (const { kind, action } of submissions) {
      const submit = action === "update" ? updateTemplate : createTemplate;
      const created = await submit(config.apiKey, {
        accountId: account.zernio_account_id,
        name: TEMPLATES[kind].name,
        language: TEMPLATE_LANGUAGE,
        category: "UTILITY",
        components: templateComponents(kind, { samplePdfUrl }),
        ttlSeconds: TEMPLATE_TTL_SECONDS,
      });
      await saveTemplateStatuses(admin, [created]);
    }
    refresh();
    return {
      message: submissions.length
        ? "Plantillas enviadas a Meta. La revisión suele tardar minutos (hasta 24 horas); el estado se actualiza solo."
        : "Meta ya tiene todas las plantillas. Estado actualizado.",
    };
  } catch (error) {
    console.error("WhatsApp template submit failed", error instanceof ZernioError
      ? { message: error.message, status: error.status, code: error.code, platformCode: error.platformCode }
      : error instanceof Error ? error.message : error);
    refresh();
    return { error: zernioProblem(error, "No se pudieron enviar las plantillas.") };
  }
}

export async function refreshWhatsAppTemplates(): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const config = zernioConfig();
  const admin = createAdminClient();
  if (!config || !admin) return { error: NOT_CONFIGURED };
  const account = await connectedAccount();
  if (!account?.zernio_account_id) return { error: NOT_CONNECTED };
  try {
    const remote = await syncTemplateStatuses(admin, config.apiKey, account.zernio_account_id);
    refresh();
    const ours = TEMPLATE_KINDS.map((kind) => {
      const found = remote.find((t) => t.name === TEMPLATES[kind].name && t.language === TEMPLATE_LANGUAGE);
      return `${TEMPLATES[kind].label}: ${templateStatus(found?.status).label.toLowerCase()}`;
    });
    return { message: `${ours.join(" · ")}.` };
  } catch (error) {
    return { error: zernioProblem(error, "No se pudo consultar el estado de las plantillas.") };
  }
}

/** Asks Meta, through Zernio, whether the number can send right now. */
export async function checkWhatsAppConnection(): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return { error: NO_ACCESS };
  const config = zernioConfig();
  if (!config) return { error: NOT_CONFIGURED };
  const account = await connectedAccount();
  if (!account?.zernio_account_id) return { error: NOT_CONNECTED };
  try {
    const info = await getNumberInfo(config.apiKey, account.zernio_account_id);
    const parts = [
      info.displayPhoneNumber && `Número ${info.displayPhoneNumber}`,
      info.verifiedName && `nombre «${info.verifiedName}»`,
      info.status && `estado ${info.status.toLowerCase()}`,
      info.qualityRating && `calidad ${(QUALITY_LABEL[info.qualityRating] ?? info.qualityRating).toLowerCase()}`,
      info.messagingLimitTier && tierLabel(info.messagingLimitTier).toLowerCase(),
    ].filter(Boolean);
    return { message: `Meta responde: ${parts.join(", ")}.` };
  } catch (error) {
    return { error: zernioProblem(error, "Meta no confirma la conexión del número. Si se desconectó, reconéctalo.") };
  }
}
