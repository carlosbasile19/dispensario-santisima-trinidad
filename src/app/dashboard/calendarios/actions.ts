"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { isSlug } from "@/lib/booking/slug";
import { isIsoDate, isTime, isUuid } from "@/lib/crm/clinic";
import { getProfessionals } from "@/lib/crm/data";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { isSlotLength, minutesOf, rangesProblem, type Range } from "@/lib/crm/schedule";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

// Calendarios (administrators). Every action checks the member's profile
// first; RLS and the database functions check again.

const NO_ACCESS = "Solo los administradores pueden modificar los calendarios.";
const MIN_NOTICE = [0, 1, 2, 4, 12, 24, 48];
const HORIZONS = [7, 14, 30, 60, 90];

const json = (value: FormDataEntryValue | null): unknown => {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return null;
  }
};

const isHalfHour = (time: unknown): time is string => isTime(time) && minutesOf(time) % 30 === 0;

/** [{starts, ends}] on half hours that do not overlap, or null. */
function parseRanges(value: unknown, max: number): Range[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const ranges: Range[] = [];
  for (const entry of value) {
    const { starts, ends } = (entry ?? {}) as Record<string, unknown>;
    if (!isHalfHour(starts) || !isHalfHour(ends)) return null;
    ranges.push({ starts, ends });
  }
  return rangesProblem(ranges) ? null : ranges;
}

/** [{service_id, minutes}] with known slot lengths and no repeats, or null. */
function parseOffered(value: unknown) {
  if (!Array.isArray(value) || value.length > 60) return null;
  const offered: { service_id: string; minutes: number }[] = [];
  for (const entry of value) {
    const { service_id, minutes } = (entry ?? {}) as Record<string, unknown>;
    if (!isUuid(service_id) || !isSlotLength(minutes) || offered.some((o) => o.service_id === service_id)) return null;
    offered.push({ service_id, minutes });
  }
  return offered;
}

function calendarError(error: { code?: string; message?: string; hint?: string | null } | null, fallback?: string) {
  if (error?.code === "23505") {
    return error.message?.includes("professional_id")
      ? "Ese profesional ya tiene un calendario."
      : "Ese enlace ya lo usa otro calendario. Elige otro.";
  }
  return dbErrorMessage(error, fallback);
}

/** Creates a professional's calendar with its services, then opens its hours. */
export async function createCalendar(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const professional = formData.get("professional");
  if (!isUuid(professional)) return { error: "Elige el profesional." };
  const offered = parseOffered(json(formData.get("services")));
  if (!offered) return { error: "Revisa los servicios." };
  const specialty = String(formData.get("specialty") ?? "").trim().slice(0, 80);

  // The link is made from the professional's name. clinic_professionals()
  // shows the email when a member has no name yet: never put that in a URL.
  const { byId } = await getProfessionals();
  const name = byId.get(professional)?.name ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_calendar", {
    professional,
    link_name: name.includes("@") ? "medico" : name,
    specialty_label: specialty,
    offered,
  });
  if (error || !data) return { error: calendarError(error, "No se pudo crear el calendario.") };
  redirect(`/dashboard/calendarios/${data}/horario?nuevo=1`);
}

/** Replaces the weekly hours. */
export async function saveCalendarHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  const raw = json(formData.get("hours"));
  if (!isUuid(calendar) || !Array.isArray(raw) || raw.length > 70) return { error: "Revisa el horario." };
  const hours: { weekday: number; starts: string; ends: string }[] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    const ranges = parseRanges(
      raw.filter((r) => (r as { weekday?: unknown })?.weekday === weekday),
      10,
    );
    if (!ranges) return { error: "Revisa los horarios: cada uno en medias horas y sin solaparse en el mismo día." };
    hours.push(...ranges.map((r) => ({ weekday, ...r })));
  }
  if (hours.length !== raw.length) return { error: "Revisa el horario." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_calendar_hours", { calendar, hours });
  if (error) return { error: calendarError(error, "No se pudo guardar el horario.") };
  refresh();
  return { message: "Horario guardado. Los pacientes ya ven los nuevos cupos." };
}

/** Replaces the services patients can book, each with its slot length. */
export async function saveCalendarServices(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  const offered = parseOffered(json(formData.get("services")));
  if (!isUuid(calendar) || !offered) return { error: "Revisa los servicios." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_calendar_services", { calendar, offered });
  if (error) return { error: calendarError(error, "No se pudieron guardar los servicios.") };
  refresh();
  return { message: offered.length ? "Servicios guardados." : "Servicios guardados. Sin servicios, el enlace no recibe citas." };
}

/** The booking settings: open or paused, what patients read, notice, horizon and the link. */
export async function saveCalendarSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const minNotice = Number(formData.get("min_notice_hours"));
  const horizon = Number(formData.get("horizon_days"));
  if (!isUuid(calendar)) return { error: "Calendario no válido." };
  if (!isSlug(slug)) {
    return { error: "El enlace lleva de 3 a 60 letras minúsculas, números y guiones, sin espacios ni acentos." };
  }
  if (!MIN_NOTICE.includes(minNotice) || !HORIZONS.includes(horizon)) return { error: "Revisa la anticipación y el plazo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendars")
    .update({
      accepting: formData.get("accepting") === "on",
      specialty: String(formData.get("specialty") ?? "").trim().slice(0, 80) || null,
      intro: String(formData.get("intro") ?? "").trim().slice(0, 400) || null,
      min_notice_hours: minNotice,
      horizon_days: horizon,
      slug,
    })
    .eq("id", calendar);
  if (error) return { error: calendarError(error) };
  refresh();
  return { message: "Ajustes guardados." };
}

/** Sets a special day: a day off, or other hours on that date. */
export async function saveSpecialDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  const day = formData.get("day");
  const closed = formData.get("mode") !== "hours";
  const ranges = closed ? [] : parseRanges(json(formData.get("ranges")), 10);
  if (!isUuid(calendar)) return { error: "Calendario no válido." };
  if (!isIsoDate(day)) return { error: "Elige la fecha." };
  if (!ranges || (!closed && ranges.length === 0)) {
    return { error: "Revisa el horario de ese día: en medias horas y sin solaparse." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_calendar_special_day", {
    calendar,
    special_day: day,
    ranges,
    reason: String(formData.get("note") ?? "").trim().slice(0, 120),
  });
  if (error) return { error: calendarError(error, "No se pudo guardar el día especial.") };
  refresh();
  return { message: "Día especial guardado." };
}

export async function deleteSpecialDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  const day = formData.get("day");
  if (!isUuid(calendar) || !isIsoDate(day)) return { error: "Día no válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_calendar_special_day", { calendar, special_day: day });
  if (error) return { error: calendarError(error) };
  refresh();
  return { message: "Día especial quitado." };
}

/** Deletes a calendar: its link stops working. Visits already booked stay in the agenda. */
export async function deleteCalendar(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.manageCalendars) return { error: NO_ACCESS };

  const calendar = formData.get("calendar");
  if (!isUuid(calendar)) return { error: "Calendario no válido." };

  const supabase = await createClient();
  const { error } = await supabase.from("calendars").delete().eq("id", calendar);
  if (error) return { error: calendarError(error, "No se pudo eliminar el calendario.") };
  redirect("/dashboard/calendarios");
}
