// Reportes (Contabilidad): the periods a report covers, how each is split
// for the charts, and the shape of public.accounting_report's answer.
// Pure date arithmetic on "YYYY-MM-DD" strings, safe on server and client.

import type { PaymentMethod, ServiceArea } from "./clinic";

export const PERIOD_KINDS = ["semana", "mes", "trimestre", "ano"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];
export type Bucket = "day" | "week" | "month";

export const isPeriodKind = (value: unknown): value is PeriodKind =>
  typeof value === "string" && (PERIOD_KINDS as readonly string[]).includes(value);

export const PERIOD_LABEL: Record<PeriodKind, string> = { semana: "Semana", mes: "Mes", trimestre: "Trimestre", ano: "Año" };

/** How each period is split on the charts: the days of a week or a month, the weeks of a quarter, the months of a year. */
const BUCKET: Record<PeriodKind, Bucket> = { semana: "day", mes: "day", trimestre: "week", ano: "month" };

export type Period = {
  kind: PeriodKind;
  bucket: Bucket;
  from: string;
  to: string;
  /** "9 al 15 de noviembre de 2026", "noviembre de 2026", "4.º trimestre de 2026", "2026". */
  label: string;
  /** What the deltas compare against: "la semana anterior", "octubre", "el 3.er trimestre", "2025". */
  versus: string;
};

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const ymd = (y: number, m: number, d: number) => iso(new Date(Date.UTC(y, m - 1, d, 12)));

export const shiftDays = (day: string, days: number) => {
  const date = at(day);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};

/** The first day of the month `months` away from `day`'s month. */
const shiftMonths = (day: string, months: number) => {
  const [y, m] = day.split("-").map(Number);
  return ymd(y, m + months, 1);
};

const lastOfMonth = (y: number, m: number) => ymd(y, m + 1, 0);

/** Monday of the day's week. */
export const mondayOf = (day: string) => shiftDays(day, -((at(day).getUTCDay() + 6) % 7));

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", ...options });
const F = {
  day: fmt({ day: "numeric" }),
  dayMonth: fmt({ day: "numeric", month: "long" }),
  dayShortMonth: fmt({ day: "numeric", month: "short" }),
  weekdayDay: fmt({ weekday: "short", day: "numeric" }),
  month: fmt({ month: "long" }),
  monthShort: fmt({ month: "short" }),
  monthYear: fmt({ month: "long", year: "numeric" }),
};

const ordinal = (q: number) => (q === 1 ? "1.er" : q === 2 ? "2.º" : q === 3 ? "3.er" : "4.º");

function weekLabel(monday: string) {
  const sunday = shiftDays(monday, 6);
  const start = monday.slice(0, 7) === sunday.slice(0, 7) ? F.day.format(at(monday)) : F.dayMonth.format(at(monday));
  return `${start} al ${F.dayMonth.format(at(sunday))} de ${sunday.slice(0, 4)}`;
}

/** A compact span for a delta: "1–12 oct", "1 jul–12 ago", with the year when asked ("1 ene–12 nov 2025"). */
export function shortRange(from: string, to: string, withYear = false) {
  const clean = (text: string) => text.replace(".", "");
  const end = clean(F.dayShortMonth.format(at(to))) + (withYear ? ` ${to.slice(0, 4)}` : "");
  if (from === to) return end;
  const start = from.slice(0, 7) === to.slice(0, 7) ? F.day.format(at(from)) : clean(F.dayShortMonth.format(at(from)));
  return `${start}–${end}`;
}

/** The period of the given kind that contains `day`. */
export function periodOf(kind: PeriodKind, day: string): Period {
  const [y, m] = day.split("-").map(Number);
  const bucket = BUCKET[kind];
  switch (kind) {
    case "semana": {
      const from = mondayOf(day);
      return { kind, bucket, from, to: shiftDays(from, 6), label: weekLabel(from), versus: "la semana anterior" };
    }
    case "mes": {
      const prev = shiftMonths(day, -1);
      return {
        kind,
        bucket,
        from: ymd(y, m, 1),
        to: lastOfMonth(y, m),
        label: F.monthYear.format(at(ymd(y, m, 1))),
        versus: prev.slice(0, 4) === String(y) ? F.month.format(at(prev)) : F.monthYear.format(at(prev)),
      };
    }
    case "trimestre": {
      const q = Math.floor((m - 1) / 3) + 1;
      const first = (q - 1) * 3 + 1;
      return {
        kind,
        bucket,
        from: ymd(y, first, 1),
        to: lastOfMonth(y, first + 2),
        label: `${ordinal(q)} trimestre de ${y}`,
        versus: q === 1 ? `el 4.º trimestre de ${y - 1}` : `el ${ordinal(q - 1)} trimestre`,
      };
    }
    case "ano":
      return { kind, bucket, from: ymd(y, 1, 1), to: ymd(y, 12, 31), label: String(y), versus: String(y - 1) };
  }
}

