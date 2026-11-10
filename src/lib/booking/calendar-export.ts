// "Add to my calendar" for a booked visit: a Google Calendar link and an
// .ics file (Apple Calendar, Outlook and most phones open it).

import { ADDRESS_SHORT, LEGAL_NAME, PHONE_DISPLAY } from "@/lib/site-config";
import { addMinutes, clinicInstant } from "@/lib/crm/schedule";

export type ExportableVisit = { day: string; time: string; minutes: number; service: string; professional: string };

/** 2026-11-12T13:30:00.000Z → 20261112T133000Z */
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const title = (v: ExportableVisit) => `${v.service} · ${v.professional}`;
const details = () => `${LEGAL_NAME}. Para cambiar o cancelar la cita: ${PHONE_DISPLAY} (WhatsApp).`;

function span(v: ExportableVisit) {
  return { start: clinicInstant(v.day, v.time), end: clinicInstant(v.day, addMinutes(v.time, v.minutes)) };
}

export function googleCalendarUrl(v: ExportableVisit) {
  const { start, end } = span(v);
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title(v),
    dates: `${stamp(start)}/${stamp(end)}`,
    details: details(),
    location: ADDRESS_SHORT,
    ctz: "America/Caracas",
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}

/** Text values in an .ics file escape backslashes, commas, semicolons and line breaks (RFC 5545). */
const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

export function icsFile(v: ExportableVisit) {
  const { start, end } = span(v);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santisima Trinidad//Agenda en linea//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@santisima-trinidad`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(title(v))}`,
    `LOCATION:${escape(ADDRESS_SHORT)}`,
    `DESCRIPTION:${escape(details())}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(title(v))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
