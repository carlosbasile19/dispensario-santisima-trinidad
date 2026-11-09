// Vocabulary and calendar of the clinic, shared by server and client code.
// The clinic runs on America/Caracas time; dates travel as "YYYY-MM-DD".

import { io } from "next/cache";

import type { IconName } from "@/components/crm/icons";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type ServiceArea = Enums["service_area"];
export type AppointmentStatus = Enums["appointment_status"];
export type PaymentMethod = Enums["payment_method"];
export type Currency = "USD" | "VES";

export const CLINIC_TIME_ZONE = "America/Caracas";

export const SERVICE_AREAS: readonly ServiceArea[] = ["medicina", "odontologia", "bioanalisis"];
export const AREA_LABEL: Record<ServiceArea, string> = {
  medicina: "Medicina",
  odontologia: "Odontología",
  bioanalisis: "Bioanálisis",
};
export const AREA_ICON: Record<ServiceArea, IconName> = {
  medicina: "stethoscope",
  odontologia: "tooth",
  bioanalisis: "flask",
};
export const isServiceArea = (value: unknown): value is ServiceArea =>
  typeof value === "string" && (SERVICE_AREAS as readonly string[]).includes(value);

type Tone = "neutral" | "navy" | "teal" | "solid" | "coral" | "outline";
export const STATUS_INFO: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Agendada", tone: "neutral" },
  confirmed: { label: "Confirmada", tone: "navy" },
  checked_in: { label: "En sala", tone: "teal" },
  completed: { label: "Atendida", tone: "solid" },
  cancelled: { label: "Cancelada", tone: "outline" },
  no_show: { label: "No asistió", tone: "coral" },
};
export const APPOINTMENT_STATUSES = Object.keys(STATUS_INFO) as AppointmentStatus[];
export const isAppointmentStatus = (value: unknown): value is AppointmentStatus =>
  typeof value === "string" && value in STATUS_INFO;

/** The moves the front desk is offered from each status, as [target, button label]. */
export const STATUS_ACTIONS: Record<AppointmentStatus, [AppointmentStatus, string][]> = {
  scheduled: [["confirmed", "Confirmar"], ["checked_in", "Registrar llegada"], ["no_show", "No asistió"], ["cancelled", "Cancelar cita"]],
  confirmed: [["checked_in", "Registrar llegada"], ["no_show", "No asistió"], ["cancelled", "Cancelar cita"]],
  checked_in: [["completed", "Marcar atendida"], ["confirmed", "Deshacer llegada"]],
  completed: [["checked_in", "Reabrir"]],
  cancelled: [["scheduled", "Reactivar"]],
  no_show: [["scheduled", "Reactivar"]],
};

/** Statuses whose visit is not charged (excluded from cuentas por cobrar). */
export const UNBILLED_STATUSES: readonly AppointmentStatus[] = ["cancelled", "no_show"];

/**
 * How a visit can be paid. `currency` is what the amount is typed in (the
 * database derives the other one at the day's BCV rate, see
 * payment_method_currency). Cashea is financing, not money received: the
 * patient pays an inicial in the centre with another method and Cashea
 * guarantees the rest, which the centre collects in cuotas.
 */
export const PAYMENT_METHODS: Record<
  PaymentMethod,
  { label: string; short: string; currency: Currency; icon: IconName; financed?: boolean; reference: boolean }
> = {
  cash_usd: { label: "Efectivo en dólares", short: "Efectivo", currency: "USD", icon: "cash", reference: false },
  zelle: { label: "Zelle", short: "Zelle", currency: "USD", icon: "send", reference: true },
  pago_movil: { label: "Pago móvil", short: "Pago móvil", currency: "VES", icon: "mobile", reference: true },
  card_bs: { label: "Punto de venta", short: "Punto", currency: "VES", icon: "card", reference: true },
  transfer_bs: { label: "Transferencia en bolívares", short: "Transferencia", currency: "VES", icon: "bank", reference: true },
  cash_bs: { label: "Efectivo en bolívares", short: "Efectivo", currency: "VES", icon: "coins", reference: false },
  cashea: { label: "Cashea", short: "Cashea", currency: "USD", icon: "installments", financed: true, reference: false },
};
export const PAYMENT_METHOD_LIST = Object.keys(PAYMENT_METHODS) as PaymentMethod[];
/** Money received at the desk (everything but financing). */
export const RECEIVED_METHODS = PAYMENT_METHOD_LIST.filter((m) => !PAYMENT_METHODS[m].financed);
export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" && value in PAYMENT_METHODS;

