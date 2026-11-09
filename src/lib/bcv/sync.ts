import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays, clinicToday } from "@/lib/crm/clinic";
import { formatRate, toRate } from "@/lib/crm/money";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { readBcv, readDolarApiHistory, type OfficialRate } from "./sources";

// Keeps exchange_rates up to date with the BCV, without anyone typing it.
//
// The BCV publishes each afternoon the rate of its next business day (the
// "fecha valor"): Monday's on Friday, and after a holiday the day after it.
// Weekends and holidays have no rate of their own; they use the rate of the
// last fecha valor before them. So the rate of any day D is the one with the
// latest fecha valor on or before D.
//
// Each run reads the BCV (or the DolarAPI mirror when the BCV fails) and
// records, through record_official_rate():
//   · the newest fecha valor it finds (often tomorrow's), for that day;
//   · today, and tomorrow when tomorrow is a Saturday or Sunday, with the
//     rate that applies to them.
// The database never replaces a rate a member typed and never lets the
// mirror overwrite the BCV's own figure. Runs are idempotent.

export type SyncReport = {
  ok: boolean;
  today: string;
  /** The newest fecha valor found and where it came from. */
  published: { day: string; rate: string; source: OfficialRate["source"] } | null;
  recorded: { day: string; rate: string; source: OfficialRate["source"]; fechaValor: string; result: string }[];
  errors: string[];
};

/** Days a fecha valor can be carried over (long holidays, Christmas). */
const MAX_CARRY_DAYS = 10;
/** A day-to-day change above this is held back as a likely misread. */
const MAX_DAILY_CHANGE = 0.35;

const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
const asNumber = (rate: bigint) => Number(rate) / 1e8;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** What a run reads from and writes to. The defaults are the real ones; tests pass their own. */
type SyncDeps = {
  client?: SupabaseClient<Database> | null;
  today?: string;
  bcv?: () => Promise<OfficialRate>;
  history?: () => Promise<OfficialRate[]>;
};

export async function syncBcvRates(deps: SyncDeps = {}): Promise<SyncReport> {
  const today = deps.today ?? (await clinicToday());
  const report: SyncReport = { ok: false, today, published: null, recorded: [], errors: [] };
  const admin = deps.client === undefined ? createAdminClient() : deps.client;
  if (!admin) {
    report.errors.push("SUPABASE_SECRET_KEY is not set on the server.");
    return report;
  }

  // Fecha valor → official rate, from what is stored and what is read now.
  const known = new Map<string, OfficialRate>();
  const { data: stored, error: readError } = await admin
    .from("exchange_rates")
    .select("rate_date, bs_per_usd, source, fecha_valor")
    .gte("rate_date", addDays(today, -MAX_CARRY_DAYS - 5));
  if (readError) {
    report.errors.push(`Could not read stored rates: ${readError.message}`);
    return report;
  }
  for (const row of stored ?? []) {
    if (row.source !== "manual" && row.fecha_valor === row.rate_date) {
      known.set(row.rate_date, { day: row.rate_date, rate: toRate(row.bs_per_usd), source: row.source as OfficialRate["source"] });
    }
  }

  let published: OfficialRate | null = null;
  try {
    published = await (deps.bcv ?? readBcv)();
    known.set(published.day, published);
  } catch (error) {
    report.errors.push(`BCV: ${message(error)}`);
  }

  const targets = [today];
  const tomorrow = addDays(today, 1);
  if (isWeekend(tomorrow)) targets.push(tomorrow);

  const rateFor = (day: string) => {
    let best: OfficialRate | null = null;
    for (const official of known.values()) {
      if (official.day <= day && official.day >= addDays(day, -MAX_CARRY_DAYS) && (!best || official.day > best.day)) best = official;
    }
    return best;
  };

  // The mirror fills in when the BCV failed, or when a day needs an older
  // fecha valor that was never stored (the job did not run that day).
  if (!published || targets.some((day) => !rateFor(day))) {
    try {
      const history = await (deps.history ?? readDolarApiHistory)();
      for (const official of history) {
        if (official.day >= addDays(today, -MAX_CARRY_DAYS - 5) && !known.has(official.day)) known.set(official.day, official);
      }
      if (!published) published = history.at(-1) ?? null;
    } catch (error) {
      report.errors.push(`DolarAPI: ${message(error)}`);
    }
  }

  if (!published) return report;
  report.published = { day: published.day, rate: formatRate(published.rate), source: published.source };

  // Guard against a misread page: compare with the fecha valor before it.
  const previous = rateFor(addDays(published.day, -1));
  if (previous) {
    const change = Math.abs(asNumber(published.rate) / asNumber(previous.rate) - 1);
    if (change > MAX_DAILY_CHANGE) {
      report.errors.push(
        `The rate read (${formatRate(published.rate)}) differs ${Math.round(change * 100)}% from the one before (${formatRate(previous.rate)}); not recorded, check it by hand.`,
      );
      return report;
    }
  }

  const plan = new Map<string, OfficialRate>([[published.day, published]]);
  for (const day of targets) {
    const official = rateFor(day);
    if (official) plan.set(day, official);
    else report.errors.push(`No official rate found for ${day}.`);
  }

  for (const [day, official] of [...plan].sort(([a], [b]) => a.localeCompare(b))) {
    const { data, error } = await admin.rpc("record_official_rate", {
      rate_day: day,
      bs_per_usd: asNumber(official.rate),
      rate_source: official.source,
      valid_since: official.day,
    });
    if (error) report.errors.push(`Could not record ${day}: ${error.message}`);
    else report.recorded.push({ day, rate: formatRate(official.rate), source: official.source, fechaValor: official.day, result: data });
  }

  report.ok = report.recorded.some((r) => r.day === today);
  return report;
}

let lastOnDemand = 0;

/**
 * Runs the sync when a page needs today's rate and it is missing, at most
 * once every few minutes per server, and gives up after a few seconds so a
 * slow BCV never holds the page. Answers whether today's rate was recorded.
 */
export async function syncTodayOnDemand() {
  if (!process.env.SUPABASE_SECRET_KEY || Date.now() - lastOnDemand < 3 * 60_000) return false;
  lastOnDemand = Date.now();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 9_000));
  const report = await Promise.race([syncBcvRates().catch(() => null), timeout]);
  return Boolean(report?.ok);
}
