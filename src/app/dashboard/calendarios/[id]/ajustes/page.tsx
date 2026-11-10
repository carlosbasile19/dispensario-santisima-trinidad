import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionForm, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Modal } from "@/components/crm/modal";
import { Card, CardHeader, FormSkeleton } from "@/components/crm/ui";
import { getCalendar } from "@/lib/crm/calendars";
import { AREA_LABEL, isUuid } from "@/lib/crm/clinic";
import { getServices } from "@/lib/crm/data";
import { slotLabel } from "@/lib/crm/schedule";
import { getViewer } from "@/lib/crm/viewer";
import { deleteCalendar, saveCalendarServices } from "../../actions";
import { ServicePicker } from "../../service-picker";
import { SettingsForm } from "../../settings-form";

export const metadata: Metadata = { title: "Servicios y reservas" };

type Props = PageProps<"/dashboard/calendarios/[id]/ajustes">;

const NOTICE_LABEL = (hours: number) =>
  hours === 0 ? "Sin mínimo" : hours < 24 ? `${hours} ${hours === 1 ? "hora" : "horas"} antes` : `${hours / 24} ${hours === 24 ? "día" : "días"} antes`;

// What patients can book on the calendar and how: its services (each with
// 30-minute or 1-hour slots), whether it takes bookings, the texts patients
// read, the minimum notice, how far ahead and its link.
export default function CalendarSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Servicios" />
            <FormSkeleton fields={3} className="px-5 py-5" />
          </Card>
          <Card>
            <CardHeader title="Reserva en línea" />
            <FormSkeleton fields={4} className="px-5 py-5" />
          </Card>
        </div>
      }
    >
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Props["params"] }) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (!isUuid(id)) notFound();
  const [calendar, services] = await Promise.all([getCalendar(id), getServices()]);
  if (!calendar) notFound();
  const canEdit = viewer.permissions.manageCalendars;
  const offered = calendar.services.filter((s) => s.active);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Servicios" hint="Lo que los pacientes pueden agendar en línea con este médico" />
        {canEdit ? (
          <ActionForm action={saveCalendarServices} className="flex flex-col gap-5 px-5 py-5">
            <input type="hidden" name="calendar" value={calendar.id} />
            <ServicePicker
              services={services.filter((s) => s.active)}
              initial={offered.map((s) => ({ service_id: s.serviceId, minutes: s.minutes === 60 ? 60 : 30 }))}
            />
            <div>
              <SubmitButton icon="check" pendingLabel="Guardando…">
                Guardar servicios
              </SubmitButton>
            </div>
          </ActionForm>
        ) : offered.length ? (
          <ul className="divide-y divide-line">
            {offered.map((s) => (
              <li key={s.serviceId} className="flex justify-between gap-4 px-5 py-3 text-sm">
                <span>
                  {s.name} <span className="text-muted">· {AREA_LABEL[s.area]}</span>
                </span>
                <span className="text-muted">Cupos de {slotLabel(s.minutes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-5 text-sm text-muted">Todavía no tiene servicios para agendar en línea.</p>
        )}
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Reserva en línea" hint="Qué ven los pacientes y hasta cuándo pueden agendar" />
          {canEdit ? (
            <SettingsForm
              calendar={{
                id: calendar.id,
                slug: calendar.slug,
                specialty: calendar.specialty,
                intro: calendar.intro,
                accepting: calendar.accepting,
                minNoticeHours: calendar.minNoticeHours,
                horizonDays: calendar.horizonDays,
              }}
            />
          ) : (
            <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-2">
              {[
                ["Estado", calendar.accepting ? "Recibe citas en línea" : "En pausa"],
                ["Especialidad", calendar.specialty ?? "—"],
                ["Anticipación mínima", NOTICE_LABEL(calendar.minNoticeHours)],
                ["Se puede agendar con", `${calendar.horizonDays} días de anticipación`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</dt>
                  <dd className="mt-1">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        {canEdit && (
          <Card>
            <CardHeader
              title="Eliminar calendario"
              hint="El enlace deja de funcionar. Las citas ya agendadas siguen en la agenda."
              action={
                <Modal
                  trigger="Eliminar"
                  triggerIcon="trash"
                  triggerVariant="quiet"
                  title="¿Eliminar este calendario?"
                  description={`Se borran el horario, los días especiales y los servicios del calendario de ${calendar.professional.name}, y su enlace deja de funcionar. Las citas ya agendadas no se tocan.`}
                  icon="trash"
                  tone="coral"
                  size="sm"
                >
                  <ActionForm action={deleteCalendar}>
                    <input type="hidden" name="calendar" value={calendar.id} />
                    <ModalActions>
                      <SubmitButton variant="destructive" pendingLabel="Eliminando…">
                        Eliminar calendario
                      </SubmitButton>
                    </ModalActions>
                  </ActionForm>
                </Modal>
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
}
