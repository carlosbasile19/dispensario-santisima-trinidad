// Weekly hours, slots and times of the booking calendars. Shared by the
// public booking page, the calendar editor and the week view (server and
// client). Times are the clinic's local "HH:MM"; days are "YYYY-MM-DD".

export const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
/** The editor and the week view list Monday first; weekday numbers stay 0 = Sunday (as in the database). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** A service's slots on a calendar last 30 minutes or 1 hour (calendar_services.duration_minutes). */
export const SLOT_LENGTHS = [30, 60] as const;
export type SlotLength = (typeof SLOT_LENGTHS)[number];
export const isSlotLength = (value: unknown): value is SlotLength =>
  typeof value === "number" && (SLOT_LENGTHS as readonly number[]).includes(value);
export const slotLabel = (minutes: number) => (minutes === 60 ? "1 hora" : `${minutes} min`);

export type Range = { starts: string; ends: string };
export type WeeklyRange = Range & { weekday: number };

const pad = (n: number) => String(n).padStart(2, "0");
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeOf = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const addMinutes = (time: string, minutes: number) => timeOf(minutesOf(time) + minutes);
/** "07:30:00" (as Postgres sends a time) → "07:30". */
export const hhmm = (time: string) => time.slice(0, 5);

const clockFormat = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
/** "14:30" → "2:30 p. m." */
export const formatClock = (time: string) =>
  clockFormat.format(new Date(Date.UTC(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)))));
export const formatRange = (range: Range) => `${formatClock(range.starts)} – ${formatClock(range.ends)}`;

/** The half hours an editor offers, 05:00 to 22:00. */
export const HALF_HOURS: readonly string[] = Array.from({ length: (22 - 5) * 2 + 1 }, (_, i) => timeOf(5 * 60 + i * 30));

/** What is wrong with one day's ranges, or null: an end before its start, or two ranges that overlap. */
export function rangesProblem(ranges: Range[]): string | null {
  if (ranges.some((r) => minutesOf(r.ends) <= minutesOf(r.starts))) return "La hora final debe ser después de la inicial.";
  const sorted = [...ranges].sort((a, b) => minutesOf(a.starts) - minutesOf(b.starts));
  for (let i = 1; i < sorted.length; i++) {
    if (minutesOf(sorted[i].starts) < minutesOf(sorted[i - 1].ends)) return "Los horarios de este día se solapan.";
  }
  return null;
}

const sortRanges = (ranges: Range[]) => [...ranges].sort((a, b) => minutesOf(a.starts) - minutesOf(b.starts));

/** A week's ranges grouped by weekday, each day's in time order. */
export function byWeekday(hours: WeeklyRange[]) {
  const days = new Map<number, Range[]>();
  for (const h of hours) days.set(h.weekday, [...(days.get(h.weekday) ?? []), { starts: hhmm(h.starts), ends: hhmm(h.ends) }]);
  for (const [day, ranges] of days) days.set(day, sortRanges(ranges));
  return days;
}

/**
 * The weekly hours in a few lines, consecutive days with the same hours
 * together: ["Lun a vie · 7:30 a. m. – 12:00 p. m.", "Sáb · 8:00 – 11:00 a. m."].
 */
export function summarizeWeek(hours: WeeklyRange[]): string[] {
  const days = byWeekday(hours);
  const key = (day: number) => (days.get(day) ?? []).map((r) => `${r.starts}-${r.ends}`).join(",");
  const lines: string[] = [];
  let i = 0;
  while (i < WEEKDAY_ORDER.length) {
    const day = WEEKDAY_ORDER[i];
    if (!days.get(day)?.length) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < WEEKDAY_ORDER.length && key(WEEKDAY_ORDER[j + 1]) === key(day)) j++;
    const label =
      j === i
        ? WEEKDAY_SHORT[day]
        : `${WEEKDAY_SHORT[day]} a ${WEEKDAY_SHORT[WEEKDAY_ORDER[j]].toLowerCase()}`;
    lines.push(`${label} · ${(days.get(day) ?? []).map(formatRange).join(", ")}`);
    i = j + 1;
  }
  return lines;
}

// Days ------------------------------------------------------------------------------

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const isoOf = (date: Date) => date.toISOString().slice(0, 10);

export const weekdayOf = (iso: string) => utc(iso).getUTCDay();
export const shiftDay = (iso: string, days: number) => {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoOf(date);
};
/** The Monday of a day's week. */
export const mondayOf = (iso: string) => shiftDay(iso, -((weekdayOf(iso) + 6) % 7));

/** "2026-11" of a day. */
export const monthOf = (iso: string) => iso.slice(0, 7);
export const shiftMonth = (month: string, months: number) => {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + months, 1, 12));
  return isoOf(date).slice(0, 7);
};
/** The 6 × 7 days shown for a month, from the Sunday before its first day (Venezuelan calendars start on Sunday). */
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = shiftDay(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
}

const monthFormat = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", month: "long", year: "numeric" });
/** "noviembre de 2026" → "Noviembre 2026". */
export const monthLabel = (month: string) => {
  const text = monthFormat.format(utc(`${month}-01`)).replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * The instant a clinic date and time stand for. The clinic is on
 * America/Caracas, which has been UTC-4 all year since 2016 (no daylight
 * saving), the same zone the database uses.
 */
export const clinicInstant = (day: string, time: string) => new Date(`${day}T${time}:00-04:00`);
