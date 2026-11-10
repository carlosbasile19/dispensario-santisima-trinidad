// The WhatsApp templates the clinic sends, as they are submitted to Meta for
// review (Zernio's POST /v1/whatsapp/templates takes Meta's component shapes,
// with lowercase types), and the values each message fills in.
//
// All are UTILITY templates: about a visit the patient booked or the results
// they are waiting for, with no promotion, which is what Meta's utility
// category allows. They never carry the patient's cédula (Meta's policy
// forbids sending ID numbers) nor the service or a result, which could say
// more than the patient wants: lab results travel only inside the PDF.
//
// Changing a template's text means a new name (Meta reviews each one): add
// it here, submit it from the WhatsApp page, and keep the old one until the
// new one is approved.

import { AREA_LABEL, formatDay, formatTime, localDay, type ServiceArea } from "@/lib/crm/clinic";
import { ADDRESS_SHORT, LEGAL_NAME } from "@/lib/site-config";

export const TEMPLATE_LANGUAGE = "es";

/** Messages about a visit (rows of whatsapp_messages). */
export type MessageKind = "confirmation" | "reminder";
/** Every template the clinic submits: the visit messages and the lab results. */
export type TemplateKind = MessageKind | "lab_results";

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
  /** A PDF travels as the message's header (the lab results). */
  document?: boolean;
  /** The confirmation buttons (visit messages). */
  buttons: boolean;
};

export const TEMPLATES: Record<TemplateKind, TemplateDefinition> = {
  confirmation: {
    name: "cita_agendada",
    label: "Confirmación de cita",
    description: "Sale al agendar la cita, en línea o en recepción.",
    buttons: true,
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
    buttons: true,
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
  lab_results: {
    name: "resultados_laboratorio",
    label: "Resultados de laboratorio",
    description: "Lleva el PDF del informe validado, cuando se envía desde Laboratorio.",
    document: true,
    buttons: false,
    body: lines(
      "Hola, {{1}}. Tus resultados de laboratorio de la muestra del {{2}} están listos: te los enviamos en el PDF adjunto.",
      "",
      `Los validó {{3}}, bioanalista del ${LEGAL_NAME}.`,
      "",
      "Llévalos a tu médico para que los interprete en tu próxima consulta.",
    ),
  },
};

export const TEMPLATE_KINDS = Object.keys(TEMPLATES) as TemplateKind[];

/** Undelivered after 12 hours (the phone was off), a message is dropped instead of arriving late. */
export const TEMPLATE_TTL_SECONDS = 12 * 60 * 60;

/**
 * The components Meta reviews for a template. Zernio validates them before
 * passing them on, and its schema wants the types in lowercase ("body",
 * "quick_reply"), unlike Meta's own API and Zernio's template listing.
 */
export function templateComponents(kind: TemplateKind, { samplePdfUrl }: { samplePdfUrl?: string } = {}) {
  if (kind === "lab_results") {
    return [
      // Zernio downloads the sample (a report of a fictitious patient) and uploads it to Meta for the review.
      { type: "header", format: "document", example: { header_handle: [samplePdfUrl ?? ""] } },
      { type: "body", text: TEMPLATES[kind].body, example: { body_text: [LAB_EXAMPLE] } },
      { type: "footer", text: "Responde a este chat si tienes alguna pregunta." },
    ];
  }
  return [
    { type: "body", text: TEMPLATES[kind].body, example: { body_text: [EXAMPLE] } },
    { type: "footer", text: "Responde a este chat si tienes alguna pregunta." },
    { type: "buttons", buttons: REPLY_BUTTONS.map((button) => ({ type: "quick_reply", text: button.text })) },
  ];
}

const LAB_EXAMPLE = ["Ana", "martes, 18 de noviembre", "el Lcdo. Heriberto M. Arteaga R."];

/** {{1}} first name, {{2}} day of the sample, {{3}} the bioanalyst who validated the report. */
export function labResultsParams({ firstName, sampledDay, signer }: { firstName: string; sampledDay: string; signer: string }) {
  const name = signer.trim();
  const article = /^(Lcda|Dra)\b/i.test(name) ? "la" : "el";
  return [
    clean(firstName.split(" ")[0] || firstName, 40) || "paciente",
    clean(formatDay(sampledDay, "long")),
    clean(`${article} ${name}`, 80),
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