/** The groups the payment pickers show. */
export const PAYMENT_GROUPS: { label: string; methods: PaymentMethod[] }[] = [
  { label: "En dólares", methods: RECEIVED_METHODS.filter((m) => PAYMENT_METHODS[m].currency === "USD") },
  { label: "En bolívares · tasa BCV", methods: RECEIVED_METHODS.filter((m) => PAYMENT_METHODS[m].currency === "VES") },
  { label: "Financiado", methods: PAYMENT_METHOD_LIST.filter((m) => PAYMENT_METHODS[m].financed) },
];

export const DURATIONS = [15, 20, 30, 45, 60, 90, 120] as const;

/** 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min". */
export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const ID_TYPES = { V: "V", E: "E", P: "Pasaporte" } as const;
export type IdType = keyof typeof ID_TYPES;
export const isIdType = (value: unknown): value is IdType => typeof value === "string" && value in ID_TYPES;

// Calendar ------------------------------------------------------------------

const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today in the clinic, "YYYY-MM-DD". Awaits `io()` so the clock is read at
 * request time: after a session read (`getViewer()`), Next.js may still be
 * rendering the App Shell, and a bare `new Date()` there fails the prerender.
 */
export async function clinicToday() {
  await io();
  return clinicDayOf(new Date());
}

/** The clinic's calendar day of an instant, "YYYY-MM-DD". Safe in the browser (e.g. a picker's "Hoy"). */
export const clinicDayOf = (instant: Date) => isoDay.format(instant);

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export const isTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const utcDate = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const addDays = (iso: string, days: number) => {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dayFormats = {
  long: new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }),
  full: new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  short: new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }),
};

/** A "YYYY-MM-DD" day: "lunes, 9 de noviembre" (long), with the year (full) or "9 nov 2026" (short). */
export const formatDay = (iso: string, style: keyof typeof dayFormats = "long") => dayFormats[style].format(utcDate(iso));

const timeFormat = new Intl.DateTimeFormat("es-VE", { timeZone: CLINIC_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A timestamp's clinic time: "9:30 a. m." */
export const formatTime = (timestamp: string) => timeFormat.format(new Date(timestamp));
/** A timestamp's clinic time for a time input: "09:30". */
export const localTime = (timestamp: string) => clock.format(new Date(timestamp));
/** A timestamp's clinic day: "YYYY-MM-DD". */
export const localDay = (timestamp: string) => isoDay.format(new Date(timestamp));

export const endTime = (timestamp: string, minutes: number) =>
  formatTime(new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString());

/** Whole years between a birth date and a day, both "YYYY-MM-DD". */
export function ageOn(birthDate: string, day: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// People ----------------------------------------------------------------------

type PatientName = { first_name: string; last_name: string };
export const patientName = (p: PatientName) => `${p.first_name} ${p.last_name}`.trim();

/** "V-12.345.678", "E-81.234.567" or "Pasaporte 123ABC"; null without a document. */
export function formatDocument(p: { id_type: string | null; id_number: string | null }) {
  if (!p.id_type || !p.id_number) return null;
  if (p.id_type === "P") return `Pasaporte ${p.id_number}`;
  const grouped = /^\d+$/.test(p.id_number)
    ? new Intl.NumberFormat("es-VE").format(Number(p.id_number))
    : p.id_number;
  return `${p.id_type}-${grouped}`;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** First value of a search param. */
export const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
