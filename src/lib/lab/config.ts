// The laboratory as its documents present it. The address and phones are the
// ones printed at the foot of the clinic's boletas.

import { ADDRESS_SHORT, LEGAL_NAME, RIF } from "@/lib/site-config";

// The laboratory is a service of the Centro Médico Integral, so documents
// name the clinic first and the laboratory under it, never the other way.
export const LAB_INFO = {
  /** The service, printed under the clinic's name. */
  name: "Laboratorio Clínico",
  /** The clinic's name on the boleta's header, split as the logo sets it. */
  clinicKind: "Centro Médico Integral",
  clinicName: "Santísima Trinidad",
  /** The company, "C. M. Santísima Trinidad, C. A.". */
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
