"use client";

import { useState } from "react";

import { Icon } from "@/components/crm/icons";
import { inputClass } from "@/components/crm/styles";
import { CATEGORY, DIFFERENTIAL_TESTS, TESTS } from "@/lib/lab/catalog";
import { FORMULAS, estimateHemoglobin } from "@/lib/lab/formulas";
import { formatNumber, parseResult } from "@/lib/lab/numbers";
import { FLAG_INFO, autoFlag, flagFor, referenceLines, type PatientFacts } from "@/lib/lab/reference";
import { customRow, groupRows, rowFromTest } from "@/lib/lab/report";
import type { Flag, FlagOverride, ReportRow, ReportSection, ResultKind } from "@/lib/lab/types";
import { PopoverMenu } from "./popover-menu";
import { ResultInput } from "./result-input";

// One section of the results editor (Hematología, Orina…): its title, a grid
// of rows (test · result · unit · reference · flag) and its observations.

const GRID = "sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)_56px_minmax(0,1fr)_84px_32px]";

export const FLAG_TONE: Record<Flag | "N", string> = {
  H: "bg-coral/10 text-[#b03a36]",
  L: "bg-coral/10 text-[#b03a36]",
  A: "bg-coral/10 text-[#b03a36]",
  N: "bg-mint/25 text-[#135c62]",
};

