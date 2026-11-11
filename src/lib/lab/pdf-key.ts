// The key that opens a lab PDF sent by WhatsApp: something the patient knows
// and a stranger who gets the message by mistake (a mistyped or reassigned
// number) does not. The message names which key it is, never the key itself,
// so WhatsApp never carries an ID number. Members download, print and share
// the PDF without a key.

import type { ReportPatient } from "./types";

export type PdfKey = {
  /** What the PDF asks for. */
  password: string;
  /** How the message names it: "Para abrirlo, la clave es {hint}." */
  hint: string;
  /** How the platform names it for members: "Se abre con {label}." */
  label: string;
};

/**
 * The cédula (its digits), else the passport (in capitals), else the birth
 * date as DDMMAAAA (children without a document). Null when the record has
 * none of them: the report then cannot go out by WhatsApp.
 */
export function pdfKey(patient: Pick<ReportPatient, "id_type" | "id_number" | "birth_date">): PdfKey | null {
  const number = patient.id_number?.trim() ?? "";
  if ((patient.id_type === "V" || patient.id_type === "E") && /^\d{5,10}$/.test(number)) {
    return { password: number, hint: "tu número de cédula, solo los números", label: "el número de cédula del paciente" };
  }
  if (patient.id_type === "P" && /^[0-9A-Z]{4,15}$/i.test(number)) {
    return {
      password: number.toUpperCase(),
      hint: "tu número de pasaporte, con las letras en mayúscula",
      label: "el número de pasaporte del paciente, en mayúsculas",
    };
  }
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(patient.birth_date ?? "");
  if (birth) {
    return {
      password: `${birth[3]}${birth[2]}${birth[1]}`,
      hint: "tu fecha de nacimiento en 8 números: día, mes y año (DDMMAAAA)",
      label: "la fecha de nacimiento del paciente (DDMMAAAA)",
    };
  }
  return null;
}
