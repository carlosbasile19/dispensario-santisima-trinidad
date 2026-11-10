import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Modal } from "@/components/crm/modal";
import { inputClass } from "@/components/crm/styles";
import { Badge, Card, CardHeader, EmptyState } from "@/components/crm/ui";
import { formatPhone } from "@/lib/booking/phone";
import { formatDay, formatTime, localDay } from "@/lib/crm/clinic";
import { ROLE_INFO, type Role } from "@/lib/crm/roles";
import { MESSAGE_STATUS } from "@/lib/whatsapp/labels";
import { saveDoctorWhatsApp } from "./actions";

export type DoctorAlertRow = {
  id: string;
  name: string;
  role: Role | null;
  /** The number alerts go to, as stored (+58…), or null. */
  phone: string | null;
  /** The professional's latest alert. */
  last: { status: string; error: string | null; created_at: string; starts_at: string } | null;
};

const stamp = (timestamp: string) => `${formatDay(localDay(timestamp), "short")}, ${formatTime(timestamp)}`;

/**
 * Avisos a médicos: each doctor's (and the medical director's) number for
 * the new-visit alerts, with the latest alert they got. Administrators add,
 * change and remove the numbers here.
 */
export function DoctorAlertsCard({ doctors, paused }: { doctors: DoctorAlertRow[]; paused: boolean }) {
  const withPhone = doctors.filter((d) => d.phone).length;
  return (
    <Card>
      <CardHeader
        title="Avisos a médicos"
        hint="Un WhatsApp al médico en cuanto se le agenda una cita, en línea o en recepción, con el paciente, el día, la hora y el servicio"
        action={
          paused ? (
            <Badge tone="outline">En pausa</Badge>
          ) : (
            <Badge tone={withPhone ? "teal" : "outline"}>
              {withPhone} de {doctors.length} con número
            </Badge>
          )
        }
      />
      {doctors.length ? (
        <ul className="divide-y divide-line">
          {doctors.map((doctor) => {
            const status = doctor.last ? (MESSAGE_STATUS[doctor.last.status] ?? { label: doctor.last.status, tone: "outline" as const }) : null;
            return (
              <li key={doctor.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doctor.name}</p>
                    <p className="text-[13px] text-muted">
                      {doctor.role ? ROLE_INFO[doctor.role].label : "Profesional"} ·{" "}
                      {doctor.phone ? formatPhone(doctor.phone) : "sin número, no recibe avisos"}
                    </p>
                  </div>
                  <Modal
                    trigger={doctor.phone ? "Cambiar" : "Añadir número"}
                    triggerIcon={doctor.phone ? undefined : "plus"}
                    triggerLabel={`${doctor.phone ? "Cambiar el número" : "Añadir un número"} de ${doctor.name}`}
                    title={`WhatsApp de ${doctor.name}`}
                    description="Le llega un aviso desde el número del centro cada vez que se le agenda una cita. Añádelo con su autorización: WhatsApp exige que acepte recibir mensajes del centro."
                    icon="chat"
                    size="sm"
                  >
                    <ActionForm action={saveDoctorWhatsApp}>
                      <input type="hidden" name="professional" value={doctor.id} />
                      <Field label="Celular con WhatsApp" hint="04xx-xxxxxxx, o con el código del país si es del exterior (+…).">
                        <input
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="off"
                          maxLength={40}
                          defaultValue={doctor.phone ? formatPhone(doctor.phone) : ""}
                          placeholder="0414-1234567"
                          className={inputClass}
                        />
                      </Field>
                      <ModalActions>
                        {doctor.phone && (
                          <SubmitButton variant="danger" name="remove" value="1" pendingLabel="Quitando…">
                            Quitar número
                          </SubmitButton>
                        )}
                        <SubmitButton icon="check" pendingLabel="Guardando…">
                          Guardar
                        </SubmitButton>
                      </ModalActions>
                    </ActionForm>
                  </Modal>
                </div>
                {doctor.last && status && (
                  <p className="text-[13px] text-muted">
                    Último aviso: <span className="text-ink">{status.label.toLowerCase()}</span> · {stamp(doctor.last.created_at)} · cita del{" "}
                    {formatDay(localDay(doctor.last.starts_at), "short")}
                  </p>
                )}
                {doctor.last?.error && (doctor.last.status === "failed" || doctor.last.status === "skipped") && (
                  <p className="text-[13px] text-[#b03a36]">{doctor.last.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="stethoscope" title="Todavía no hay médicos">
          Aparecen aquí los miembros con el rol Médico o Director médico (Administración › Miembros).
        </EmptyState>
      )}
    </Card>
  );
}
