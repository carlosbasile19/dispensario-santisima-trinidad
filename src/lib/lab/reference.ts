// Reference intervals and flags. A row carries its rules; the patient's sex
// and age on the day of the sample pick the one that applies, as the
// clinic's spreadsheets did with IF(SEXO=…). The same functions run in the
// editor, the printed boleta and the PDF, so all three always agree.

import { formatNumber, parseResult } from "./numbers";
import type { Flag, RefRule, ReportPatient, ReportRow, Sex } from "./types";

export type PatientFacts = { sex: Sex | null; age: number | null };

/** Whole years between a birth date and a day, both "YYYY-MM-DD". */
function yearsOn(birthDate: string, day: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Whole months between a birth date and a day. */
function monthsOn(birthDate: string, day: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
}

export function patientFacts(patient: Pick<ReportPatient, "sex" | "birth_date">, day: string): PatientFacts {
  const sex = patient.sex === "F" || patient.sex === "M" ? patient.sex : null;
  const age = patient.birth_date ? yearsOn(patient.birth_date, day) : null;
  return { sex, age: age !== null && age >= 0 ? age : null };
}

/** "34 años", "1 año", "8 meses". */
export function formatAge(birthDate: string | null, day: string) {
  if (!birthDate) return null;
  const years = yearsOn(birthDate, day);
  if (years < 0) return null;
  if (years >= 2) return `${years} años`;
  const months = Math.max(0, monthsOn(birthDate, day));
  if (months >= 12) return years === 1 ? "1 año" : `${years} años`;
  return months === 1 ? "1 mes" : `${months} meses`;
}

const SEX_LABEL: Record<Sex, string> = { M: "Hombres", F: "Mujeres" };

function matches(rule: RefRule, facts: PatientFacts) {
  if (rule.sex && rule.sex !== facts.sex) return false;
  // Without an age, the adult interval (the one with no upper age) applies.
  if (facts.age === null) return rule.maxAge === undefined;
  if (rule.minAge !== undefined && facts.age < rule.minAge) return false;
  if (rule.maxAge !== undefined && facts.age >= rule.maxAge) return false;
  return true;
}

/** The rule that decides this patient's flag, or null when none applies (e.g. sex unknown). */
export function ruleFor(rules: readonly RefRule[], facts: PatientFacts): RefRule | null {
  return rules.find((rule) => matches(rule, facts)) ?? null;
}

const n = (value: number) => formatNumber(value);

/** "70 – 110", "Hasta 220", "Menor de 20". */
export function ruleRange(rule: RefRule) {
  if (rule.text) return rule.text;
  if (rule.low !== undefined && rule.high !== undefined) return `${n(rule.low)} – ${n(rule.high)}`;
  if (rule.high !== undefined) return `Hasta ${n(rule.high)}`;
  if (rule.low !== undefined) return `Desde ${n(rule.low)}`;
  if (rule.below !== undefined) return `Menor de ${n(rule.below)}`;
  if (rule.above !== undefined) return `Mayor de ${n(rule.above)}`;
  return "";
}

const ruleLabel = (rule: RefRule) => rule.label ?? (rule.sex ? SEX_LABEL[rule.sex] : undefined);

/** "Hombres: 12 – 17". */
export function ruleText(rule: RefRule, withLabel: boolean) {
  const range = ruleRange(rule);
  const label = ruleLabel(rule);
  return withLabel && label ? `${label}: ${range}` : range;
}

/**
 * The reference as printed for this patient: only the interval that applies
 * when the patient's sex and age decide it (as the clinic's boletas print
 * it), every interval when they do not, plus any extra wording.
 */
export function referenceLines(row: Pick<ReportRow, "rules" | "refText">, facts: PatientFacts): string[] {
  const lines: string[] = [];
  if (row.rules.length) {
    const decided = row.rules.length > 1 ? ruleFor(row.rules, facts) : row.rules[0];
    if (decided) lines.push(ruleText(decided, row.rules.length > 1 && Boolean(decided.sex || decided.label)));
    else for (const rule of row.rules) lines.push(ruleText(rule, true));
  }
  for (const line of row.refText.split("\n")) if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Upper case, no accents, no trailing dots: "Negativo." and "NEGATIVO" match. */
export const answerKey = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The flag the reference gives a result, before any manual flag. */
export function autoFlag(row: Pick<ReportRow, "value" | "kind" | "rules" | "normal">, facts: PatientFacts): Flag | null {
  const value = row.value.trim();
  if (!value) return null;

  const number = row.kind === "text" ? null : parseResult(value);
  if (number !== null && row.rules.length) {
    const rule = ruleFor(row.rules, facts);
    if (!rule) return null;
    if (rule.low !== undefined && number < rule.low) return "L";
    if (rule.high !== undefined && number > rule.high) return "H";
    if (rule.below !== undefined && number >= rule.below) return "H";
    if (rule.above !== undefined && number <= rule.above) return "L";
    return null;
  }
  if (row.normal.length && row.kind !== "number") {
    const key = answerKey(value);
    const normal = row.normal.map(answerKey);
    if (normal.some((answer) => key === answer || key.startsWith(`${answer} `) || key.startsWith(`${answer}(`))) return null;
    return "A";
  }
  return null;
}

/** The row's flag: the manual one when set, otherwise the reference's. */
export function flagFor(row: Pick<ReportRow, "value" | "kind" | "rules" | "normal" | "flag">, facts: PatientFacts): Flag | null {
  if (!row.value.trim()) return null;
  if (row.flag === "N") return null;
  if (row.flag) return row.flag;
  return autoFlag(row, facts);
}

export const FLAG_INFO: Record<Flag, { label: string; short: string; arrow: string }> = {
  H: { label: "Alto", short: "A", arrow: "↑" },
  L: { label: "Bajo", short: "B", arrow: "↓" },
  A: { label: "Anormal", short: "*", arrow: "•" },
};

/**
 * Where a numeric result sits against its interval, for the range bars of
 * the PDF: positions from 0 to 1 of the normal band and of the value.
 * Null when the row has no closed interval for this patient.
 */
export function rangeBar(row: Pick<ReportRow, "value" | "kind" | "rules">, facts: PatientFacts) {
  if (row.kind !== "number" || !row.rules.length) return null;
  const value = parseResult(row.value);
  const rule = ruleFor(row.rules, facts);
  if (value === null || !rule) return null;
  const low = rule.low ?? (rule.high !== undefined || rule.below !== undefined ? 0 : undefined);
  const high = rule.high ?? rule.below;
  if (low === undefined || high === undefined || high <= low) return null;
  const span = high - low;
  const min = Math.max(0, Math.min(low - span * 0.5, value));
  const max = Math.max(high + span * 0.5, value);
  const at = (x: number) => (x - min) / (max - min || 1);
  return { start: at(low), end: at(high), value: Math.min(1, Math.max(0, at(value))) };
}
