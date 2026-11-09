"use client";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { DURATIONS, formatDuration } from "@/lib/crm/clinic";
import { createAppointment } from "./actions";
import { ServiceLines, type ProfessionalOption, type ServiceOption } from "./service-lines";

/** Books a visit for one patient: day, time, duration, services and a note. */
export function AppointmentForm({
  patientId,
  day,
  services,
  professionals,
}: {
  patientId: string;
  day: string;
  services: ServiceOption[];
  professionals: ProfessionalOption[];
}) {
  return (
    <ActionForm action={createAppointment} className="flex flex-col gap-6 px-5 py-5">
      <input type="hidden" name="patient" value={patientId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Día">
          <input type="date" name="date" required defaultValue={day} className={inputClass} />
        </Field>
        <Field label="Hora">
          <input type="time" name="time" required step={300} defaultValue="08:00" className={inputClass} />
        </Field>
        <Field label="Duración">
          <select name="duration" defaultValue="30" className={inputClass}>
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted">
          Servicios. Cada uno con su profesional: una misma visita puede tener consulta, laboratorio y odontología.
        </p>
        <ServiceLines services={services} professionals={professionals} />
      </div>

      <Field label="Nota para el equipo (opcional)">
        <textarea name="notes" rows={2} maxLength={1000} className={`${inputClass} h-auto py-2`} />
      </Field>

      <div>
        <SubmitButton icon="calendar" pendingLabel="Agendando…">
          Agendar cita
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
