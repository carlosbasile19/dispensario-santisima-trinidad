"use client";

import { DatePicker, TimePicker } from "@/components/crm/date-picker";
import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { Select } from "@/components/crm/select";
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
          <DatePicker name="date" required defaultValue={day} />
        </Field>
        <Field label="Hora">
          <TimePicker name="time" required defaultValue="08:00" />
        </Field>
        <Field label="Duración">
          <Select
            name="duration"
            defaultValue="30"
            triggerIcon="clock"
            searchable={false}
            options={DURATIONS.map((minutes) => ({ value: String(minutes), label: formatDuration(minutes) }))}
          />
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
