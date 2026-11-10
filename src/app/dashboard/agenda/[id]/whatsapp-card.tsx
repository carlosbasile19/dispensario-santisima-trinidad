import { io } from "next/cache";

import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Badge, Card, CardHeader } from "@/components/crm/ui";
import { isBookingPhone } from "@/lib/booking/phone";
import { formatDay, formatTime, localDay, type AppointmentStatus } from "@/lib/crm/clinic";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_KIND_LABEL, MESSAGE_STATUS, REPLY_EFFECT_NOTE, REPLY_LABEL } from "@/lib/whatsapp/labels";
import { sendWhatsAppConfirmation } from "../actions";

const stamp = (timestamp: string) => `${formatDay(localDay(timestamp), "short")}, ${formatTime(timestamp)}`;

/** Whether the visit is still ahead, read at request time (`io()`), outside render. */
async function isAhead(startsAt: string) {
  await io();
  return Date.parse(startsAt) > Date.now();
}

/**
 * The visit's WhatsApp messages: what was sent, whether it arrived and what
 * the patient answered. The front desk can send the confirmation by hand.
 */
export async function WhatsAppCard({
  appointmentId,
  patientId,
  startsAt,
  status,
  canSend,
}: {
  appointmentId: string;
  patientId: string;
  startsAt: string;
  status: AppointmentStatus;
  canSend: boolean;
}) {
  const supabase = await createClient();
  const [{ data: connectedNow }, { data: patient }, { data: messages }] = await Promise.all([
    supabase.rpc("whatsapp_connected"),
    supabase.from("patients").select("whatsapp_consent, phone_e164").eq("id", patientId).maybeSingle(),
    supabase
      .from("whatsapp_messages")
      .select("id, kind, status, reply, reply_effect, error, created_at, sent_at, delivered_at, read_at, starts_at")
      .eq("appointment_id", appointmentId)
      .order("created_at"),
  ]);
  const upcoming = await isAhead(startsAt);
  const pending = status === "scheduled" || status === "confirmed";
  const connected = connectedNow === true;
  const reachable = isBookingPhone(patient?.phone_e164 ?? null);
  const consent = patient?.whatsapp_consent;
  const current = (messages ?? []).find((m) => m.kind === "confirmation" && Date.parse(m.starts_at) === Date.parse(startsAt));
  const offerSend =
    canSend && connected && consent === true && reachable && upcoming && pending && (!current || ["failed", "skipped"].includes(current.status));

  const why = !connected
    ? "WhatsApp no está conectado."
    : consent === false
      ? "El paciente no acepta mensajes por WhatsApp."
      : consent !== true
        ? "El paciente aún no ha dicho si acepta mensajes por WhatsApp. Pregúntale y márcalo en su ficha."
        : !reachable
          ? "El teléfono del paciente no es un celular."
          : !pending || !upcoming
            ? null
            : "Aún no se ha enviado la confirmación.";

  return (
    <Card>
      <CardHeader
        title="WhatsApp"
        action={
          consent === true ? (
            <Badge tone="teal">Acepta</Badge>
          ) : consent === false ? (
            <Badge tone="outline">No acepta</Badge>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-3 px-5 py-4 text-sm">
        {messages?.length ? (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => {
              const info = MESSAGE_STATUS[m.status] ?? { label: m.status, tone: "outline" as const };
              const moved = Date.parse(m.starts_at) !== Date.parse(startsAt);
              const when = m.read_at ?? m.delivered_at ?? m.sent_at ?? m.created_at;
              return (
                <li key={m.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{MESSAGE_KIND_LABEL[m.kind] ?? m.kind}</span>
                    <Badge tone={info.tone}>{info.label}</Badge>
                  </div>
                  <p className="text-[13px] text-muted">
                    {stamp(when)}
                    {moved ? ` · para la hora anterior (${stamp(m.starts_at)})` : ""}
                  </p>
                  {m.reply && <p className="text-[13px] font-medium text-teal">{REPLY_LABEL[m.reply] ?? m.reply}</p>}
                  {m.reply_effect && REPLY_EFFECT_NOTE[m.reply_effect] && (
                    <p className="text-[13px] text-muted">{REPLY_EFFECT_NOTE[m.reply_effect]}</p>
                  )}
                  {m.error && (m.status === "failed" || m.status === "skipped") && <p className="text-[13px] text-[#b03a36]">{m.error}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          why && <p className="text-muted">{why}</p>
        )}
        {offerSend && (
          <ActionForm action={sendWhatsAppConfirmation}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <SubmitButton size="sm" variant="secondary" icon="send" pendingLabel="Enviando…">
              {current ? "Reintentar la confirmación" : "Enviar confirmación por WhatsApp"}
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </Card>
  );
}
