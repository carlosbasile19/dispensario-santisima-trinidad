import "server-only";
import { cache } from "react";

import { syncTodayOnDemand } from "@/lib/bcv/sync";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, ServiceArea } from "./clinic";
import type { Role } from "./roles";

// Reads shared by the platform pages. Every query runs as the signed-in
// member, so RLS decides what comes back: a doctor only gets their own
// appointments and patients, and only collectors get payments.

export type Professional = { id: string; name: string; role: Role | null };

/** Doctors and the medical director (plus anyone already assigned), by id. */
export const getProfessionals = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("clinic_professionals");
  const list: Professional[] = (data ?? []).map((p) => ({ id: p.id, name: p.full_name, role: p.role }));
  return { list, byId: new Map(list.map((p) => [p.id, p])) };
});

export const getServices = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, area, name, price_usd, active")
    .order("area")
    .order("name");
  return data ?? [];
});

export type Service = Awaited<ReturnType<typeof getServices>>[number];

const RATE_FIELDS = "rate_date, bs_per_usd, updated_at, source, fecha_valor, official_bs_per_usd";

async function readRate(day: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("exchange_rates").select(RATE_FIELDS).eq("rate_date", day).maybeSingle();
  return data;
}

/** The BCV rate of a day, or null if it has not been set. */
export const getRate = cache(readRate);

export type Rate = NonNullable<Awaited<ReturnType<typeof readRate>>>;

/**
 * Today's rate. When it is missing (the scheduled job has not run), it is
 * fetched from the BCV right away, so the front desk does not have to type it.
 */
export const getTodayRate = cache(async (today: string) => {
  const rate = await getRate(today);
  if (rate || !(await syncTodayOnDemand())) return rate;
  return readRate(today);
});

/** The most recent rates up to a day, newest first. */
export async function getRecentRates(upTo: string, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exchange_rates")
    .select(RATE_FIELDS)
    .lte("rate_date", upTo)
    .order("rate_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

const APPOINTMENT_FIELDS =
  "id, starts_at, starts_on, duration_minutes, status, notes, " +
  "patient:patients(id, first_name, last_name, id_type, id_number, phone, birth_date), " +
  "items:appointment_items(id, service_id, professional_id, price_usd, list_price_usd, created_at, service:services(name, area))";

/** An appointment with its patient and services, as the agenda shows it. */
export type Appointment = {
  id: string;
  starts_at: string;
  starts_on: string | null;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    id_type: string | null;
    id_number: string | null;
    phone: string | null;
    birth_date: string | null;
  } | null;
  items: {
    id: string;
    service_id: string;
    professional_id: string | null;
    price_usd: number;
    list_price_usd: number;
    created_at: string;
    service: { name: string; area: ServiceArea } | null;
  }[];
};

const sortItems = (rows: Appointment[]) => {
  for (const row of rows) row.items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return rows;
};

/** A clinic day's appointments, in time order. */
export async function getAppointmentsOn(day: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_FIELDS)
    .eq("starts_on", day)
    .order("starts_at")
    .overrideTypes<Appointment[], { merge: false }>();
  return sortItems(data ?? []);
}

export async function getAppointment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_FIELDS)
    .eq("id", id)
    .overrideTypes<Appointment[], { merge: false }>();
  return data?.length ? sortItems(data)[0] : null;
}

/** A patient's visits, newest first. */
export async function getPatientAppointments(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_FIELDS)
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false })
    .limit(100)
    .overrideTypes<Appointment[], { merge: false }>();
  return sortItems(data ?? []);
}

export type Balance = { total: number; paid: number; balance: number };

/** What each appointment costs, what was paid and what is owed, in dollars. */
export async function getBalances(appointmentIds: string[]) {
  const balances = new Map<string, Balance>();
  if (!appointmentIds.length) return balances;
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_balances")
    .select("appointment_id, total_usd, paid_usd, balance_usd")
    .in("appointment_id", appointmentIds);
  for (const row of data ?? []) {
    if (!row.appointment_id) continue;
    balances.set(row.appointment_id, {
      total: row.total_usd ?? 0,
      paid: row.paid_usd ?? 0,
      balance: row.balance_usd ?? 0,
    });
  }
  return balances;
}
