// Shapes of the laboratory's catalog and of a saved report. Shared by the
// editor (browser), the server actions, the printed boleta and the PDF.

export type Sex = "F" | "M";

/**
 * One reference interval. Without `sex` or ages it applies to everyone;
 * `low`/`high` are inclusive bounds, `below`/`above` strict ones ("menor a
 * 20"). `text` replaces the generated wording ("70 – 110", "Hasta 220").
 */
export type RefRule = {
  sex?: Sex;
  /** Years, inclusive. */
  minAge?: number;
  /** Years, exclusive. */
  maxAge?: number;
  /** Who the rule is for, as printed: "Hombres", "Niños". */
  label?: string;
  low?: number;
  high?: number;
  below?: number;
  above?: number;
  text?: string;
};

/** number: a figure with a unit · option: a word from a list (or typed) · text: a sentence. */
export type ResultKind = "number" | "option" | "text";

/** Alto, bajo or anormal (a qualitative result outside the normal answers). */
export type Flag = "H" | "L" | "A";

/** A manual flag on a row: one of the flags, or "N" to mark it normal. */
export type FlagOverride = Flag | "N";

export type FormulaKey =
  | "chcm"
  | "vcm"
  | "hcm"
  | "katz"
  | "ldl"
  | "vldl"
  | "bilirrubina_indirecta"
  | "globulina"
  | "relacion_ag"
  | "indice_ct_hdl"
  | "indice_ldl_hdl"
  | "pt_razon"
  | "pt_actividad"
  | "inr"
  | "psa_indice"
  | "tibc"
  | "saturacion_transferrina";

export type CategoryKey =
  | "hematologia"
  | "coagulacion"
  | "quimica"
  | "diabetes"
  | "tiroides"
  | "hierro"
  | "orina"
  | "orina_especial"
  | "heces"
  | "inmunologia"
  | "anticuerpos"
  | "marcadores"
  | "hormonas"
  | "cardiologia"
  | "farmacos"
  | "microbiologia"
  | "otros";

export type TestDef = {
  key: string;
  label: string;
  /** The category whose section the test goes in when added on its own. */
  category: CategoryKey;
  kind: ResultKind;
  unit?: string;
  /** Fixed decimals for computed values (typed values keep what was typed). */
  decimals?: number;
  /** Answers offered in the editor; `option` results may still be typed. */
  options?: readonly string[];
  /** Answers that are normal; any other answer flags the row as anormal. */
  normal?: readonly string[];
  ref?: readonly RefRule[];
  /** Reference as printed when it is not a simple interval (phases, weeks, bands). */
  refText?: string;
  /** Computed from other results of the report. */
  derive?: FormulaKey;
  /** Printed in small type under the test: "(Determinación por cromatografía)". */
  method?: string;
  note?: string;
  /** Pre-filled answer (the usual normal finding). */
  default?: string;
  /** Values outside these are probably a typing mistake; the editor asks. */
  plausible?: readonly [number, number];
  /** Extra words the catalog search matches. */
  keywords?: string;
};

export type PanelGroup = { title?: string; tests: readonly string[] };

/** A set of tests added together: a profile ("Perfil lipídico") or a whole exam ("Orina completa"). */
export type PanelDef = {
  key: string;
  category: CategoryKey;
  title: string;
  description?: string;
  groups: readonly PanelGroup[];
  /** Title of the section when this panel opens it (otherwise the category's). */
  sectionTitle?: string;
  keywords?: string;
};

export type CategoryDef = {
  key: CategoryKey;
  /** The section's title on the report. */
  title: string;
  /** Short name for chips and tabs. */
  short: string;
};

// A saved report ----------------------------------------------------------------

/**
 * One line of results. It carries everything needed to print it (label,
 * unit, the reference rules copied from the catalog when it was added), so
 * a report never depends on later changes to the catalog.
 */
export type ReportRow = {
  /** Stable id within the report. */
  id: string;
  /** Catalog key, or null for a test typed by hand. */
  test: string | null;
  label: string;
  unit: string;
  kind: ResultKind;
  value: string;
  rules: RefRule[];
  /** Printed reference when the rules are not enough (or replace them). */
  refText: string;
  normal: string[];
  /** Manual flag; null lets the reference decide. */
  flag: FlagOverride | null;
  /** Formula computing the value; null when it is typed (or was unlocked). */
  derive: FormulaKey | null;
  decimals: number | null;
  method: string;
  note: string;
  /** Sub-heading inside the section ("Caracteres físicos"). */
  group: string;
};

export type ReportSection = {
  id: string;
  category: CategoryKey;
  title: string;
  /** Observations printed under the section. */
  note: string;
  rows: ReportRow[];
};

/** What the editor saves. */
export type ReportContent = {
  sections: ReportSection[];
  notes: string;
  patientType: PatientType;
  requestedBy: string;
  /** Clinic day "YYYY-MM-DD" and time "HH:MM" of the sample. */
  sampledDay: string;
  sampledTime: string;
};

export const PATIENT_TYPES = ["contado", "seguro", "convenio", "cortesia"] as const;
export type PatientType = (typeof PATIENT_TYPES)[number];

/** The patient as the report identifies them. */
export type ReportPatient = {
  first_name: string;
  last_name: string;
  id_type: string | null;
  id_number: string | null;
  birth_date: string | null;
  sex: string | null;
};

/**
 * What validating a report does on WhatsApp: the PDF goes out on its own to
 * this phone, or not, and why (for the validation dialog).
 */
export type AutoSend = { will: true; phone: string } | { will: false; reason: string };

/** The bioanalyst who signs, as copied into a validated report. */
export type ReportSigner = {
  name: string;
  title: string;
  id_number: string | null;
  registry: string | null;
  college: string | null;
};
