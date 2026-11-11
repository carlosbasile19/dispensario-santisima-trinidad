import "server-only";
import { io } from "next/cache";
import { cache } from "react";

import { isIsoDate, isServiceArea, isTime, isUuid } from "@/lib/crm/clinic";
import { isSlotLength } from "@/lib/crm/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSlug } from "./slug";
import type { BookingCalendar, BookingService, DirectoryEntry } from "./types";

// Reads for the public booking pages. Patients have no account, so these go
// through the service role (src/lib/supabase/admin.ts) to functions that only
// return public information: the professional's name and photo, the
// calendar's services and its free slots. Never contact details, and nothing
// about patients. Read fresh on every request: slots change as people book.

/**
 * "Unavailable" when booking cannot work right now: the server has no
 * service-role key, or the database did not answer. The pages then offer
 * WhatsApp instead of failing.
 */
export type Unavailable = "unavailable";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function parseSlots(value: unknown) {
  const slots: Record<string, string[]> = {};
  for (const [day, times] of Object.entries(record(value) ?? {})) {
    if (!isIsoDate(day) || !Array.isArray(times)) continue;
    const valid = times.filter(isTime);
    if (valid.length) slots[day] = valid;
  }
  return slots;
}

function parseService(value: unknown): BookingService | null {
  const s = record(value);
  if (!s || !isUuid(s.id) || !isServiceArea(s.area) || !isSlotLength(s.minutes)) return null;
  const name = text(s.name);
  if (!name) return null;
  return { id: s.id, name, area: s.area, minutes: s.minutes, slots: parseSlots(s.slots) };
}

function parseCalendar(value: unknown): BookingCalendar | null {
  const c = record(value);
  if (!c || !isUuid(c.id) || typeof c.slug !== "string" || !isIsoDate(c.today)) return null;
  return {
    id: c.id,
    slug: c.slug,
    name: text(c.name) ?? "Médico del centro",
    avatarUrl: text(c.avatar_url),
    specialty: text(c.specialty),
    intro: text(c.intro),
    accepting: c.accepting === true,
    today: c.today,
    horizonDays: typeof c.horizon_days === "number" ? c.horizon_days : 30,
    services: (Array.isArray(c.services) ? c.services : []).map(parseService).filter((s) => s !== null),
  };
}

/** A calendar's booking page by its link, or null when there is no such calendar. */
export const getBookingCalendar = cache(async (slug: string): Promise<BookingCalendar | null | Unavailable> => {
  if (!isSlug(slug)) return null;
  // The Supabase client reads the clock as it builds each request: keep it
  // out of the static shell (see src/lib/supabase/server.ts).
  await io();
  const admin = createAdminClient();
  if (!admin) return "unavailable";
  const { data, error } = await admin.rpc("booking_calendar", { calendar_slug: slug });
  if (error) {
    console.error("booking_calendar failed", error.code, error.message);
    return "unavailable";
  }
  return parseCalendar(data);
});

/** The calendars taking bookings, for /agendar. */
export const getBookingDirectory = cache(async (): Promise<DirectoryEntry[] | Unavailable> => {
  await io();
  const admin = createAdminClient();
  if (!admin) return "unavailable";
  const { data, error } = await admin.rpc("booking_directory");
  if (error) {
    console.error("booking_directory failed", error.code, error.message);
    return "unavailable";
  }
  return (Array.isArray(data) ? data : []).flatMap((value) => {
    const e = record(value);
    if (!e || !isSlug(e.slug)) return [];
    return [
      {
        slug: e.slug,
        name: text(e.name) ?? "Médico del centro",
        avatarUrl: text(e.avatar_url),
        specialty: text(e.specialty),
        services: Array.isArray(e.services) ? e.services.filter((s): s is string => typeof s === "string") : [],
      },
    ];
  });
});
