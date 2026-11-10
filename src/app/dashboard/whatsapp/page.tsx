import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Icon } from "@/components/crm/icons";
import { Switch } from "@/components/crm/switch";
import { Badge, Card, CardHeader, EmptyState, NoAccess, PageHeader, RowsSkeleton } from "@/components/crm/ui";
import { formatDay, formatTime, localDay, param, patientName } from "@/lib/crm/clinic";
import { getProfessionals } from "@/lib/crm/data";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { missingZernioEnv } from "@/lib/whatsapp/config";
import { MESSAGE_KIND_LABEL, MESSAGE_STATUS, REPLY_LABEL, templateStatus } from "@/lib/whatsapp/labels";
import { REPLY_BUTTONS, TEMPLATE_KINDS, TEMPLATE_LANGUAGE, TEMPLATES } from "@/lib/whatsapp/templates";
import {
  checkWhatsAppConnection,
  connectWhatsApp,
  refreshWhatsAppTemplates,
  saveWhatsAppSwitches,
  submitWhatsAppTemplates,
} from "./actions";
import { DoctorAlertsCard, type DoctorAlertRow } from "./doctor-alerts";

export const metadata: Metadata = { title: "WhatsApp" };

// WhatsApp (administrators only): the clinic's number connected through
// Zernio with Coexistence, the automatic messages, the templates at Meta, the
// doctors' numbers for their alerts and the latest messages. See
// lib/whatsapp and README "WhatsApp".

const CONNECT_ERRORS: Record<string, string> = {
  connection_cancelled: "La conexión se canceló antes de terminar. Puedes intentarlo de nuevo.",
  one_whatsapp_per_profile: "El perfil de Zernio ya tiene otro número de WhatsApp. Desconéctalo en Zernio o usa otro perfil.",
  whatsapp_number_already_connected: "Ese número ya está conectado en Zernio en otro perfil o cuenta.",
  whatsapp_number_pinned_to_profile: "Ese número pertenece a otro perfil de Zernio.",
  whatsapp_error: "Meta no completó la conexión. Revisa que la app WhatsApp Business esté actualizada y vuelve a intentarlo.",
  state: "El enlace de vuelta no coincide con esta sesión. Empieza la conexión de nuevo desde aquí.",
  forbidden: "Solo un administrador puede conectar el número.",
  account: "Zernio no muestra esa cuenta en el perfil del centro. Revisa ZERNIO_PROFILE_ID.",
  zernio: "Zernio no respondió al comprobar la cuenta. Inténtalo de nuevo.",
  config: "Falta configurar Zernio en el servidor.",
  save: "No se pudo guardar la conexión. Inténtalo de nuevo.",
};

