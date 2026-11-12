// Building and checking a report's content. The editor uses the builders;
// the server action runs parseContent on whatever the browser sends, so the
// database only ever stores well-formed sections.

import { CATEGORIES, CATEGORY, PANEL, TESTS, categoryOrder, panelTests } from "./catalog";
import { FORMULAS, applyFormulas } from "./formulas";
import { flagFor, type PatientFacts } from "./reference";
import {
  PATIENT_TYPES,
  type CategoryKey,
  type Flag,
  type FlagOverride,
  type PanelDef,
  type PatientType,
  type RefRule,
  type ReportContent,
  type ReportRow,
  type ReportSection,
  type ResultKind,
  type TestDef,
} from "./types";

export const PATIENT_TYPE_LABEL: Record<PatientType, string> = {
  contado: "Contado",
  seguro: "Seguro",
  convenio: "Convenio",
  cortesia: "Cortesía",
};

/** "Nº 000123". */
export const reportNumber = (number: number) => String(number).padStart(6, "0");

export const LIMITS = { sections: 20, rowsPerSection: 80, rows: 300 } as const;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14);

/** A row for a catalog test, with the catalog's unit, reference and usual answer. */
export function rowFromTest(test: TestDef, group = ""): ReportRow {
  return {
    id: newId(),
    test: test.key,
    label: test.label,
    unit: test.unit ?? "",
    kind: test.kind,
    value: test.default ?? "",
    rules: test.ref ? test.ref.map((rule) => ({ ...rule })) : [],
    refText: test.refText ?? "",
    normal: test.normal ? [...test.normal] : [],
    flag: null,
    derive: test.derive ?? null,
    decimals: test.decimals ?? null,
    method: test.method ?? "",
    note: test.note ?? "",
    group,
  };
}

/** A test typed by hand. */
export function customRow(label = ""): ReportRow {
  return {
    id: newId(),
    test: null,
    label,
    unit: "",
    kind: "text",
    value: "",
    rules: [],
    refText: "",
    normal: [],
    flag: null,
    derive: null,
    decimals: null,
    method: "",
    note: "",
    group: "",
  };
}

export const newSection = (category: CategoryKey, title = CATEGORY[category].title): ReportSection => ({
  id: newId(),
  category,
  title,
  note: "",
  rows: [],
});

export const sortSections = (sections: ReportSection[]) =>
  [...sections].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));

/**
 * Adds tests to the section of `category` (created if missing), skipping
 * tests already in it. `groups` maps each test to its sub-heading.
 */
export function addTests(sections: ReportSection[], category: CategoryKey, keys: readonly string[], groups: Record<string, string> = {}) {
  const existing = sections.find((s) => s.category === category);
  const section = existing ?? newSection(category);
  const present = new Set(section.rows.map((row) => row.test).filter(Boolean));
  const added = keys
    .filter((key, index) => TESTS[key] && !present.has(key) && keys.indexOf(key) === index)
    .map((key) => rowFromTest(TESTS[key], groups[key] ?? ""));
  if (!added.length) return sections;
  const updated = { ...section, rows: [...section.rows, ...added].slice(0, LIMITS.rowsPerSection) };
  return applyFormulas(sortSections(existing ? sections.map((s) => (s.id === section.id ? updated : s)) : [...sections, updated]));
}

/** Adds a panel's tests to its category's section, with the panel's sub-headings. */
export function addPanel(sections: ReportSection[], panel: PanelDef) {
  const groups: Record<string, string> = {};
  for (const group of panel.groups) for (const key of group.tests) groups[key] = group.title ?? "";
  const existed = sections.some((s) => s.category === panel.category);
  const next = addTests(sections, panel.category, panelTests(panel), groups);
  // A section the panel opens may take the panel's name ("Hematología completa").
  if (existed || !panel.sectionTitle) return next;
  return next.map((s) => (s.category === panel.category ? { ...s, title: panel.sectionTitle as string } : s));
}

