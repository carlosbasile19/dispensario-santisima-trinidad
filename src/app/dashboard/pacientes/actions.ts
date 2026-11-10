"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { isIdType, isIsoDate, isTime, isUuid, clinicToday } from "@/lib/crm/clinic";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, name: string, max: number) => {
  const value = String(formData.get(name) ?? "").trim().replace(/\s+/g, " ");
  return value ? value.slice(0, max) : null;
};

/**
 * Registers a patient or updates one (when the form carries an id). Front
 * desk and administrators only; RLS checks again. A new patient opens their
 * page, or goes straight to booking when the form came from "Nueva cita".
 */
export async function savePatient(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: "Tu perfil no puede registrar pacientes." };

  const id = formData.get("id");
  const firstName = text(formData, "first_name", 80);
  const lastName = text(formData, "last_name", 80);
  if (!firstName || !lastName) return { error: "Escribe los nombres y los apellidos." };

  const idType = formData.get("id_type");
  // A cédula is often typed as "V-12.345.678": keep its digits. A passport keeps letters too.
  const typed = String(formData.get("id_number") ?? "").toUpperCase();
  const rawNumber = typed.replace(idType === "P" ? /[^0-9A-Z]/g : /\D/g, "");
  // No number means no document (young children often have none), whatever the type says.
  let document: { id_type: string | null; id_number: string | null } = { id_type: null, id_number: null };
  if (rawNumber) {
    if (!isIdType(idType)) return { error: "Elige el tipo de documento (V, E o pasaporte)." };
    const valid = idType === "P" ? /^[0-9A-Z]{4,15}$/.test(rawNumber) : /^\d{5,10}$/.test(rawNumber);
    if (!valid) {
      return { error: idType === "P" ? "Revisa el número de pasaporte." : "La cédula debe tener entre 5 y 10 dígitos." };
    }
    document = { id_type: idType, id_number: rawNumber };
  }

  const birthDate = String(formData.get("birth_date") ?? "");
  if (birthDate && (!isIsoDate(birthDate) || birthDate < "1900-01-01" || birthDate > (await clinicToday()))) {
    return { error: "Revisa la fecha de nacimiento." };
  }
  const sex = formData.get("sex");
  const email = text(formData, "email", 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Revisa el correo." };

  // Only when the form carries the field, so another form never clears the answer.
  const consent = formData.get("whatsapp_consent");
  const whatsapp: { whatsapp_consent?: boolean | null } = formData.has("whatsapp_consent")
    ? { whatsapp_consent: consent === "yes" ? true : consent === "no" ? false : null }
    : {};

  const patient = {
    first_name: firstName,
    last_name: lastName,
    ...document,
    birth_date: birthDate || null,
    sex: sex === "F" || sex === "M" ? sex : null,
    phone: text(formData, "phone", 30),
    email: email?.toLowerCase() ?? null,
    address: text(formData, "address", 300),
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
    ...whatsapp,
  };

  const supabase = await createClient();

  if (isUuid(id)) {
    const { error } = await supabase.from("patients").update(patient).eq("id", id);
    if (error) {
      return { error: error.code === "23505" ? "Ya hay otro paciente con ese documento." : dbErrorMessage(error) };
    }
    refresh();
    return { message: "Datos del paciente guardados." };
  }

  const { data, error } = await supabase.from("patients").insert(patient).select("id").single();
  if (error || !data) {
    return {
      error:
        error?.code === "23505"
          ? "Ya hay un paciente registrado con ese documento. Búscalo en Pacientes."
          : dbErrorMessage(error),
    };
  }

  if (formData.get("then") === "book") {
    const query = new URLSearchParams({ paciente: data.id });
    const day = formData.get("fecha");
    const time = formData.get("hora");
    const professional = formData.get("profesional");
    if (isIsoDate(day)) query.set("fecha", day);
    if (isTime(time)) query.set("hora", time);
    if (isUuid(professional)) query.set("profesional", professional);
    redirect(`/dashboard/agenda/nueva?${query}`);
  }
  redirect(`/dashboard/pacientes/${data.id}`);
}
