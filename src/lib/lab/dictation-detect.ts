// While the member speaks: which catalog tests the words name so far, with
// the figure or answer said right after. Only a hint on screen, so the member
// sees the dictation being understood; the results come from Claude.

import { TEST_LIST } from "./catalog";

type Term = { tokens: string[]; label: string };

/** Lower case, no accents; figures keep their separators ("13,5"). */
const tokensOf = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.,]+/g, " ")
    .split(" ")
    .map((token) => token.replace(/^[.,]+|[.,]+$/g, ""))
    .filter(Boolean);

/** Labels too common in speech to mean a test. */
const SKIP = new Set(["otros", "color", "olor", "aspecto"]);

const TERMS: Term[] = (() => {
  const terms: Term[] = [];
  const seen = new Set<string>();
  const add = (phrase: string, label: string) => {
    const tokens = tokensOf(phrase);
    const key = tokens.join(" ");
    if (!tokens.length || seen.has(key) || SKIP.has(key)) return;
    seen.add(key);
    terms.push({ tokens, label });
  };
  for (const test of TEST_LIST) {
    // "Transaminasa oxalacética (TGO)" is said either way.
    const label = test.label.replace(/\s*\(.*?\)\s*/g, " ").trim();
    add(label, test.label);
    for (const inner of test.label.match(/\((.*?)\)/g) ?? []) add(inner.slice(1, -1), test.label);
    // Short keywords are abbreviations people say: "hb", "hto", "tgo".
    for (const word of (test.keywords ?? "").split(" ")) if (word.length >= 2 && word.length <= 4) add(word, test.label);
  }
  return terms.sort((a, b) => b.tokens.length - a.tokens.length);
})();

const BY_FIRST = new Map<string, Term[]>();
for (const term of TERMS) BY_FIRST.set(term.tokens[0], [...(BY_FIRST.get(term.tokens[0]) ?? []), term]);

const FIGURE = /^[<>]?\d+([.,]\d+)*$/;
const ANSWERS = new Set(["negativo", "positivo", "trazas", "normal", "reactivo", "escasas", "escasos", "moderadas", "moderados", "abundantes", "claro", "clara", "turbio", "amarillo", "amarilla"]);

export type Mention = { label: string; value: string };

/** Words between two mentions of a test for the second to be a correction of the first ("12, no, perdón, 13"). */
const CORRECTION_WORDS = 8;

/**
 * The tests named in a dictation, in the order said, each with the figure
 * heard after it. A test named again soon after is a correction and keeps
 * one chip; named again much later (the urine's leukocytes after the blood's)
 * it is another one.
 */
export function detectMentions(text: string): Mention[] {
  const tokens = tokensOf(text);
  const found: (Mention & { at: number })[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const term = BY_FIRST.get(tokens[i])?.find((t) => t.tokens.every((token, k) => tokens[i + k] === token));
    if (!term) continue;
    let value = "";
    const end = i + term.tokens.length;
    for (let j = end; j < Math.min(end + 4, tokens.length); j++) {
      if (BY_FIRST.has(tokens[j]) && j > end) break;
      if (FIGURE.test(tokens[j])) {
        value = tokens[j + 1] === "mil" ? `${tokens[j]} mil` : tokens[j];
        break;
      }
      if (ANSWERS.has(tokens[j])) {
        value = tokens[j].toUpperCase();
        break;
      }
    }
    const last = found.findLast((m) => m.label === term.label);
    if (last && i - last.at <= CORRECTION_WORDS) {
      if (value) last.value = value;
      last.at = i;
    } else if (!last || value !== last.value) {
      found.push({ label: term.label, value, at: i });
    }
    i = end - 1;
  }
  return found.map(({ label, value }) => ({ label, value }));
}

// Speech recognition --------------------------------------------------------------

type SpeechResults = { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } | undefined } };

const squash = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The settled text and the words in progress of one recognition session.
 * Chrome on Android (`cumulative`) repeats each settled phrase inside the
 * next one ("hemoglobina", "hemoglobina trece"): there, a phrase that extends
 * the previous one replaces it, and one already contained in it is dropped.
 * Other browsers send each phrase once, and a short phrase said twice
 * ("negativo", "negativo") is two results.
 */
export function sessionText(results: SpeechResults, cumulative = false) {
  const settled: string[] = [];
  const pending: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const text = result[0]?.transcript.trim() ?? "";
    if (!text) continue;
    if (!result.isFinal) {
      pending.push(text);
      continue;
    }
    const last = settled.at(-1);
    if (cumulative && last && squash(text).startsWith(squash(last))) settled[settled.length - 1] = text;
    else if (!cumulative || !last || !squash(last).startsWith(squash(text))) settled.push(text);
  }
  return { settled: settled.join(" "), pending: pending.join(" ") };
}
