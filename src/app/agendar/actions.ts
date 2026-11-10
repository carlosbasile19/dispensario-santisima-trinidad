"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { isBookingPhone, normalizePhone } from "@/lib/booking/phone";
import type { BookedVisit, BookingRequest, BookingResult } from "@/lib/booking/types";
import { isIsoDate, isTime, isUuid } from "@/lib/crm/clinic";
import { createAdminClient } from "@/lib/supabase/admin";

// Books a visit from a public booking page. Patients have no account: the
// database function book_online (service role only) recognises them by their
// mobile number and answers only a status, never anything about the patient.
// Everything the browser sends is checked here and again in the database.

const GENERIC = "No pudimos agendar la cita. Inténtalo de nuevo en unos segundos.";

const MESSAGES: Record<string, BookingResult> = {
  needs_details: {
    status: "needs_details",
    message: "Es tu primera vez agendando con este número. Completa tus datos para crear tu ficha.",
  },
  needs_name: {
    status: "needs_name",
    message: "Más de un paciente usa este número. Escribe el nombre y el apellido de quien va a la cita.",
  },
  slot_taken: {
    status: "error",
    reason: "slot_taken",
    message: "Alguien acaba de tomar ese horario. Elige otro, por favor.",
  },
  too_many: {
    status: "error",
    message: "Ya tienes 3 citas agendadas en línea. Para agendar otra, escríbenos por WhatsApp.",
  },
  rate_limited: {
    status: "error",
    message: "Hubo demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo, o escríbenos por WhatsApp.",
  },
  closed: {
    status: "error",
    reason: "closed",
    message: "Este calendario no está recibiendo citas en línea en este momento. Escríbenos por WhatsApp para agendar.",
  },
  invalid_phone: {
    status: "error",
    reason: "phone",
    message: "Escribe un número de celular: 04xx-xxxxxxx, o con el código de tu país si es del exterior (+…).",
  },
  invalid_email: { status: "error", reason: "email", message: "Revisa el correo electrónico." },
  invalid: { status: "error", message: "Revisa los datos e inténtalo de nuevo." },
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A string field, trimmed and with single spaces, cut to `max` characters. */
const field = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

/**
 * The client's IP address, keyed-hashed so the rate limits never store the
 * address itself. On Vercel these headers are set by the platform.
 */
async function clientHash(secret: string) {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? createHmac("sha256", secret).update(`booking:${ip}`).digest("hex") : undefined;
}

function parseVisit(data: Record<string, unknown>): BookedVisit | null {
  const { day, time, minutes, service, professional, registered } = data;
  if (!isIsoDate(day) || !isTime(time) || typeof minutes !== "number" || typeof service !== "string") return null;
  return {
    day,
    time,
    minutes,
    service,
    professional: typeof professional === "string" ? professional : "",
    registered: registered === true,
  };
}

export async function bookOnline(request: BookingRequest): Promise<BookingResult> {
  if (!request || typeof request !== "object") return MESSAGES.invalid;
  const { calendarId, serviceId, day, time } = request;
  if (!isUuid(calendarId) || !isUuid(serviceId) || !isIsoDate(day) || !isTime(time)) return MESSAGES.invalid;

  const phone = field(request.phone, 40);
  if (!isBookingPhone(normalizePhone(phone))) return MESSAGES.invalid_phone;
  const firstName = field(request.firstName, 80);
  const lastName = field(request.lastName, 80);
  const email = field(request.email, 120).toLowerCase();
  if (email && !EMAIL.test(email)) return MESSAGES.invalid_email;
  const notes = typeof request.notes === "string" ? request.notes.trim().slice(0, 1000) : "";

  const secret = process.env.SUPABASE_SECRET_KEY;
  const admin = createAdminClient();
  if (!admin || !secret) return { status: "error", reason: "closed", message: "La reserva en línea no está disponible en este momento. Escríbenos por WhatsApp." };

  const { data, error } = await admin.rpc("book_online", {
    calendar: calendarId,
    service: serviceId,
    local_day: day,
    local_time: time,
    phone,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    email: email || undefined,
    notes: notes || undefined,
    client: await clientHash(secret),
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("book_online failed", error?.code, error?.message);
    return { status: "error", message: GENERIC };
  }

  const answer = data as Record<string, unknown>;
  if (answer.status === "booked") {
    const visit = parseVisit(answer);
    return visit ? { status: "booked", visit } : { status: "error", message: GENERIC };
  }
  return (typeof answer.status === "string" && MESSAGES[answer.status]) || { status: "error", message: GENERIC };
}
