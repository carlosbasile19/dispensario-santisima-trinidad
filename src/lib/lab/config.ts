// The laboratory as its documents present it. The address and phones are the
// ones printed at the foot of the clinic's boletas.

import { ADDRESS_SHORT, LEGAL_NAME, RIF } from "@/lib/site-config";

export const LAB_INFO = {
  /** Heading of the boleta. */
  name: "Laboratorio Clínico",
  /** "C. M. Santísima Trinidad, C. A." as printed under it. */
  clinic: "C. M. Santísima Trinidad, C. A.",
  legalName: LEGAL_NAME,
  rif: RIF,
  address: ADDRESS_SHORT,
  phones: ["0426-7891395", "0412-8261258"],
} as const;

export const LAB_DISCLAIMER =
  "Los resultados deben ser interpretados por su médico tratante. Los valores de referencia corresponden a los métodos de este laboratorio.";

/** The PDF's file name: no patient data, which travels in the message instead. */
export const pdfFileName = (number: string) => `Resultados-Laboratorio-${number}.pdf`;