export default async function WhatsAppPage({ searchParams }: PageProps<"/dashboard/whatsapp">) {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return <NoAccess role={viewer.role} section="WhatsApp" />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="WhatsApp"
        description="Confirmaciones y recordatorios a pacientes, y avisos de citas nuevas a los médicos, desde el número del centro. Recepción sigue usando la app WhatsApp Business como siempre."
      />
      <Suspense fallback={<RowsSkeleton rows={4} />}>
        <WhatsAppSettings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const stamp = (timestamp: string) => `${formatDay(localDay(timestamp), "short")}, ${formatTime(timestamp)}`;

async function WhatsAppSettings({ searchParams }: { searchParams: PageProps<"/dashboard/whatsapp">["searchParams"] }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: settings }, { data: templates }, { data: messages }, { data: phones }, { data: alerts }, professionals] = await Promise.all([
    supabase.from("whatsapp_settings").select("*").maybeSingle(),
    supabase.from("whatsapp_templates").select("name, language, status, reason, updated_at"),
    supabase
      .from("whatsapp_messages")
      .select("id, kind, status, reply, error, created_at, appointment_id, starts_at, patients(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("whatsapp_doctor_phones").select("professional_id, phone"),
    supabase
      .from("whatsapp_doctor_alerts")
      .select("professional_id, status, error, created_at, starts_at")
      .order("created_at", { ascending: false })
      .limit(200),
    getProfessionals(),
  ]);
  const missing = missingZernioEnv();
  const connected = Boolean(settings?.connected && settings.zernio_account_id);
  const everConnected = Boolean(settings?.zernio_account_id);
  const errorCode = param(params.error);
  const notice = param(params.conectado) ? "Número conectado. Envía las plantillas a Meta para empezar a enviar mensajes." : null;
  const problem = errorCode ? (CONNECT_ERRORS[errorCode] ?? `La conexión no se completó (${errorCode}).`) : null;
  const approved = TEMPLATE_KINDS.filter((kind) =>
    templates?.some((t) => t.name === TEMPLATES[kind].name && t.language === TEMPLATE_LANGUAGE && t.status === "APPROVED"),
  );
  const allSubmitted = TEMPLATE_KINDS.every((kind) => templates?.some((t) => t.name === TEMPLATES[kind].name && t.language === TEMPLATE_LANGUAGE));
  // Alerts come newest first: the first one of each professional is their latest.
  const doctors: DoctorAlertRow[] = professionals.list
    .filter((p) => p.role === "doctor" || p.role === "director")
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      phone: phones?.find((row) => row.professional_id === p.id)?.phone ?? null,
      last: alerts?.find((row) => row.professional_id === p.id) ?? null,
    }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col gap-6">
        {(notice || problem) && (
          <p
            role={problem ? "alert" : "status"}
            className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${problem ? "bg-coral/10 text-[#b03a36]" : "bg-frost text-navy"}`}
          >
            <Icon name={problem ? "alert" : "check"} className="mt-0.5 size-4 shrink-0" />
            {problem ?? notice}
          </p>
        )}

        <Card>
          <CardHeader
            title="Número del centro"
            hint="Conectado con Zernio, con la app WhatsApp Business funcionando a la vez (Coexistencia)"
            action={
              connected ? (
                <Badge tone="teal">Conectado</Badge>
              ) : everConnected ? (
                <Badge tone="coral">Desconectado</Badge>
              ) : (
                <Badge tone="outline">Sin conectar</Badge>
              )
            }
          />
          <div className="flex flex-col gap-4 px-5 py-4 text-sm">
            {missing.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p>Antes de conectar, el servidor necesita la cuenta de Zernio. Faltan estas variables en Vercel:</p>
                <ul className="flex flex-wrap gap-2">
                  {missing.map((name) => (
                    <li key={name}>
                      <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-[12px]">{name}</code>
                    </li>
                  ))}
                </ul>
                <p className="text-muted">
                  <code className="font-mono text-[12px]">node scripts/zernio-setup.mjs</code> las crea en tu cuenta de Zernio; luego
                  vuelve a desplegar.
                </p>
              </div>
            ) : (
              <>
                {settings?.phone && (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">Número</dt>
                      <dd className="mt-1">{settings.phone}</dd>
                    </div>
                    {settings.connected_at && (
                      <div>
                        <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">Conectado</dt>
                        <dd className="mt-1">{stamp(settings.connected_at)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {!connected && settings?.disconnected_at && (
                  <p className="rounded-lg bg-coral/10 px-3 py-2 text-[#b03a36]">
                    Se desconectó el {stamp(settings.disconnected_at)}
                    {settings.disconnect_reason ? ` (${settings.disconnect_reason})` : ""}. Mientras tanto no sale ningún mensaje.
                    Reconéctalo con el teléfono del centro a mano.
                  </p>
                )}
                {!connected && (
                  <p className="text-muted">
                    Ten a mano el teléfono del centro con WhatsApp Business actualizado. Meta te pedirá iniciar sesión con Facebook,
                    escribir el número y escanear un código QR desde la app (Ajustes › Dispositivos vinculados). Si la app tiene
                    verificación en dos pasos, desactívala antes; puedes activarla de nuevo al terminar.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={connectWhatsApp}>
                    <SubmitButton icon="link" pendingLabel="Abriendo…" variant={connected ? "secondary" : "primary"}>
                      {connected ? "Reconectar" : everConnected ? "Reconectar WhatsApp" : "Conectar WhatsApp"}
                    </SubmitButton>
                  </ActionForm>
                  {everConnected && (
                    <ActionForm action={checkWhatsAppConnection}>
                      <SubmitButton icon="refresh" variant="secondary" pendingLabel="Consultando…">
                        Comprobar conexión
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Plantillas"
            hint="Meta revisa cada mensaje que el centro envía primero; todas son de categoría utilidad"
            action={
              <Badge tone={approved.length === TEMPLATE_KINDS.length ? "teal" : "outline"}>
                {approved.length} de {TEMPLATE_KINDS.length} aprobadas
              </Badge>
            }
          />
          <ul className="divide-y divide-line">
            {TEMPLATE_KINDS.map((kind) => {
              const t = TEMPLATES[kind];
              const row = templates?.find((r) => r.name === t.name && r.language === TEMPLATE_LANGUAGE);
              const status = templateStatus(row?.status);
              return (
                <li key={kind} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[13px] text-muted">
                        {t.description} <code className="font-mono text-[12px] text-stone">{t.name}</code>
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  {row?.reason && <p className="text-[13px] text-[#b03a36]">Meta: {row.reason}</p>}
                  <details className="text-[13px]">
                    <summary className="cursor-pointer text-teal hover:text-navy">Ver el mensaje</summary>
                    <div className="mt-2 rounded-lg bg-cream px-3 py-2">
                      {t.document && (
                        <p className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-outline bg-white px-2 py-0.5 text-[12px] text-navy">
                          <Icon name="file" className="size-3.5" />
                          Resultados-Laboratorio.pdf
                        </p>
                      )}
                      <p className="whitespace-pre-line text-ink">{t.body}</p>
                      {t.buttons && (
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {REPLY_BUTTONS.map((b) => (
                            <span key={b.answer} className="rounded-md border border-outline bg-white px-2 py-0.5 text-[12px] text-navy">
                              {b.text}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {connected && (
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
              {!allSubmitted && (
                <ActionForm action={submitWhatsAppTemplates}>
                  <SubmitButton icon="send" pendingLabel="Enviando…">
                    Enviar a Meta para revisión
                  </SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={refreshWhatsAppTemplates}>
                <SubmitButton icon="refresh" variant="secondary" pendingLabel="Consultando…">
                  Actualizar estado
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Mensajes automáticos" hint="A pacientes, solo si aceptaron WhatsApp y tienen un celular; a médicos, si tienen número" />
          <ActionForm action={saveWhatsAppSwitches} className="flex flex-col gap-5 px-5 py-5">
            <Switch
              name="send_confirmations"
              defaultChecked={settings?.send_confirmations ?? true}
              label="Confirmación al agendar"
              description="Al reservar en línea o en recepción, con botones para confirmar, reprogramar o cancelar."
            />
            <Switch
              name="send_reminders"
              defaultChecked={settings?.send_reminders ?? true}
              label="Recordatorio el día anterior"
              description="Sale cada tarde para las citas del día siguiente, con los mismos botones."
            />
            <Switch
              name="send_doctor_alerts"
              defaultChecked={settings?.send_doctor_alerts ?? true}
              label="Aviso al médico al agendar"
              description="En cuanto se agenda una cita, en línea o en recepción, al WhatsApp de cada médico de la cita que tenga número."
            />
            <div>
              <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
                Guardar
              </SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <DoctorAlertsCard doctors={doctors} paused={settings?.send_doctor_alerts === false} />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader title="Últimos mensajes" />
          {messages?.length ? (
            <ul className="divide-y divide-line">
              {messages.map((m) => {
                const status = MESSAGE_STATUS[m.status] ?? { label: m.status, tone: "outline" as const };
                return (
                  <li key={m.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/dashboard/agenda/${m.appointment_id}`} className="min-w-0 truncate font-medium hover:text-teal">
                        {m.patients ? patientName(m.patients) : "Paciente"}
                      </Link>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {MESSAGE_KIND_LABEL[m.kind] ?? m.kind} · cita del {formatDay(localDay(m.starts_at), "short")} · {stamp(m.created_at)}
                    </p>
                    {m.reply && <p className="mt-0.5 text-[13px] text-teal">{REPLY_LABEL[m.reply] ?? m.reply}</p>}
                    {m.error && (m.status === "failed" || m.status === "skipped") && (
                      <p className="mt-0.5 text-[13px] text-[#b03a36]">{m.error}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="chat" title="Todavía no hay mensajes">
              Aparecen aquí al agendar citas de pacientes que aceptaron WhatsApp.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader title="Cómo funciona" />
          <ul className="flex list-disc flex-col gap-2 py-4 pr-5 pl-9 text-[13px] leading-relaxed text-muted">
            <li>Los mensajes salen del número del centro y aparecen en la app de recepción, en el chat de cada paciente.</li>
            <li>
              Cuando el paciente toca <strong>Confirmar asistencia</strong> o <strong>Cancelar cita</strong>, la Agenda se actualiza
              sola. <strong>Reprogramar</strong> queda para recepción, que lo ve en el chat.
            </li>
            <li>Solo reciben mensajes los pacientes que aceptaron WhatsApp: al reservar en línea o en su ficha.</li>
            <li>A los pacientes nunca se les envía la cédula ni el servicio de la cita.</li>
            <li>
              Cada médico con número recibe un <strong>aviso</strong> en cuanto se le agenda una cita: el paciente, el día, la hora y el
              servicio, nunca la cédula ni el teléfono. El aviso también aparece en la app de recepción, en el chat con el médico, y si
              responde, le llega a recepción.
            </li>
            <li>
              Con la conexión activa, la app WhatsApp Business no permite listas de difusión, y se debe abrir en el teléfono al menos
              cada 14 días. WhatsApp para Windows no puede vincularse; WhatsApp Web sí.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