export function FlagBadge({ flag, manual = false }: { flag: Flag | "N" | null; manual?: boolean }) {
  if (!flag) return <span className="text-[12px] text-stone">—</span>;
  const text = flag === "N" ? "Normal" : FLAG_INFO[flag].label;
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap ${FLAG_TONE[flag]}`}>
      {flag !== "N" && <span aria-hidden="true">{FLAG_INFO[flag].arrow}</span>}
      {text}
      {manual && <span className="font-normal opacity-70">· manual</span>}
    </span>
  );
}

type Values = Map<string, string>;

export function SectionEditor({
  section,
  facts,
  values,
  onChange,
  onRemove,
  onAddTests,
  highlight,
  flashed,
}: {
  section: ReportSection;
  facts: PatientFacts;
  /** Every result of the report by test, for suggestions across sections. */
  values: Values;
  onChange: (section: ReportSection) => void;
  onRemove: () => void;
  onAddTests: () => void;
  highlight?: string | null;
  /** Rows a dictation just filled. */
  flashed?: ReadonlySet<string>;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(section.note));
  const filled = section.rows.filter((r) => r.value.trim()).length;
  const updateRow = (id: string, patch: Partial<ReportRow>) =>
    onChange({ ...section, rows: section.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) });
  const removeRow = (id: string) => onChange({ ...section, rows: section.rows.filter((row) => row.id !== id) });
  const addCustom = () => onChange({ ...section, rows: [...section.rows, { ...customRow(), group: section.rows.at(-1)?.group ?? "" }] });

  // The leukocyte formula should add up to 100 %, as the clinic's sheet checked.
  const differential = section.rows.filter((r) => r.test && (DIFFERENTIAL_TESTS as readonly string[]).includes(r.test));
  const typed = differential.map((r) => parseResult(r.value)).filter((v): v is number => v !== null);
  const sum = typed.reduce((a, b) => a + b, 0);
  const differentialOff = differential.length >= 3 && typed.length === differential.length && Math.abs(sum - 100) > 0.5;

  return (
    <section id={`section-${section.id}`} className="scroll-mt-24 rounded-xl border border-line bg-white">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.12em] text-teal uppercase">{CATEGORY[section.category].short}</p>
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value.slice(0, 80) })}
            onBlur={(e) => !e.target.value.trim() && onChange({ ...section, title: CATEGORY[section.category].title })}
            aria-label="Título de la sección"
            className="-ml-1 w-full rounded-md border border-transparent bg-transparent px-1 font-serif text-[20px] leading-tight text-navy outline-none hover:border-line focus:border-navy"
          />
        </div>
        <span className="hidden text-[12px] text-muted sm:inline">
          {filled} de {section.rows.length}
        </span>
        <PopoverMenu
          label={`Opciones de ${section.title}`}
          className="grid size-9 place-items-center rounded-lg text-stone hover:bg-sand hover:text-navy"
          trigger={<Icon name="more" className="size-5" />}
          items={[
            { label: "Agregar pruebas del catálogo", icon: "plus", onSelect: onAddTests },
            { label: "Agregar una prueba a mano", icon: "pen", onSelect: addCustom },
            { label: noteOpen ? "Ocultar observación" : "Escribir una observación", icon: "note", onSelect: () => setNoteOpen((o) => !o) },
            "separator",
            { label: "Quitar la sección", icon: "trash", tone: "danger", onSelect: onRemove },
          ]}
        />
      </header>

      <div className={`hidden gap-3 border-b border-line px-5 py-2 text-[11px] font-medium tracking-[0.06em] text-stone uppercase sm:grid ${GRID}`}>
        <span>Prueba</span>
        <span>Resultado</span>
        <span>Unidad</span>
        <span>Referencia</span>
        <span>Estado</span>
        <span className="sr-only">Opciones</span>
      </div>

      {groupRows(section.rows).map((group, index) => (
        <div key={`${group.title}-${index}`}>
          {group.title && (
            <p className="flex items-center gap-2 bg-cream/70 px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.1em] text-[#135c62] uppercase sm:px-5">
              <span className="size-1.5 rounded-full bg-teal" />
              {group.title}
            </p>
          )}
          <ul className="divide-y divide-line">
            {group.rows.map((row) => (
              <RowEditor
                key={row.id}
                row={row}
                facts={facts}
                values={values}
                highlight={highlight === row.id}
                flash={flashed?.has(row.id) ?? false}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
              />
            ))}
          </ul>
        </div>
      ))}

      {differentialOff && (
        <p className="flex items-center gap-2 border-t border-line bg-[#fff8e6] px-5 py-2.5 text-[13px] text-[#7a5300]">
          <Icon name="alert" className="size-4 shrink-0" />
          La fórmula leucocitaria suma {formatNumber(sum)} %. Revisa los porcentajes.
        </p>
      )}

      {section.rows.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">Esta sección no tiene pruebas todavía.</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 sm:px-5">
        <button type="button" onClick={onAddTests} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-navy">
          <Icon name="plus" className="size-4" />
          Agregar pruebas
        </button>
        <button type="button" onClick={addCustom} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-navy">
          <Icon name="pen" className="size-4" />
          Prueba a mano
        </button>
        {!noteOpen && (
          <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-navy">
            <Icon name="note" className="size-4" />
            Observación
          </button>
        )}
      </div>
      {noteOpen && (
        <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5">
          <label className="flex flex-col gap-1.5 text-[13px] text-muted">
            Observación de la sección (sale impresa debajo de los resultados)
            <textarea
              value={section.note}
              maxLength={800}
              rows={2}
              onChange={(e) => onChange({ ...section, note: e.target.value })}
              placeholder="Ej.: Se observa leve anisocitosis."
              className={`${inputClass} h-auto py-2`}
            />
          </label>
        </div>
      )}
    </section>
  );
}

const FLAG_CHOICES: { value: FlagOverride | null; label: string }[] = [
  { value: null, label: "Automático (según la referencia)" },
  { value: "N", label: "Normal" },
  { value: "H", label: "Alto" },
  { value: "L", label: "Bajo" },
  { value: "A", label: "Anormal" },
];

const KIND_LABEL: Record<ResultKind, string> = { number: "Número", option: "Respuesta", text: "Texto" };

function RowEditor({
  row,
  facts,
  values,
  highlight,
  flash,
  onChange,
  onRemove,
}: {
  row: ReportRow;
  facts: PatientFacts;
  values: Values;
  highlight: boolean;
  flash: boolean;
  onChange: (patch: Partial<ReportRow>) => void;
  onRemove: () => void;
}) {
  const [editingRef, setEditingRef] = useState(false);
  const test = row.test ? TESTS[row.test] : null;
  const flag = flagFor(row, facts);
  const auto = autoFlag(row, facts);
  const reference = referenceLines(row, facts);
  const hasReference = reference.length > 0 || row.normal.length > 0;
  const shown: Flag | "N" | null = flag ?? (row.value.trim() && hasReference ? "N" : null);
  const options = test?.options ?? [];
  const label = row.label || "Prueba";

  // Hints under the field.
  const number = parseResult(row.value);
  const plausible = test?.plausible;
  const implausible = row.kind === "number" && number !== null && plausible && (number < plausible[0] || number > plausible[1]);
  const formula = row.derive ? FORMULAS[row.derive] : null;
  const missing = formula && !row.value ? formula.needs.filter((key) => !parseResult(values.get(key) ?? "")) : [];
  const suggestion = suggest(row, values);

  return (
    <li
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 py-2.5 pr-12 pl-4 transition-colors sm:items-center sm:gap-y-2 sm:px-5 ${GRID} ${flag ? "bg-coral/[0.035]" : ""} ${
        highlight ? "bg-[#fff8e6]" : ""
      } ${flash ? "row-flash" : ""}`}
    >
      {/* Test */}
      <div className="col-span-2 min-w-0 sm:col-span-1">
        {row.test ? (
          <p className="text-[14px] leading-snug text-navy">{row.label}</p>
        ) : (
          <input
            value={row.label}
            onChange={(e) => onChange({ label: e.target.value.slice(0, 120) })}
            placeholder="Nombre de la prueba"
            aria-label="Nombre de la prueba"
            className={`${inputClass} h-8 text-[13px]`}
          />
        )}
        {(row.method || row.note) && <p className="truncate text-[11px] text-stone italic">{row.method || row.note}</p>}
      </div>

      {/* Result */}
      <div className="min-w-0">
        {formula && row.derive ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-outline bg-cream/60 px-3">
            <Icon name="sigma" className="size-4 shrink-0 text-teal" />
            <span className={`min-w-0 flex-1 truncate font-mono text-[14px] tabular-nums ${flag ? "font-medium text-[#b03a36]" : "text-navy"}`} title={formula.label}>
              {row.value || "—"}
            </span>
            <button
              type="button"
              onClick={() => onChange({ derive: null })}
              className="shrink-0 text-[11px] font-medium text-stone hover:text-navy"
              title="Escribir otro valor"
            >
              Editar
            </button>
          </div>
        ) : (
          <ResultInput row={row} options={options} flagged={Boolean(flag)} label={`Resultado de ${label}`} onChange={(value) => onChange({ value })} />
        )}
        {implausible && plausible && (
          <p className="mt-1 text-[11px] leading-snug text-[#7a5300]">
            ¿Valor correcto? Lo esperable está entre {formatNumber(plausible[0])} y {formatNumber(plausible[1])}
            {row.unit ? ` ${row.unit}` : ""}.
          </p>
        )}
        {missing.length > 0 && (
          <p className="mt-1 text-[11px] leading-snug text-stone">Se calcula con {missing.map((key) => TESTS[key]?.label ?? key).join(", ")}.</p>
        )}
        {suggestion && (
          <button
            type="button"
            onClick={() => onChange({ value: suggestion.value })}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-mint/20 px-2 py-0.5 text-left text-[11px] text-[#135c62] hover:bg-mint/35"
          >
            <Icon name="sigma" className="size-3.5" />
            {suggestion.label}: <span className="font-semibold">{suggestion.value}</span> · usar
          </button>
        )}
      </div>

      {/* Unit */}
      <div className="hidden text-[12px] text-muted sm:block">
        {row.test ? (
          row.unit || "—"
        ) : (
          <input
            value={row.unit}
            onChange={(e) => onChange({ unit: e.target.value.slice(0, 30) })}
            placeholder="Unidad"
            aria-label="Unidad"
            className={`${inputClass} h-8 px-2 text-[12px]`}
          />
        )}
      </div>

      {/* Reference */}
      <div className="min-w-0 text-[12px] leading-snug text-ink max-sm:order-last max-sm:col-span-2">
        {editingRef ? (
          <div className="flex flex-col gap-1">
            <textarea
              autoFocus
              value={row.refText}
              rows={2}
              maxLength={600}
              onChange={(e) => onChange({ refText: e.target.value, rules: [] })}
              placeholder="Ej.: 70 – 110"
              aria-label="Valor de referencia"
              className={`${inputClass} h-auto px-2 py-1 text-[12px]`}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditingRef(false)} className="text-[11px] font-medium text-teal hover:text-navy">
                Listo
              </button>
              {test && (
                <button
                  type="button"
                  onClick={() => {
                    const fresh = rowFromTest(test);
                    onChange({ rules: fresh.rules, refText: fresh.refText });
                    setEditingRef(false);
                  }}
                  className="text-[11px] font-medium text-stone hover:text-navy"
                >
                  Usar la del catálogo
                </button>
              )}
            </div>
          </div>
        ) : reference.length ? (
          <button type="button" onClick={() => setEditingRef(true)} className="text-left hover:text-navy" title="Editar la referencia de este informe">
            {reference.slice(0, 3).map((line, i) => (
              <span key={i} className="block">
                <span className="text-stone sm:hidden">Ref. </span>
                {line}
              </span>
            ))}
            {reference.length > 3 && <span className="block text-stone">+{reference.length - 3} líneas</span>}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditingRef(true)}
            title="Agregar un valor de referencia"
            className="text-stone hover:text-navy max-sm:hidden"
          >
            {row.normal.length ? `Normal: ${row.normal.join(" / ")}` : "—"}
          </button>
        )}
      </div>

      {/* Flag */}
      <div className="flex h-9 items-center sm:block sm:h-auto">
        <PopoverMenu
          label={`Estado de ${label}`}
          className="rounded-full"
          trigger={<FlagBadge flag={shown} manual={row.flag !== null} />}
          items={FLAG_CHOICES.map((choice) => ({
            label: choice.label,
            checked: row.flag === choice.value,
            hint: choice.value === null && auto ? `Ahora: ${FLAG_INFO[auto].label.toLowerCase()}` : undefined,
            onSelect: () => onChange({ flag: choice.value }),
          }))}
        />
      </div>

      {/* Row menu */}
      <div className="absolute right-3 sm:static">
        <PopoverMenu
          label={`Opciones de ${label}`}
          className="grid size-8 place-items-center rounded-lg text-stone hover:bg-sand hover:text-navy"
          trigger={<Icon name="more" className="size-4" />}
          items={[
            { label: "Editar la referencia", icon: "pen", onSelect: () => setEditingRef(true) },
            ...(test?.derive && !row.derive ? [{ label: "Volver a calcularla", icon: "sigma" as const, onSelect: () => onChange({ derive: test.derive ?? null }) }] : []),
            ...(row.derive ? [{ label: "Escribir otro valor", icon: "unlock" as const, onSelect: () => onChange({ derive: null }) }] : []),
            ...(!row.test
              ? (["number", "option", "text"] as ResultKind[]).map((kind) => ({
                  label: `Tipo: ${KIND_LABEL[kind].toLowerCase()}`,
                  checked: row.kind === kind,
                  onSelect: () => onChange({ kind }),
                }))
              : []),
            "separator" as const,
            { label: "Quitar la prueba", icon: "trash", tone: "danger" as const, onSelect: onRemove },
          ]}
        />
      </div>
    </li>
  );
}

/** A value the editor can compute for an empty or typed row: Hb from Hto (the clinic's estimate), VCM and HCM from the red cell count. */
function suggest(row: ReportRow, values: Values): { label: string; value: string } | null {
  if (row.derive) return null;
  const hto = values.get("hematocrito") ?? "";
  const hb = values.get("hemoglobina") ?? "";
  const gr = values.get("globulos_rojos") ?? "";
  if (row.test === "hemoglobina" && !row.value.trim() && parseResult(hto) !== null) {
    const estimate = estimateHemoglobin(hto);
    return estimate ? { label: "Estimada con el Hto", value: estimate } : null;
  }
  if ((row.test === "vcm" || row.test === "hcm") && parseResult(gr) !== null) {
    const formula = FORMULAS[row.test];
    const result = formula.compute((key) => parseResult(key === "hematocrito" ? hto : key === "hemoglobina" ? hb : key === "globulos_rojos" ? gr : ""));
    if (result === null || !Number.isFinite(result)) return null;
    const value = formatNumber(result, 1);
    return value === row.value ? null : { label: "Con los glóbulos rojos", value };
  }
  return null;
}
