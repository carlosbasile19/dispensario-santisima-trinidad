// Dictated results. The bioanalyst speaks the results; the browser turns the
// voice into text and the dictation route (app/dashboard/laboratorio/[id]/
// dictado) has Claude sort that text into the catalog's tests. Everything
// Claude returns is checked here, against the catalog, before the browser
// sees it; the member then reviews it, and applyDictation merges what they
// kept into the report, which stays a draft until it is validated.
// Shared by the route and the editor.

import { CATEGORY, CATEGORIES, PANEL, TESTS } from "./catalog";
import { formatNumber, parseResult, tidyNumber } from "./numbers";
import { answerKey } from "./reference";
import { LIMITS, addPanel, addTest, customRow, newSection, sortSections } from "./report";
import { normalize } from "./search";
import { PATIENT_TYPES, type CategoryKey, type PatientType, type ReportContent, type ReportRow, type ReportSection, type ResultKind } from "./types";

export type DictatedResult = {
  /** Stable within a dictation: the catalog key, or the hand-typed test's name. */
  id: string;
  /** Catalog key, or null for a test the catalog does not have. */
  test: string | null;
  label: string;
  category: CategoryKey;
  unit: string;
  kind: ResultKind;
  /** In the house style: "13,5", "145.000", "NEGATIVO". */
  value: string;
  /** The words of the dictation the value came from. */
  heard: string;
  /** Why the member should look at it twice, or null. */
  doubt: string | null;
};

export type Dictation = {
  /** Panels the speaker named ("hematología completa"): their tests are added, dictated or not. */
  panels: string[];
  results: DictatedResult[];
  sectionNotes: { category: CategoryKey; note: string }[];
  notes: string;
  requestedBy: string;
  patientType: PatientType | null;
  sampledDay: string | null;
  sampledTime: string | null;
  /** Phrases that sounded like results but could not be placed. */
  unclear: string[];
};

/** What the dictation route streams, one JSON object per line. */
export type DictationEvent =
  | { type: "result"; result: DictatedResult }
  /** The model was switched mid-answer (a fallback): forget the results streamed so far. */
  | { type: "reset" }
  | { type: "done"; dictation: Dictation; seconds: number }
  | { type: "error"; message: string };

export const DICTATION_LIMITS = { transcript: 12_000, unclear: 20 } as const;

export const emptyDictation = (): Dictation => ({
  panels: [],
  results: [],
  sectionNotes: [],
  notes: "",
  requestedBy: "",
  patientType: null,
  sampledDay: null,
  sampledTime: null,
  unclear: [],
});

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Text without control characters or runs of spaces, at most `max` characters. */
function clean(value: unknown, max: number, { lines = false } = {}) {
  if (typeof value !== "string") return "";
  const text = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(lines ? /[^\S\n]+/g : /\s+/g, " ")
    .trim();
  return text.slice(0, max).trim();
}

/** "250 mil" → "250000"; a figure said with its unit ("13,5 g/dL") loses the unit. */
function spokenFigure(text: string, unit: string) {
  let figure = text;
  if (unit && figure.toLowerCase().endsWith(unit.toLowerCase())) figure = figure.slice(0, -unit.length).trim();
  const thousands = figure.match(/^(\d+(?:[.,]\d+)?)\s*mil$/i);
  if (thousands) {
    const value = parseResult(thousands[1]);
    if (value !== null) figure = String(Math.round(value * 1000));
  }
  return figure;
}

/** A result in the house style for its kind, or one of the test's usual answers. */
export function houseValue(raw: string, kind: ResultKind, options: readonly string[] = [], unit = "") {
  const text = raw.replace(/\s+/g, " ").trim();
  const usual = options.find((option) => answerKey(option) === answerKey(text));
  if (usual) return usual;
  if (kind === "number") return tidyNumber(spokenFigure(text, unit));
  if (kind === "option") return text.toLocaleUpperCase("es");
  return text;
}

/** The editor's warning for a figure far outside what the test can measure. */
export function implausible(test: string | null, value: string) {
  const def = test ? TESTS[test] : null;
  if (!def?.plausible || def.kind !== "number") return null;
  const number = parseResult(value);
  if (number === null) return null;
  const [low, high] = def.plausible;
  if (number >= low && number <= high) return null;
  return `¿Valor correcto? Lo esperable está entre ${formatNumber(low)} y ${formatNumber(high)}${def.unit ? ` ${def.unit}` : ""}.`;
}