/** The period just before (step -1) or after (step 1) this one. */
export function stepPeriod(period: Period, step: -1 | 1): Period {
  const day = (() => {
    switch (period.kind) {
      case "semana":
        return shiftDays(period.from, 7 * step);
      case "mes":
        return shiftMonths(period.from, step);
      case "trimestre":
        return shiftMonths(period.from, 3 * step);
      case "ano":
        return ymd(Number(period.from.slice(0, 4)) + step, 1, 1);
    }
  })();
  return periodOf(period.kind, day);
}

/** The first day of each chart slot, as accounting_report returns them. */
export function slotsOf(period: Period): string[] {
  const slots: string[] = [];
  const first = period.bucket === "week" ? mondayOf(period.from) : period.from;
  for (let slot = first; slot <= period.to; ) {
    slots.push(slot);
    slot = period.bucket === "day" ? shiftDays(slot, 1) : period.bucket === "week" ? shiftDays(slot, 7) : shiftMonths(slot, 1);
  }
  return slots;
}

/** A slot's tick on the x axis: "lun 9" (week), "9" (month), "9 nov" (quarter), "nov" (year). */
export function slotTick(slot: string, kind: PeriodKind) {
  switch (kind) {
    case "semana":
      return F.weekdayDay.format(at(slot)).replace(".", "");
    case "mes":
      return F.day.format(at(slot));
    case "trimestre":
      return F.dayShortMonth.format(at(slot)).replace(".", "");
    case "ano":
      return F.monthShort.format(at(slot)).replace(".", "");
  }
}

/** A slot in full, for tooltips and tables: "lunes 9 nov", "semana del 9 nov", "noviembre". */
export function slotName(slot: string, kind: PeriodKind) {
  switch (kind) {
    case "semana":
    case "mes":
      return fmt({ weekday: "long", day: "numeric", month: "short" }).format(at(slot)).replace(".", "");
    case "trimestre":
      return `Semana del ${F.dayShortMonth.format(at(slot)).replace(".", "")}`;
    case "ano":
      return F.month.format(at(slot));
  }
}

// What accounting_report answers -------------------------------------------

export type ReportSlot = {
  slot: string;
  patients: number;
  new_patients: number;
  visits: number;
  billed_usd: number;
  collected_usd: number;
  expenses_usd: number;
};

export type Report = {
  series: ReportSlot[];
  totals: {
    patients: number;
    new_patients: number;
    visits: number;
    attended: number;
    unmarked: number;
    upcoming: number;
    cancelled: number;
    no_show: number;
    online: number;
    billed_usd: number;
    collected_usd: number;
    collected_bs: number;
    received_usd: number;
    received_bs: number;
    financed_usd: number;
    expenses_usd: number;
    expenses_bs: number;
    owed_usd: number;
  };
  areas: { area: ServiceArea; visits: number; patients: number; billed_usd: number }[];
  methods: { method: PaymentMethod; payments: number; amount_usd: number; amount_bs: number }[];
  services: { service: string; area: ServiceArea; count: number; billed_usd: number }[];
  professionals: { name: string; visits: number; patients: number; billed_usd: number }[];
  suppliers: { name: string; expenses: number; amount_usd: number }[];
  /** Distinct patients: women, men, not recorded. */
  sex: [number, number, number];
  /** Distinct patients by AGE_BANDS, then those without a birth date. */
  ages: number[];
  /** Visits Monday to Sunday. */
  weekdays: number[];
};

export const AGE_BANDS = ["0–11", "12–17", "18–29", "30–44", "45–59", "60 y más"] as const;
export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** Relative change, or null when there is nothing to compare against. */
export const change = (current: number, previous: number) => (previous > 0 ? (current - previous) / previous : null);

const percent = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 0 });
const percentPrecise = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 1 });
/** 0.123 → "12 %"; under 10 % keeps a decimal ("4,5 %"). */
export const formatPercent = (ratio: number) => (Math.abs(ratio) < 0.1 && ratio !== 0 ? percentPrecise : percent).format(ratio);

const whole = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });
export const formatCount = (n: number) => whole.format(n);
