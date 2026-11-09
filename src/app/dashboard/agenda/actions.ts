"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import {
  DURATIONS,
  PAYMENT_METHODS,
  clinicToday,
  isAppointmentStatus,
  isIsoDate,
  isPaymentMethod,
  isTime,
  isUuid,
} from "@/lib/crm/clinic";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { centsToInput, parseCents, parseRate } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Every action checks the member's profile first; RLS and the database
// functions check again. Amounts are validated to at most 15 significant
// digits, which JSON carries to Postgres exactly.

const NO_SCHEDULE = "Tu perfil no puede modificar la agenda.";
const NO_PAYMENTS = "Tu perfil no puede registrar cobros.";

const duration = (value: FormDataEntryValue | null) => {
  const minutes = Number(value);
  return (DURATIONS as readonly number[]).includes(minutes) ? minutes : null;
};

const amount = (cents: bigint) => Number(centsToInput(cents));

/** A price typed by the front desk: "" (use the centre's price), or dollars with up to 2 decimals. */
const price = (value: unknown): number | null | undefined => {
  if (value === undefined || value === null || value === "") return null;
  const cents = typeof value === "string" ? parseCents(value) : null;
  return cents === null || cents > 99_999_999n ? undefined : amount(cents);
};

type ItemInput = { service_id: string; professional_id: string | null; price_usd: number | null };

function parseItems(raw: FormDataEntryValue | null): ItemInput[] | null {
  let list: unknown;
  try {
    list = JSON.parse(String(raw ?? "[]"));
  } catch {
    return null;
  }
  if (!Array.isArray(list) || list.length === 0 || list.length > 20) return null;
  const items: ItemInput[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) return null;
    const { service_id, professional_id, price_usd } = entry as Record<string, unknown>;
    const parsedPrice = price(price_usd);
    if (!isUuid(service_id) || parsedPrice === undefined) return null;
    if (professional_id && !isUuid(professional_id)) return null;
    items.push({ service_id, professional_id: isUuid(professional_id) ? professional_id : null, price_usd: parsedPrice });
  }
  return items;
}

/** Books a visit with one or more services, each with its professional and price. */
export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };

  const patient = formData.get("patient");
  const date = formData.get("date");
  const time = formData.get("time");
  const minutes = duration(formData.get("duration"));
  const items = parseItems(formData.get("items"));
  if (!isUuid(patient)) return { error: "Elige el paciente." };
  if (!isIsoDate(date) || !isTime(time)) return { error: "Elige el día y la hora de la cita." };
  if (!minutes) return { error: "Elige la duración de la cita." };
  if (!items) return { error: "Añade al menos un servicio y revisa los precios." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_appointment", {
    patient,
    local_date: date,
    local_time: time,
    duration_minutes: minutes,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000),
    items,
  });
  if (error || !data) return { error: dbErrorMessage(error, "No se pudo agendar la cita. Inténtalo de nuevo.") };

  redirect(`/dashboard/agenda/${data}`);
}

export async function setAppointmentStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const id = formData.get("appointment");
  const status = formData.get("status");
  if (!isUuid(id) || !isAppointmentStatus(status)) return { error: "Estado no válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return undefined;
}

export async function rescheduleAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const id = formData.get("appointment");
  const date = formData.get("date");
  const time = formData.get("time");
  const minutes = duration(formData.get("duration"));
  if (!isUuid(id) || !isIsoDate(date) || !isTime(time) || !minutes) return { error: "Revisa el día, la hora y la duración." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    appointment: id,
    local_date: date,
    local_time: time,
    duration_minutes: minutes,
  });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { message: "Cita movida." };
}

export async function saveAppointmentNotes(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const id = formData.get("appointment");
  if (!isUuid(id)) return { error: "Cita no válida." };
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ notes }).eq("id", id);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { message: "Nota guardada." };
}

/** Adds a service to an existing visit. */
export async function addAppointmentItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const appointment = formData.get("appointment");
  const items = parseItems(formData.get("items"));
  if (!isUuid(appointment) || !items || items.length !== 1) return { error: "Elige el servicio y revisa el precio." };
  const [item] = items;

  const supabase = await createClient();
  // list_price_usd is set (and a missing price_usd defaulted) by the appointment_items_prepare trigger.
  const row = { appointment_id: appointment, ...item } as TablesInsert<"appointment_items">;
  const { error } = await supabase.from("appointment_items").insert(row);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { message: "Servicio añadido." };
}

/** Changes the professional or the price of one service of a visit. */
export async function updateAppointmentItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const id = formData.get("item");
  const professional = formData.get("professional");
  const newPrice = price(formData.get("price"));
  if (!isUuid(id) || (professional && !isUuid(professional)) || newPrice == null) {
    return { error: "Revisa el profesional y el precio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_items")
    .update({ professional_id: isUuid(professional) ? professional : null, price_usd: newPrice })
    .eq("id", id);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { message: "Servicio actualizado." };
}

export async function removeAppointmentItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return { error: NO_SCHEDULE };
  const id = formData.get("item");
  const appointment = formData.get("appointment");
  if (!isUuid(id) || !isUuid(appointment)) return { error: "Servicio no válido." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("appointment_items")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointment);
  if ((count ?? 0) <= 1) return { error: "Una cita necesita al menos un servicio. Si no va, cancélala." };

  const { error } = await supabase.from("appointment_items").delete().eq("id", id);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return undefined;
}

/**
 * Sets or corrects a day's BCV rate. The front desk may set today's rate;
 * Contabilidad any day's. The database recalculates that day's payments.
 */
export async function setExchangeRate(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const day = formData.get("day");
  const rate = parseRate(String(formData.get("rate") ?? ""));
  if (!isIsoDate(day)) return { error: "Elige el día." };
  const allowed = viewer.permissions.accounting || (viewer.permissions.collectPayments && day === clinicToday());
  if (!allowed) return { error: "Tu perfil solo puede cargar la tasa del día de hoy." };
  // Up to 7 integer digits keeps the rate within 15 significant digits.
  if (!rate || rate >= 10n ** 15n) return { error: "Escribe la tasa en bolívares por dólar, con hasta 8 decimales." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_exchange_rate", { rate_day: day, bs_per_usd: Number(rate) / 1e8 });
  if (error) return { error: dbErrorMessage(error, "No se pudo guardar la tasa.") };
  refresh();
  return { message: "Tasa guardada." };
}

/**
 * Records money received for a visit, today, at today's rate. Dollar methods
 * take the amount in dollars; bolívar methods the amount in bolívares. The
 * database converts, and refuses a payment above the balance.
 */
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.collectPayments) return { error: NO_PAYMENTS };

  const appointment = formData.get("appointment");
  const method = formData.get("method");
  const received = parseCents(String(formData.get("amount") ?? ""));
  if (!isUuid(appointment) || !isPaymentMethod(method)) return { error: "Elige la forma de pago." };
  if (!received || received <= 0n) return { error: "Escribe el monto recibido." };
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 60) || null;

  const value = amount(received);
  // paid_on, currency, rate and the other currency's amount are set by the
  // payments_apply_rate trigger; members cannot write them.
  const row = {
    appointment_id: appointment,
    method,
    reference,
    ...(PAYMENT_METHODS[method].currency === "USD" ? { amount_usd: value } : { amount_bs: value }),
  } as TablesInsert<"payments">;
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert(row);
  if (error) return { error: dbErrorMessage(error, "No se pudo registrar el cobro.") };
  refresh();
  return { message: "Cobro registrado." };
}
