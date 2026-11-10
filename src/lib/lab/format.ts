// Dates, times and names as the lab's documents print them. Plain Intl, so
// the boleta, the editor and the PDF (also rendered outside a request, for
// the sample sent to Meta) all format the same way.

import type { ReportPatient } from "./types";

const TIME_ZONE = "America/Caracas";

const longDay = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const clock = new Intl.DateTimeFormat("es-VE", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

const utcNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/** "10 de noviembre de 2026". */
export const dayLong = (day: string) => longDay.format(utcNoon(day));
/** "10/11/2026", as the boleta prints dates. */
export const dayShort = (day: string) => shortDay.format(utcNoon(day));

/** "07:30" (clinic time, 24 h) → "7:30 a. m.". */
export function clockTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** A timestamp's clinic day ("YYYY-MM-DD") and time ("3:41 p. m."). */
export const stampDay = (timestamp: string) => isoDay.format(new Date(timestamp));
export const stampTime = (timestamp: string) => clock.format(new Date(timestamp));
/** "10 de noviembre de 2026, 3:41 p. m." */
export const stampLong = (timestamp: string) => `${dayLong(stampDay(timestamp))}, ${stampTime(timestamp)}`;

export const fullName = (p: Pick<ReportPatient, "first_name" | "last_name">) => `${p.first_name} ${p.last_name}`.trim();

/** "V-12.345.678", "Pasaporte AB123"; null without a document. */
export function documentOf(p: Pick<ReportPatient, "id_type" | "id_number">) {
  if (!p.id_type || !p.id_number) return null;
  if (p.id_type === "P") return `Pasaporte ${p.id_number}`;
  const grouped = /^\d+$/.test(p.id_number) ? new Intl.NumberFormat("es-VE").format(Number(p.id_number)) : p.id_number;
  return `${p.id_type}-${grouped}`;
}

export const sexLabel = (sex: string | null) => (sex === "F" ? "Femenino" : sex === "M" ? "Masculino" : null);