const idOf = (test: string | null, label: string) => (test ? `t:${test}` : `c:${normalize(label)}`);

/** One result as Claude sent it, checked against the catalog; null when it cannot be used. */
export function normalizeResult(raw: unknown): DictatedResult | null {
  if (!isObject(raw)) return null;
  const key = typeof raw.test === "string" ? raw.test : "";
  const def = TESTS[key] ?? null;
  const label = def ? def.label : clean(raw.label, 120);
  if (!label) return null;
  const category: CategoryKey = def
    ? def.category
    : typeof raw.category === "string" && CATEGORY_KEYS.has(raw.category)
      ? (raw.category as CategoryKey)
      : "otros";
  const said = clean(raw.value, 600);
  if (!said) return null;
  const unit = def ? (def.unit ?? "") : clean(raw.unit, 30);
  const kind: ResultKind = def ? def.kind : parseResult(spokenFigure(said, unit)) !== null ? "number" : "text";
  const value = houseValue(said, kind, def?.options, unit);
  if (!value) return null;

  const doubts = [
    raw.check === "revisar" ? clean(raw.why, 200) || "Revisa este valor." : "",
    implausible(def?.key ?? null, value) ?? "",
  ].filter(Boolean);
  return {
    id: idOf(def?.key ?? null, label),
    test: def?.key ?? null,
    label,
    category,
    unit,
    kind,
    value,
    heard: clean(raw.heard, 160),
    doubt: doubts.length ? doubts.join(" ") : null,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Claude's whole answer, checked. A test dictated twice keeps its last value. */
export function normalizeDictation(raw: unknown): Dictation {
  const out = emptyDictation();
  if (!isObject(raw)) return out;

  if (Array.isArray(raw.panels)) {
    out.panels = [...new Set(raw.panels.filter((key): key is string => typeof key === "string" && key in PANEL))];
  }

  const byId = new Map<string, DictatedResult>();
  for (const entry of Array.isArray(raw.results) ? raw.results : []) {
    const result = normalizeResult(entry);
    if (!result) continue;
    const earlier = byId.get(result.id);
    // Map order follows the first mention; the value is the last one said.
    if (earlier && earlier.value !== result.value) {
      result.doubt = [result.doubt, `Se dictó dos veces (${earlier.value} y ${result.value}): queda el último.`].filter(Boolean).join(" ");
    }
    byId.set(result.id, result);
    if (byId.size >= LIMITS.rows) break;
  }
  out.results = [...byId.values()];

  const notes = new Map<CategoryKey, string>();
  for (const entry of Array.isArray(raw.section_notes) ? raw.section_notes : []) {
    if (!isObject(entry) || typeof entry.category !== "string" || !CATEGORY_KEYS.has(entry.category)) continue;
    const note = clean(entry.note, 800, { lines: true });
    if (!note) continue;
    const category = entry.category as CategoryKey;
    notes.set(category, appendText(notes.get(category) ?? "", note, 800));
  }
  out.sectionNotes = [...notes].map(([category, note]) => ({ category, note }));

  out.notes = clean(raw.notes, 2000, { lines: true });
  out.requestedBy = clean(raw.requested_by, 120);
  out.patientType = (PATIENT_TYPES as readonly string[]).includes(raw.patient_type as string) ? (raw.patient_type as PatientType) : null;
  out.sampledDay = typeof raw.sampled_day === "string" && DAY.test(raw.sampled_day) && !Number.isNaN(Date.parse(raw.sampled_day)) ? raw.sampled_day : null;
  out.sampledTime = typeof raw.sampled_time === "string" && TIME.test(raw.sampled_time) ? raw.sampled_time : null;
  if (Array.isArray(raw.unclear)) {
    out.unclear = raw.unclear
      .map((phrase) => clean(phrase, 200))
      .filter(Boolean)
      .slice(0, DICTATION_LIMITS.unclear);
  }
  return out;
}

/** Adds a sentence to a note unless it is already there. */
export function appendText(current: string, addition: string, max: number) {
  const text = addition.trim();
  if (!text) return current;
  if (normalize(current).includes(normalize(text))) return current;
  return (current.trim() ? `${current.trim()}\n${text}` : text).slice(0, max);
}

/** Every row of the report, with its section. */
function findRow(sections: ReportSection[], match: (row: ReportRow) => boolean) {
  for (const section of sections) {
    const row = section.rows.find(match);
    if (row) return { section, row };
  }
  return null;
}

const patchRow = (sections: ReportSection[], id: string, patch: Partial<ReportRow>) =>
  sections.map((section) =>
    section.rows.some((row) => row.id === id) ? { ...section, rows: section.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : section,
  );

const rowCount = (sections: ReportSection[]) => sections.reduce((sum, section) => sum + section.rows.length, 0);

/** What the report holds now for a dictated result's test, to show "antes" in the review. */
export function currentValue(sections: ReportSection[], result: Pick<DictatedResult, "test" | "label">) {
  const key = normalize(result.label);
  const found = findRow(sections, (row) => (result.test ? row.test === result.test : !row.test && normalize(row.label) === key));
  return found ? { value: found.row.value, derived: Boolean(found.row.derive) } : null;
}

/**
 * Merges a reviewed dictation into the report: named panels first (their
 * tests are added even if some were not dictated, so the validation dialog
 * shows what is missing), then each result in its test's row (added when
 * missing; a computed row the speaker dictated keeps the dictated figure),
 * then the notes and the sample's details. Answers the new content and the
 * rows it filled, for the editor to highlight.
 */
export function applyDictation(content: ReportContent, dictation: Dictation): { content: ReportContent; touched: string[] } {
  let sections = content.sections;
  for (const key of dictation.panels) if (PANEL[key]) sections = addPanel(sections, PANEL[key]);

  const touched: string[] = [];
  for (const result of dictation.results) {
    if (result.test) {
      if (!findRow(sections, (row) => row.test === result.test)) sections = addTest(sections, result.test);
      const found = findRow(sections, (row) => row.test === result.test);
      if (!found) continue; // The section is full.
      sections = patchRow(sections, found.row.id, { value: result.value, ...(found.row.derive ? { derive: null } : {}) });
      touched.push(found.row.id);
      continue;
    }

    const key = normalize(result.label);
    const found = findRow(sections, (row) => !row.test && normalize(row.label) === key);
    if (found) {
      sections = patchRow(sections, found.row.id, { value: result.value });
      touched.push(found.row.id);
      continue;
    }
    if (rowCount(sections) >= LIMITS.rows) continue;
    const row: ReportRow = { ...customRow(result.label), unit: result.unit, kind: result.kind, value: result.value };
    const section = sections.find((s) => s.category === result.category);
    if (section) {
      if (section.rows.length >= LIMITS.rowsPerSection) continue;
      sections = sections.map((s) => (s.id === section.id ? { ...s, rows: [...s.rows, row] } : s));
    } else {
      if (sections.length >= LIMITS.sections) continue;
      sections = sortSections([...sections, { ...newSection(result.category), rows: [row] }]);
    }
    touched.push(row.id);
  }

  let notes = content.notes;
  for (const { category, note } of dictation.sectionNotes) {
    const section = sections.find((s) => s.category === category);
    if (section) sections = sections.map((s) => (s.id === section.id ? { ...s, note: appendText(s.note, note, 800) } : s));
    else notes = appendText(notes, `${CATEGORY[category].title}: ${note}`, 2000);
  }
  notes = appendText(notes, dictation.notes, 2000);

  return {
    content: {
      ...content,
      sections,
      notes,
      requestedBy: dictation.requestedBy || content.requestedBy,
      patientType: dictation.patientType ?? content.patientType,
      sampledDay: dictation.sampledDay ?? content.sampledDay,
      sampledTime: dictation.sampledTime ?? content.sampledTime,
    },
    touched,
  };
}

/** The tests of the named panels that were not dictated and are not in the report yet. */
export function missingFromPanels(sections: ReportSection[], dictation: Pick<Dictation, "panels" | "results">) {
  const dictated = new Set(dictation.results.map((r) => r.test).filter(Boolean));
  const present = new Set(sections.flatMap((s) => s.rows.filter((r) => r.value.trim()).map((r) => r.test)).filter(Boolean));
  return dictation.panels
    .map((key) => {
      const panel = PANEL[key];
      const tests = panel.groups
        .flatMap((group) => group.tests)
        .filter((test) => !dictated.has(test) && !present.has(test) && !TESTS[test]?.derive && !TESTS[test]?.default);
      return { panel: panel.title, category: panel.category, tests: tests.map((test) => TESTS[test]?.label ?? test) };
    })
    .filter((entry) => entry.tests.length);
}
