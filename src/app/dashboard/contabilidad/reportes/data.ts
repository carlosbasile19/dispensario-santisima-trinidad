import "server-only";
import { cache } from "react";

import { clinicToday, isIsoDate, param } from "@/lib/crm/clinic";
import { isPeriodKind, periodOf, type Bucket, type PeriodKind, type Report } from "@/lib/crm/reports";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<Record<string, string | string[] | undefined>>;

/** Link to the report of the given kind around `day`. */
export const reportHref = (kind: PeriodKind, day: string) => `/dashboard/contabilidad/reportes?periodo=${kind}&fecha=${day}`;

/**
 * The period on screen: ?periodo= (semana, mes, trimestre, año; a month by
 * default) around ?fecha=, or around today. A period that has not started
 * yet falls back to the current one.
 */
export async function readPeriod(searchParams: Params) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const requestedKind = param(params.periodo);
  const requestedDay = param(params.fecha);
  const kind: PeriodKind = isPeriodKind(requestedKind) ? requestedKind : "mes";
  let period = periodOf(kind, isIsoDate(requestedDay) ? requestedDay : today);
  if (period.from > today) period = periodOf(kind, today);
  return { period, today, isCurrent: period.from <= today && today <= period.to };
}

/** accounting_report for a period, read once per request whichever cards ask for it. Null if the call failed. */
export const getReport = cache(async (from: string, to: string, bucket: Bucket): Promise<Report | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accounting_report", { from_day: from, to_day: to, bucket });
  if (error || !data) {
    console.error("accounting_report failed", { from, to, bucket, code: error?.code, message: error?.message });
    return null;
  }
  return toNumbers(data) as Report;
});

/** Postgres numerics arrive as JSON numbers already; this guards the odd string ("12.50") all the same. */
function toNumbers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toNumbers);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, typeof v === "string" && /_(usd|bs)$/.test(key) ? Number(v) : toNumbers(v)]),
    );
  }
  return value;
}
