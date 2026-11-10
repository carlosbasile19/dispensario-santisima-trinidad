"use client";

import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Select } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { ID_TYPES } from "@/lib/crm/clinic";
import type { Tables } from "@/lib/supabase/database.types";
import { savePatient } from "./actions";

type Patient = Pick<
  Tables<"patients">,
  | "id"
  | "first_name"
  | "last_name"
  | "id_type"
  | "id_number"
  | "birth_date"
  | "sex"
  | "phone"
  | "email"
  | "address"
  | "notes"
  | "whatsapp_consent"
>;

const DOCUMENT_OPTIONS = [
  { value: "V", label: "V", description: "Venezolano", icon: "id-card" as const },
  { value: "E", label: "E", description: "Extranjero", icon: "id-card" as const },
  { value: "P", label: "Pasaporte", description: "Letras y números", icon: "id-card" as const },
  { value: "", label: "Sin cédula", description: "Por ejemplo, un niño" },
];

const WHATSAPP_OPTIONS = [
  { value: "yes", label: "Acepta", description: "Confirmación y recordatorio de sus citas", icon: "chat" as const },
  { value: "no", label: "No acepta", description: "No se le envían mensajes" },
  { value: "", label: "Sin preguntar" },
];

const consentValue = (consent: boolean | null | undefined) => (consent === true ? "yes" : consent === false ? "no" : "");

const SEX_OPTIONS = [
  { value: "", label: "Sin indicar" },
  { value: "F", label: "Femenino" },
  { value: "M", label: "Masculino" },
];

/**
 * Registers a patient, or edits one when `patient` is given. With `thenBook`
 * the new patient goes straight to "Nueva cita". `inModal` lays it out for
 * a modal, with the buttons in its footer.
 */
export function PatientForm({
  patient,
  thenBook,
  day,
  time,
  professionalId,
  today,
  inModal = false,
}: {
  patient?: Patient;
  thenBook?: boolean;
  day?: string;
  /** With thenBook: the time and professional to book with (a slot picked on a calendar). */
  time?: string;
  professionalId?: string;
  /** Latest valid birth date. */
  today: string;
  inModal?: boolean;
}) {
  const submit = (
    <SubmitButton icon={patient ? "check" : "plus"} pendingLabel="Guardando…">
      {patient ? "Guardar cambios" : thenBook ? "Registrar y agendar" : "Registrar paciente"}
    </SubmitButton>
  );
  return (
    <ActionForm action={savePatient} className={`flex flex-col gap-5 ${inModal ? "" : "px-5 py-5"}`}>
      {patient && <input type="hidden" name="id" value={patient.id} />}
      {thenBook && <input type="hidden" name="then" value="book" />}
      {day && <input type="hidden" name="fecha" value={day} />}
      {time && <input type="hidden" name="hora" value={time} />}
      {professionalId && <input type="hidden" name="profesional" value={professionalId} />}

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
          <Select
            name="id_type"
            defaultValue={patient?.id_type ?? "V"}
            options={DOCUMENT_OPTIONS.filter((o) => o.value === "" || o.value in ID_TYPES)}
            searchable={false}
            panelMinWidth={220}
          />
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
          <Select name="sex" defaultValue={patient?.sex ?? ""} options={SEX_OPTIONS} searchable={false} panelMinWidth={180} />
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

      <Field
        label="Mensajes por WhatsApp"
        hint="Pregúntale si quiere recibir en su celular la confirmación y el recordatorio de sus citas."
      >
        <Select
          name="whatsapp_consent"
          defaultValue={patient ? consentValue(patient.whatsapp_consent) : "yes"}
          options={WHATSAPP_OPTIONS}
          searchable={false}
          panelMinWidth={280}
        />
      </Field>

      <Field label="Dirección">
        <input name="address" maxLength={300} autoComplete="off" defaultValue={patient?.address ?? ""} className={inputClass} />
      </Field>

      <Field label="Notas administrativas" hint="Por ejemplo, el representante de un menor. No es historia clínica.">
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={patient?.notes ?? ""} className={`${inputClass} h-auto py-2`} />
      </Field>

      {inModal ? <ModalActions>{submit}</ModalActions> : <div>{submit}</div>}
    </ActionForm>
  );
}