/** Adds a catalog test on its own, to its category's section. */
export const addTest = (sections: ReportSection[], key: string) => (TESTS[key] ? addTests(sections, TESTS[key].category, [key]) : sections);

/** Every catalog test already in the report. */
export const testsIn = (sections: ReportSection[]) => new Set(sections.flatMap((s) => s.rows.map((r) => r.test).filter((t): t is string => Boolean(t))));

/** Panels whose tests are all in the report. */
export const panelIsIn = (sections: ReportSection[], key: string) => {
  const present = testsIn(sections);
  const panel = PANEL[key];
  return Boolean(panel) && panelTests(panel).every((test) => present.has(test));
};

// Counting -------------------------------------------------------------------------

export function tally(sections: ReportSection[], facts: PatientFacts) {
  let results = 0;
  let empty = 0;
  const flagged: { section: ReportSection; row: ReportRow; flag: Flag }[] = [];
  for (const section of sections) {
    for (const row of section.rows) {
      if (!row.value.trim()) {
        empty++;
        continue;
      }
      results++;
      const flag = flagFor(row, facts);
      if (flag) flagged.push({ section, row, flag });
    }
  }
  return { results, empty, flagged };
}

/** The sections as printed: only rows with a result, only sections with rows. */
export function printedSections(sections: ReportSection[]) {
  return sections
    .map((section) => ({ ...section, rows: section.rows.filter((row) => row.value.trim()) }))
    .filter((section) => section.rows.length);
}

/** Consecutive rows sharing a sub-heading. */
export function groupRows(rows: ReportRow[]) {
  const groups: { title: string; rows: ReportRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.title === row.group) last.rows.push(row);
    else groups.push({ title: row.group, rows: [row] });
  }
  return groups;
}

// Checking what the browser sends ---------------------------------------------------------------

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));
const KINDS = new Set<ResultKind>(["number", "option", "text"]);
const FLAGS = new Set<FlagOverride>(["H", "L", "A", "N"]);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A string of at most `max` characters, or null when it is something else. */
function str(value: unknown, max: number, { required = false } = {}) {
  if (value === undefined || value === null) return required ? null : "";
  if (typeof value !== "string") return null;
  // No control characters except line breaks and tabs.
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (clean.length > max) return null;
  if (required && !clean.trim()) return null;
  return clean;
}

const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1e9 ? value : undefined);

function parseRule(raw: unknown): RefRule | null {
  if (!isObject(raw)) return null;
  const rule: RefRule = {};
  if (raw.sex === "F" || raw.sex === "M") rule.sex = raw.sex;
  for (const key of ["minAge", "maxAge", "low", "high", "below", "above"] as const) {
    const n = finite(raw[key]);
    if (n !== undefined) rule[key] = n;
  }
  for (const key of ["label", "text"] as const) {
    const s = str(raw[key], 120);
    if (s === null) return null;
    if (s.trim()) rule[key] = s.trim();
  }
  return rule;
}

