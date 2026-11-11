// How WhatsApp messages read on the platform's screens.

type Tone = "neutral" | "navy" | "teal" | "solid" | "coral" | "outline";

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  confirmation: "Confirmación",
  reminder: "Recordatorio",
};

export const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "En cola", tone: "outline" },
  sending: { label: "Enviando", tone: "outline" },
  sent: { label: "Enviado", tone: "neutral" },
  delivered: { label: "Entregado", tone: "navy" },
  read: { label: "Leído", tone: "teal" },
  failed: { label: "No se entregó", tone: "coral" },
  skipped: { label: "No enviado", tone: "outline" },
};

/** The patient's button answer, as the front desk reads it. */
export const REPLY_LABEL: Record<string, string> = {
  confirm: "Confirmó asistencia",
  reschedule: "Pidió reprogramar",
  cancel: "Canceló la cita",
};

/** What the answer did when it is not the obvious. */
export const REPLY_EFFECT_NOTE: Record<string, string> = {
  outdated: "La cita ya había cambiado de hora: no se modificó.",
  unchanged: "La cita no estaba pendiente: no se modificó.",
  reschedule: "Escríbele por WhatsApp para buscar otra hora.",
};

/** Meta's review status of a template. */
export const TEMPLATE_STATUS: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Aprobada", tone: "teal" },
  PENDING: { label: "En revisión", tone: "navy" },
  IN_APPEAL: { label: "En apelación", tone: "navy" },
  REJECTED: { label: "Rechazada", tone: "coral" },
  PAUSED: { label: "Pausada por Meta", tone: "coral" },
  DISABLED: { label: "Desactivada por Meta", tone: "coral" },
  PENDING_DELETION: { label: "Eliminándose", tone: "outline" },
};

export const templateStatus = (status: string | null | undefined) =>
  (status && TEMPLATE_STATUS[status]) || { label: status ? status.toLowerCase() : "Sin enviar", tone: "outline" as Tone };

/** Meta's quality rating of the number. */
export const QUALITY_LABEL: Record<string, string> = {
  GREEN: "Alta",
  YELLOW: "Media",
  RED: "Baja",
  UNKNOWN: "Sin datos",
};

/** "TIER_250" → "250 pacientes distintos al día". */
export function tierLabel(tier: string) {
  const match = /^TIER_(\w+)$/.exec(tier);
  if (!match) return tier || "—";
  const value = match[1].replace(/K$/, ".000").replace(/^UNLIMITED$/, "sin límite");
  return value === "sin límite" ? "Sin límite diario" : `${value} pacientes distintos al día`;
}

/** What Meta's most common failure codes mean for the front desk. */
const FAILURE_BY_CODE: Record<string, string> = {
  "131026": "WhatsApp no pudo entregarlo: el número no tiene WhatsApp o su aplicación está desactualizada.",
  "131021": "El número no es válido para WhatsApp.",
  "131052": "WhatsApp no pudo descargar el PDF. Inténtalo de nuevo.",
  "131053": "WhatsApp no pudo procesar el PDF. Inténtalo de nuevo.",
  "131056": "Se enviaron demasiados mensajes seguidos a este número. Espera unos minutos e inténtalo de nuevo.",
  "131000": "WhatsApp tuvo un error momentáneo. Inténtalo de nuevo.",
  "130429": "WhatsApp está limitando los envíos en este momento. Inténtalo en unos minutos.",
  "131031": "Meta bloqueó la cuenta de WhatsApp del centro. Revisa Administración › WhatsApp.",
  "132000": "La plantilla no coincide con la aprobada. Revisa Administración › WhatsApp.",
  "132001": "La plantilla no existe o no está aprobada. Revisa Administración › WhatsApp.",
};

/** A failed send in Spanish: Meta's code when we know it, else its own words. */
export function failureLabel(code: string | null | undefined, detail: string | null | undefined) {
  if (code && FAILURE_BY_CODE[code]) return FAILURE_BY_CODE[code];
  return detail || "No se pudo entregar.";
}
