"use client";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { ID_TYPES } from "@/lib/crm/clinic";
import type { Tables } from "@/lib/supabase/database.types";
import { savePatient } from "./actions";

type Patient = Pick<
  Tables<"patients">,
  "id" | "first_name" | "last_name" | "id_type" | "id_number" | "birth_date" | "sex" | "phone" | "email" | "address" | "notes"
>;

/**
 * Registers a patient, or edits one when `patient` is given. With `thenBook`
 * the new patient goes straight to "Nueva cita".
 */
export function PatientForm({
  patient,
  thenBook,
  day,
  today,
}: {
  patient?: Patient;
  thenBook?: boolean;
  day?: string;
  /** Latest valid birth date. */
  today: string;
}) {
  return (
    <ActionForm action={savePatient} className="flex flex-col gap-5 px-5 py-5">
      {patient && <input type="hidden" name="id" value={patient.id} />}
      {thenBook && <input type="hidden" name="then" value="book" />}
      {day && <input type="hidden" name="fecha" value={day} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres">
          <input name="first_name" required maxLength={80} autoComplete="off" defaultValue={patient?.first_name} className={inputClass} />
        </Field>
        <Field label="Apellidos">
          <input name="last_name" required maxLength={80} autoComplete="off" defaultValue={patient?.last_name} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[140px_1fr_1fr_140px]">
        <Field label="Documento">
          <select name="id_type" defaultValue={patient?.id_type ?? "V"} className={inputClass}>
            {Object.entries(ID_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="">Sin cédula</option>
          </select>
        </Field>
        <Field label="Número" hint="Solo números. Vacío si no tiene (por ejemplo, un niño).">
          <input
            name="id_number"
            inputMode="numeric"
            maxLength={15}
            autoComplete="off"
            defaultValue={patient?.id_number ?? ""}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Fecha de nacimiento">
          <input type="date" name="birth_date" min="1900-01-01" max={today} defaultValue={patient?.birth_date ?? ""} className={inputClass} />
        </Field>
        <Field label="Sexo">
          <select name="sex" defaultValue={patient?.sex ?? ""} className={inputClass}>
            <option value="">—</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono">
          <input name="phone" type="tel" maxLength={30} autoComplete="off" defaultValue={patient?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" maxLength={120} autoComplete="off" defaultValue={patient?.email ?? ""} className={inputClass} />
        </Field>
      </div>

      <Field label="Dirección">
        <input name="address" maxLength={300} autoComplete="off" defaultValue={patient?.address ?? ""} className={inputClass} />
      </Field>

      <Field label="Notas administrativas" hint="Por ejemplo, el representante de un menor. No es historia clínica.">
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={patient?.notes ?? ""} className={`${inputClass} h-auto py-2`} />
      </Field>

      <div>
        <SubmitButton icon={patient ? "check" : "plus"} pendingLabel="Guardando…">
          {patient ? "Guardar cambios" : thenBook ? "Registrar y agendar" : "Registrar paciente"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