function parseRow(raw: unknown): ReportRow | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id, 40, { required: true });
  const label = str(raw.label, 120, { required: true });
  const unit = str(raw.unit, 30);
  const value = str(raw.value, 600);
  const refText = str(raw.refText, 600);
  const method = str(raw.method, 200);
  const note = str(raw.note, 300);
  const group = str(raw.group, 80);
  if (id === null || label === null || unit === null || value === null || refText === null || method === null || note === null || group === null) return null;

  const kind = KINDS.has(raw.kind as ResultKind) ? (raw.kind as ResultKind) : null;
  if (!kind) return null;
  const test = typeof raw.test === "string" && TESTS[raw.test] ? raw.test : null;
  const derive = typeof raw.derive === "string" && raw.derive in FORMULAS ? (raw.derive as ReportRow["derive"]) : null;
  const flag = raw.flag === null || raw.flag === undefined ? null : FLAGS.has(raw.flag as FlagOverride) ? (raw.flag as FlagOverride) : undefined;
  if (flag === undefined) return null;
  const decimals = raw.decimals === null || raw.decimals === undefined ? null : Number.isInteger(raw.decimals) && (raw.decimals as number) >= 0 && (raw.decimals as number) <= 4 ? (raw.decimals as number) : undefined;
  if (decimals === undefined) return null;

  const rulesRaw = raw.rules ?? [];
  if (!Array.isArray(rulesRaw) || rulesRaw.length > 8) return null;
  const rules: RefRule[] = [];
  for (const entry of rulesRaw) {
    const rule = parseRule(entry);
    if (!rule) return null;
    rules.push(rule);
  }
  const normalRaw = raw.normal ?? [];
  if (!Array.isArray(normalRaw) || normalRaw.length > 10) return null;
  const normal: string[] = [];
  for (const entry of normalRaw) {
    const answer = str(entry, 60, { required: true });
    if (answer === null) return null;
    normal.push(answer);
  }

  return { id, test, label: label.trim(), unit: unit.trim(), kind, value, rules, refText, normal, flag, derive, decimals, method: method.trim(), note: note.trim(), group: group.trim() };
}

function parseSection(raw: unknown): ReportSection | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id, 40, { required: true });
  const title = str(raw.title, 80, { required: true });
  const note = str(raw.note, 800);
  if (id === null || title === null || note === null) return null;
  if (typeof raw.category !== "string" || !CATEGORY_KEYS.has(raw.category)) return null;
  if (!Array.isArray(raw.rows) || raw.rows.length > LIMITS.rowsPerSection) return null;
  const rows: ReportRow[] = [];
  for (const entry of raw.rows) {
    const row = parseRow(entry);
    if (!row) return null;
    rows.push(row);
  }
  return { id, category: raw.category as CategoryKey, title: title.trim(), note, rows };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The report content the browser sent, checked and with its computed rows
 * recalculated, or an error in Spanish.
 */
export function parseContent(raw: unknown): { content: ReportContent } | { error: string } {
  if (!isObject(raw)) return { error: "El informe no tiene el formato esperado." };
  if (!Array.isArray(raw.sections) || raw.sections.length > LIMITS.sections) return { error: "Demasiadas secciones en el informe." };
  const sections: ReportSection[] = [];
  for (const entry of raw.sections) {
    const section = parseSection(entry);
    if (!section) return { error: "Una sección del informe no es válida. Recarga la página e inténtalo de nuevo." };
    sections.push(section);
  }
  if (sections.reduce((sum, s) => sum + s.rows.length, 0) > LIMITS.rows) return { error: `Un informe admite hasta ${LIMITS.rows} pruebas.` };

  const notes = str(raw.notes, 2000);
  const requestedBy = str(raw.requestedBy, 120);
  if (notes === null || requestedBy === null) return { error: "Revisa las observaciones y el médico solicitante." };
  const patientType = (PATIENT_TYPES as readonly string[]).includes(raw.patientType as string) ? (raw.patientType as PatientType) : null;
  if (!patientType) return { error: "Elige el tipo de paciente." };
  const sampledDay = typeof raw.sampledDay === "string" && DAY.test(raw.sampledDay) && !Number.isNaN(Date.parse(raw.sampledDay)) ? raw.sampledDay : null;
  const sampledTime = typeof raw.sampledTime === "string" && TIME.test(raw.sampledTime) ? raw.sampledTime : null;
  if (!sampledDay || !sampledTime) return { error: "Revisa la fecha y la hora de la muestra." };

  return {
    content: {
      sections: applyFormulas(sortSections(sections)),
      notes: notes.trim(),
      requestedBy: requestedBy.trim(),
      patientType,
      sampledDay,
      sampledTime,
    },
  };
}

/** Reads the sections stored in the database (already checked when saved). */
export function storedSections(raw: unknown): ReportSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: ReportSection[] = [];
  for (const entry of raw) {
    const section = parseSection(entry);
    if (section) sections.push(section);
  }
  return sections;
}
