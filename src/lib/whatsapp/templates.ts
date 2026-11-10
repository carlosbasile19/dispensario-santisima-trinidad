// The WhatsApp templates the clinic sends, as they are submitted to Meta for
// review (Zernio's POST /v1/whatsapp/templates takes Meta's component shapes),
// and the values each message fills in.
//
// Both are UTILITY templates: about a visit the patient booked, with no
// promotion, which is what Meta's utility category allows. They never carry
// the patient's cédula (Meta's policy forbids sending ID numbers) nor the
// service, which on a lab visit could say more than the patient wants.
//
// Changing a template's text means a new name (Meta reviews each one): add
// it here, submit it from the WhatsApp page, and keep the old one until the
// new one is approved.

import { AREA_LABEL, formatDay, formatTime, localDay, type ServiceArea } from "@/lib/crm/clinic";
import { ADDRESS_SHORT, LEGAL_NAME } from "@/lib/site-config";

export const TEMPLATE_LANGUAGE = "es";

export type MessageKind = "confirmation" | "reminder";

/** The three buttons of both templates, in order. Meta allows 25 characters each. */
export const REPLY_BUTTONS = [
  { answer: "confirm", text: "Confirmar asistencia" },
  { answer: "reschedule", text: "Reprogramar" },
  { answer: "cancel", text: "Cancelar cita" },
] as const;

export type ReplyAnswer = (typeof REPLY_BUTTONS)[number]["answer"];

const EXAMPLE = ["Ana", "martes, 18 de noviembre", "8:30 a. m.", "José Carlos Morales · Medicina"];

const lines = (...parts: string[]) => parts.join("\n");

type TemplateDefinition = {
  name: string;
  label: string;
  /** What it is for, on the WhatsApp page. */
  description: string;
  body: string;
};

export const TEMPLATES: Record<MessageKind, TemplateDefinition> = {
  confirmation: {
    name: "cita_agendada",
    label: "Confirmación de cita",
    description: "Sale al agendar la cita, en línea o en recepción.",
    body: lines(
      `Hola, {{1}}. Tu cita en el ${LEGAL_NAME} quedó agendada:`,
      "",
      "🗓️ {{2}}",
      "🕐 {{3}}",
      "🩺 {{4}}",
      "",
      `📍 ${ADDRESS_SHORT}.`,
      "",
      "¿Nos confirmas que asistirás? Si necesitas otro día u hora, toca Reprogramar.",
    ),
  },
  reminder: {
    name: "recordatorio_cita",
    label: "Recordatorio",
    description: "Sale la tarde anterior a la cita.",
    body: lines(
      `Hola, {{1}}. Te recordamos tu próxima cita en el ${LEGAL_NAME}:`,
      "",
      "🗓️ {{2}}",
      "🕐 {{3}}",
      "🩺 {{4}}",
      "",
      `📍 ${ADDRESS_SHORT}.`,
      "",
      "¿Nos confirmas que asistirás?",
    ),
  },
};

export const TEMPLATE_KINDS = Object.keys(TEMPLATES) as MessageKind[];

/** Undelivered after 12 hours (the phone was off), a message is dropped instead of arriving late. */
export const TEMPLATE_TTL_SECONDS = 12 * 60 * 60;

/** The components Meta reviews for a template. */
export function templateComponents(kind: MessageKind) {
  return [
    { type: "BODY", text: TEMPLATES[kind].body, example: { body_text: [EXAMPLE] } },
    { type: "FOOTER", text: "Responde a este chat si tienes alguna pregunta." },
    { type: "BUTTONS", buttons: REPLY_BUTTONS.map((button) => ({ type: "QUICK_REPLY", text: button.text })) },
  ];
}

/** What a message needs to know about the visit. */
export type VisitFacts = {
  firstName: string;
  startsAt: string;
  professional: string | null;
  area: ServiceArea | null;
};

/** Meta refuses parameters with line breaks, tabs or long runs of spaces. */
const clean = (value: string, max = 60) => value.replace(/\s+/g, " ").trim().slice(0, max);

/** {{1}} first name, {{2}} day, {{3}} time, {{4}} who sees the patient (or the area). */
export function templateParams(visit: VisitFacts) {
  const firstName = clean(visit.firstName.split(" ")[0] || visit.firstName, 40) || "paciente";
  const who = [visit.professional, visit.area ? AREA_LABEL[visit.area] : null].filter(Boolean).join(" · ");
  return [
    firstName,
    clean(formatDay(localDay(visit.startsAt), "long")),
    clean(formatTime(visit.startsAt)),
    clean(who || "Centro Médico Integral Santísima Trinidad", 80),
  ];
}

const strip = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ANSWERS: Record<string, ReplyAnswer> = {
  ...Object.fromEntries(REPLY_BUTTONS.map((button) => [strip(button.text), button.answer])),
  confirmar: "confirm",
  cancelar: "cancel",
};

/** The answer a button tap (or the button's exact words typed back) stands for. */
export const answerFor = (text: string | null | undefined): ReplyAnswer | null => (text ? (ANSWERS[strip(text)] ?? null) : null);
