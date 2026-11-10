import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, ServiceArea } from "./clinic";
import type { Role } from "./roles";
import { hhmm, minutesOf, type Range, type WeeklyRange } from "./schedule";

// Reads of the booking calendars for the platform. Every query runs as the
// signed-in member, so RLS decides what comes back: everyone sees every
// calendar except doctors, who see their own. The professional's name and
// photo come from calendar_professionals(), since the front desk cannot read
// other members' profiles.

export type CalendarService = {
  serviceId: string;
  name: string;
  area: ServiceArea;
  active: boolean;
  /** Slot length on this calendar: 30 or 60. */
  minutes: number;
};

export type Calendar = {
  id: string;
  slug: string;
  specialty: string | null;
  intro: string | null;
  accepting: boolean;
  minNoticeHours: number;
  horizonDays: number;
  professional: { id: string; name: string; avatarUrl: string | null; role: Role | null };
  services: CalendarService[];
  hours: WeeklyRange[];
};

type Row = {
  id: string;
  slug: string;
  specialty: string | null;
  intro: string | null;
  accepting: boolean;
  min_notice_hours: number;
  horizon_days: number;
  professional_id: string;
  services: {
    service_id: string;
    duration_minutes: number;
    position: number;
    service: { name: string; area: ServiceArea; active: boolean } | null;
  }[];
  hours: { weekday: number; starts: string; ends: string }[];
};

const FIELDS =
  "id, slug, specialty, intro, accepting, min_notice_hours, horizon_days, professional_id, " +
  "services:calendar_services(service_id, duration_minutes, position, service:services(name, area, active)), " +
  "hours:calendar_hours(weekday, starts, ends)";

type Person = { name: string; avatarUrl: string | null; role: Role | null };

async function readProfessionals() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("calendar_professionals");
  return new Map<string, Person>(
    (data ?? []).map((p) => [p.calendar_id, { name: p.full_name, avatarUrl: p.avatar_url || null, role: p.role }]),
  );
}

function toCalendar(row: Row, people: Map<string, Person>): Calendar {
  const person = people.get(row.id);
  return {
    id: row.id,
    slug: row.slug,
    specialty: row.specialty,
    intro: row.intro,
    accepting: row.accepting,
    minNoticeHours: row.min_notice_hours,
    horizonDays: row.horizon_days,
    professional: {
      id: row.professional_id,
      name: person?.name ?? "Profesional",
      avatarUrl: person?.avatarUrl ?? null,
      role: person?.role ?? null,
    },
    services: [...row.services]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        serviceId: s.service_id,
        name: s.service?.name ?? "Servicio",
        area: s.service?.area ?? "medicina",
        active: s.service?.active ?? false,
        minutes: s.duration_minutes,
      })),
    hours: row.hours
      .map((h) => ({ weekday: h.weekday, starts: hhmm(h.starts), ends: hhmm(h.ends) }))
      .sort((a, b) => a.weekday - b.weekday || minutesOf(a.starts) - minutesOf(b.starts)),
  };
}

/** Every calendar the member may see: the medical director first, then by name. */
export const getCalendars = cache(async () => {
  const supabase = await createClient();
  const [{ data }, people] = await Promise.all([
    supabase.from("calendars").select(FIELDS).overrideTypes<Row[], { merge: false }>(),
    readProfessionals(),
  ]);
  return (data ?? [])
    .map((row) => toCalendar(row, people))
    .sort(
      (a, b) =>
        Number(b.professional.role === "director") - Number(a.professional.role === "director") ||
        a.professional.name.localeCompare(b.professional.name, "es"),
    );
});

export const getCalendar = cache(async (id: string) => {
  const supabase = await createClient();
  const [{ data }, people] = await Promise.all([
    supabase.from("calendars").select(FIELDS).eq("id", id).overrideTypes<Row[], { merge: false }>(),
    readProfessionals(),
  ]);
  return data?.length ? toCalendar(data[0], people) : null;
});

export type SpecialDay = { day: string; closed: boolean; ranges: Range[]; note: string | null };

/** Special days from a day on, in date order. */
export async function getSpecialDays(calendarId: string, from: string, to?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("calendar_overrides")
    .select("day, starts, ends, note")
    .eq("calendar_id", calendarId)
    .gte("day", from)
    .order("day")
    .order("starts");
  if (to) query = query.lte("day", to);
  const { data } = await query;
  const days = new Map<string, SpecialDay>();
  for (const row of data ?? []) {
    const entry = days.get(row.day) ?? { day: row.day, closed: false, ranges: [], note: row.note };
    if (row.starts && row.ends) entry.ranges.push({ starts: hhmm(row.starts), ends: hhmm(row.ends) });
    else entry.closed = true;
    entry.note ??= row.note;
    days.set(row.day, entry);
  }
  return [...days.values()];
}

export type WeekVisit = {
  id: string;
  day: string;
  /** Clinic time, "HH:MM". */
  start: string;
  minutes: number;
  status: AppointmentStatus;
  source: "desk" | "online";
  patient: string;
  services: string[];
};

type VisitRow = {
  id: string;
  starts_at: string;
  starts_on: string | null;
  duration_minutes: number;
  status: AppointmentStatus;
  source: string;
  patient: { first_name: string; last_name: string } | null;
  items: { professional_id: string | null; service: { name: string } | null }[];
};

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Caracas",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The visits with a service of `professionalId` between two clinic days. */
export async function getProfessionalVisits(professionalId: string, from: string, to: string): Promise<WeekVisit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, starts_on, duration_minutes, status, source, " +
        "patient:patients(first_name, last_name), items:appointment_items(professional_id, service:services(name))",
    )
    .gte("starts_on", from)
    .lte("starts_on", to)
    .order("starts_at")
    .overrideTypes<VisitRow[], { merge: false }>();
  return (data ?? [])
    .filter((a) => a.starts_on && a.items.some((i) => i.professional_id === professionalId))
    .map((a) => ({
      id: a.id,
      day: a.starts_on as string,
      start: clock.format(new Date(a.starts_at)),
      minutes: a.duration_minutes,
      status: a.status,
      source: a.source === "online" ? "online" : "desk",
      patient: a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.trim() : "Paciente",
      services: a.items.map((i) => i.service?.name ?? "Servicio"),
    }));
}

/** Visits per professional between two days (cancelled and no-shows left out), for the calendar cards. */
export async function getVisitCounts(from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("status, source, items:appointment_items(professional_id)")
    .gte("starts_on", from)
    .lte("starts_on", to)
    .not("status", "in", "(cancelled,no_show)")
    .overrideTypes<{ status: AppointmentStatus; source: string; items: { professional_id: string | null }[] }[], { merge: false }>();
  const counts = new Map<string, { visits: number; online: number }>();
  for (const visit of data ?? []) {
    for (const id of new Set(visit.items.map((i) => i.professional_id).filter((p): p is string => !!p))) {
      const entry = counts.get(id) ?? { visits: 0, online: 0 };
      entry.visits++;
      if (visit.source === "online") entry.online++;
      counts.set(id, entry);
    }
  }
  return counts;
}

/** The open hours of each day of a range (special days applied). */
export async function getWindows(calendarId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("calendar_windows", { calendar: calendarId, from_day: from, to_day: to });
  const days = new Map<string, (Range & { special: boolean })[]>();
  for (const w of data ?? []) {
    days.set(w.day, [...(days.get(w.day) ?? []), { starts: hhmm(w.starts), ends: hhmm(w.ends), special: w.special }]);
  }
  return days;
}
