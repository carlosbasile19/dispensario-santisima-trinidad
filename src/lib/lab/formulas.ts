// Results the laboratory computes from others, as the clinic's spreadsheets
// did (CHCM = Hb × 100 / Hto, LDL by Friedewald, bilirrubina indirecta =
// total − directa…). A computed row stays editable: the bioanalyst can unlock
// it and type another value.

import { formatNumber, parseResult } from "./numbers";
import type { FormulaKey, ReportSection } from "./types";

type Values = (key: string) => number | null;

type Formula = {
  /** The tests it needs, by catalog key. */
  needs: readonly string[];
  /** How the editor explains it. */
  label: string;
  compute: (v: Values) => number | null;
};

const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b !== 0 ? a / b : null);

export const FORMULAS: Record<FormulaKey, Formula> = {
  chcm: { needs: ["hemoglobina", "hematocrito"], label: "Hb × 100 / Hto", compute: (v) => scale(ratio(v("hemoglobina"), v("hematocrito")), 100) },
  vcm: { needs: ["hematocrito", "globulos_rojos"], label: "Hto × 10 / glóbulos rojos", compute: (v) => scale(ratio(v("hematocrito"), v("globulos_rojos")), 10) },
  hcm: { needs: ["hemoglobina", "globulos_rojos"], label: "Hb × 10 / glóbulos rojos", compute: (v) => scale(ratio(v("hemoglobina"), v("globulos_rojos")), 10) },
  katz: {
    needs: ["vsg_1", "vsg_2"],
    label: "(VSG 1.ª h + VSG 2.ª h / 2) / 2",
    compute: (v) => {
      const first = v("vsg_1");
      const second = v("vsg_2");
      return first !== null && second !== null ? (first + second / 2) / 2 : null;
    },
  },
  vldl: { needs: ["trigliceridos"], label: "Triglicéridos / 5", compute: (v) => scale(v("trigliceridos"), 1 / 5) },
  ldl: {
    needs: ["colesterol_total", "hdl", "trigliceridos"],
    label: "Colesterol total − HDL − triglicéridos / 5 (Friedewald; no aplica con triglicéridos sobre 400)",
    compute: (v) => {
      const total = v("colesterol_total");
      const hdl = v("hdl");
      const tg = v("trigliceridos");
      if (total === null || hdl === null || tg === null || tg > 400) return null;
      return total - hdl - tg / 5;
    },
  },
  bilirrubina_indirecta: {
    needs: ["bilirrubina_total", "bilirrubina_directa"],
    label: "Bilirrubina total − directa",
    compute: (v) => difference(v("bilirrubina_total"), v("bilirrubina_directa")),
  },
  globulina: { needs: ["proteinas_totales", "albumina"], label: "Proteínas totales − albúmina", compute: (v) => difference(v("proteinas_totales"), v("albumina")) },
  relacion_ag: {
    needs: ["proteinas_totales", "albumina"],
    label: "Albúmina / globulina",
    compute: (v) => ratio(v("albumina"), difference(v("proteinas_totales"), v("albumina"))),
  },
  indice_ct_hdl: { needs: ["colesterol_total", "hdl"], label: "Colesterol total / HDL", compute: (v) => ratio(v("colesterol_total"), v("hdl")) },
  indice_ldl_hdl: {
    needs: ["colesterol_total", "hdl", "trigliceridos"],
    label: "LDL / HDL",
    compute: (v) => ratio(v("ldl") ?? FORMULAS.ldl.compute(v), v("hdl")),
  },
  pt_razon: { needs: ["pt_paciente", "pt_control"], label: "Tiempo paciente / tiempo control", compute: (v) => ratio(v("pt_paciente"), v("pt_control")) },
  pt_actividad: {
    needs: ["pt_control", "pt_paciente"],
    label: "(Control − 7,2) / (paciente − 7,2) × 100",
    compute: (v) => {
      const control = v("pt_control");
      const patient = v("pt_paciente");
      if (control === null || patient === null || patient <= 7.2) return null;
      return ((control - 7.2) / (patient - 7.2)) * 100;
    },
  },
  inr: {
    needs: ["pt_paciente", "pt_control", "isi"],
    label: "(Paciente / control) elevado al ISI",
    compute: (v) => {
      const r = ratio(v("pt_paciente"), v("pt_control"));
      const isi = v("isi");
      return r !== null && isi !== null ? r ** isi : null;
    },
  },
  psa_indice: { needs: ["psa_libre", "psa_total"], label: "PSA libre / PSA total × 100", compute: (v) => scale(ratio(v("psa_libre"), v("psa_total")), 100) },
  tibc: {
    needs: ["hierro", "hierro_insaturado"],
    label: "Hierro sérico + hierro insaturado",
    compute: (v) => {
      const iron = v("hierro");
      const unsaturated = v("hierro_insaturado");
      return iron !== null && unsaturated !== null ? iron + unsaturated : null;
    },
  },
  saturacion_transferrina: {
    needs: ["hierro", "hierro_insaturado"],
    label: "Hierro sérico / TIBC × 100",
    compute: (v) => {
      const iron = v("hierro");
      const unsaturated = v("hierro_insaturado");
      return iron !== null && unsaturated !== null ? scale(ratio(iron, iron + unsaturated), 100) : null;
    },
  },
};

function scale(value: number | null, factor: number) {
  return value === null ? null : value * factor;
}

function difference(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return Math.max(0, a - b);
}

/**
 * Fills in every computed row from the typed results. Rows whose formula
 * lacks a result are left empty. Answers new sections only when something
 * changed, so a React state update can skip a re-render.
 */
export function applyFormulas(sections: ReportSection[]): ReportSection[] {
  const typed = new Map<string, number | null>();
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.test && !row.derive) typed.set(row.test, parseResult(row.value));
    }
  }
  const computed = new Map<string, number | null>();
  const values: Values = (key) => (typed.has(key) ? (typed.get(key) ?? null) : (computed.get(key) ?? null));

  let changed = false;
  const next = sections.map((section) => {
    let sectionChanged = false;
    const rows = section.rows.map((row) => {
      if (!row.derive) return row;
      const result = FORMULAS[row.derive].compute(values);
      if (row.test) computed.set(row.test, result);
      const value = result === null || !Number.isFinite(result) ? "" : formatNumber(result, row.decimals ?? 1);
      if (value === row.value) return row;
      sectionChanged = true;
      return { ...row, value };
    });
    if (!sectionChanged) return section;
    changed = true;
    return { ...section, rows };
  });
  return changed ? next : sections;
}

/**
 * The clinic's estimate of hemoglobin from the hematocrit (Hto × 0,315 + 0,2),
 * offered as a suggestion when only the hematocrit was measured.
 */
export function estimateHemoglobin(hematocrit: string) {
  const value = parseResult(hematocrit);
  return value === null ? null : formatNumber(value * 0.315 + 0.2, 1);
}
