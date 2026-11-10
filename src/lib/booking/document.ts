// Identity documents the way patients.id_type and id_number keep them, with
// the same rules as the patients form and book_online(): a cédula (V for
// Venezuelans, E for foreign residents) has 5 to 10 digits, a passport 4 to
// 15 letters and digits. Shared by the booking page and the server.

export const DOCUMENT_TYPES = ["V", "E", "P"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const isDocumentType = (value: unknown): value is DocumentType =>
  typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value);

export const DOCUMENT_LABEL: Record<DocumentType, string> = { V: "V", E: "E", P: "Pasaporte" };

/** What the database keeps of a typed number: the digits of a cédula, the letters and digits of a passport. */
export const cleanDocument = (type: DocumentType, raw: string) =>
  type === "P" ? raw.toUpperCase().replace(/[^0-9A-Z]/g, "") : raw.replace(/\D/g, "");

export const isValidDocument = (type: DocumentType, raw: string) => {
  const number = cleanDocument(type, raw);
  return type === "P" ? /^[0-9A-Z]{4,15}$/.test(number) : /^\d{5,10}$/.test(number);
};

/** While typing: "12345678" → "12.345.678" for a cédula, a passport in capitals. */
export function formatDocumentInput(type: DocumentType, value: string) {
  if (type === "P") return value.toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 20);
  return value
    .replace(/\D/g, "")
    .slice(0, 10)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "V-12.345.678" or "e 8123456" typed whole into the number: its type and the rest. */
export function splitTypedDocument(value: string): { type: DocumentType; rest: string } | null {
  const match = /^\s*([VvEe])\s*[-.\s]?\s*(\d[\d.\s-]*)$/.exec(value);
  return match ? { type: match[1].toUpperCase() as DocumentType, rest: match[2] } : null;
}
