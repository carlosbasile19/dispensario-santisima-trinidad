"use client";

import { useId, type CSSProperties } from "react";

import { Icon } from "@/components/crm/icons";
import { inputClass } from "@/components/crm/styles";
import { CATEGORIES, CATEGORY, PANEL, TESTS } from "@/lib/lab/catalog";
import { currentValue, implausible, missingFromPanels, type Dictation, type DictatedResult } from "@/lib/lab/dictation";
import { tidyNumber } from "@/lib/lab/numbers";
import { flagFor, rangeBar, referenceLines, type PatientFacts } from "@/lib/lab/reference";
import { PATIENT_TYPE_LABEL, customRow, rowFromTest } from "@/lib/lab/report";
import { PATIENT_TYPES, type CategoryKey, type PatientType, type ReportRow, type ReportSection } from "@/lib/lab/types";
import { FlagBadge } from "../section-editor";

// The review of a dictation: every result Claude found, grouped by exam as
// the report prints them, each with what was heard, its reference and flag
// for this patient, and a field to correct it. Results arrive one by one while
// Claude writes (read only), then become editable. Values that need a second
// look are marked, as are tests that replace a value already on the report.

export type Review = {
  /** The answer as it is being corrected. */
  draft: Dictation;
  /** Values as Claude gave them, to tell a corrected one. */
  original: Record<string, string>;
  skipped: Record<string, boolean>;
  /** Marked values the member looked at and kept. */
  confirmed: Record<string, boolean>;
};

export const startReview = (dictation: Dictation): Review => ({
  draft: dictation,
  original: Object.fromEntries(dictation.results.map((r) => [r.id, r.value])),
  skipped: {},
  confirmed: {},
});

/** What a result's row looks like on this report: the report's own row when it has the test. */
function baseRow(sections: ReportSection[], result: DictatedResult): ReportRow {
  for (const section of sections) {
    const row = section.rows.find((r) => (result.test ? r.test === result.test : !r.test && r.label.trim().toLowerCase() === result.label.toLowerCase()));
    if (row) return row;
  }
  const def = result.test ? TESTS[result.test] : null;
  return def ? rowFromTest(def) : { ...customRow(result.label), unit: result.unit, kind: result.kind };
}

/** The doubt still standing on a result: the server's, or a corrected value's plausibility. */
export function openDoubt(review: Review, result: DictatedResult) {
  if (review.confirmed[result.id] || review.skipped[result.id]) return null;
  const edited = review.original[result.id] !== undefined && review.original[result.id] !== result.value;
  return edited ? implausible(result.test, result.value) : result.doubt;
}

export function ReviewTotals({ review, facts, sections }: { review: Review; facts: PatientFacts; sections: ReportSection[] }) {
  const kept = review.draft.results.filter((r) => !review.skipped[r.id]);
  const flagged = kept.filter((r) => flagFor({ ...baseRow(sections, r), value: r.value, kind: r.kind, flag: null }, facts)).length;
  const doubts = kept.filter((r) => openDoubt(review, r)).length;
  const stats: [string, number, string][] = [
    ["Resultados", kept.length, ""],
    ["Fuera de rango", flagged, flagged ? "text-[#b03a36]" : ""],
    ["Por revisar", doubts, doubts ? "text-[#7a5300]" : ""],
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {stats.map(([label, value, tone]) => (
        <div key={label} className={`rounded-xl px-2 py-2.5 ${label === "Por revisar" && value ? "bg-[#fff8e6]" : label === "Fuera de rango" && value ? "bg-coral/10" : "bg-cream"}`}>
          <dt className="text-[11px] text-muted sm:text-[12px]">{label}</dt>
          <dd key={value} className={`dictation-count font-serif text-[24px] leading-tight ${tone}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewList({
  results,
  review,
  facts,
  sections,
  onChange,
}: {
  /** While Claude writes: the results so far, read only. */
  results: DictatedResult[];
  review: Review | null;
  facts: PatientFacts;
  sections: ReportSection[];
  onChange: (next: Review) => void;
}) {
  const list = review ? review.draft.results : results;
  const sectionNotes = review?.draft.sectionNotes ?? [];
  // As the report will print it: the section's own title, or the one a named panel gives it ("Hematología completa").
  const titleOf = (category: CategoryKey) =>
    sections.find((s) => s.category === category)?.title ??
    review?.draft.panels.map((key) => PANEL[key]).find((panel) => panel?.category === category && panel.sectionTitle)?.sectionTitle ??
    CATEGORY[category].title;
  const missing = review ? missingFromPanels(sections, review.draft) : [];
  const groups = CATEGORIES.map((c) => ({
    category: c.key,
    items: list.filter((r) => r.category === c.key),
    note: sectionNotes.find((n) => n.category === c.key) ?? null,
  })).filter((g) => g.items.length || g.note);

  const setResult = (id: string, value: string) =>
    review && onChange({ ...review, draft: { ...review.draft, results: review.draft.results.map((r) => (r.id === id ? { ...r, value } : r)) } });
  const setNote = (category: CategoryKey, note: string) =>
    review &&
    onChange({ ...review, draft: { ...review.draft, sectionNotes: review.draft.sectionNotes.map((n) => (n.category === category ? { ...n, note } : n)) } });

  const order = new Map(list.map((result, i) => [result.id, i]));
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.category} className="dictation-rise overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-baseline justify-between gap-3 border-b border-line bg-cream/60 px-4 py-2.5">
            <p className="min-w-0 truncate">
              <span className="mr-2 hidden text-[11px] tracking-[0.12em] text-teal uppercase sm:inline">{CATEGORY[group.category].short}</span>
              <span className="font-serif text-[17px] text-navy">{titleOf(group.category)}</span>
            </p>
            <span className="shrink-0 text-[12px] text-muted">
              {group.items.length} {group.items.length === 1 ? "resultado" : "resultados"}
            </span>
          </header>
          <ul className="divide-y divide-line">
            {group.items.map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                order={review ? (order.get(result.id) ?? 0) : 0}
                base={baseRow(sections, result)}
                before={currentValue(sections, result)}
                facts={facts}
                review={review}
                onValue={(value) => setResult(result.id, value)}
                onSkip={(skip) => review && onChange({ ...review, skipped: { ...review.skipped, [result.id]: skip } })}
                onConfirm={() => review && onChange({ ...review, confirmed: { ...review.confirmed, [result.id]: true } })}
              />
            ))}
          </ul>
          {missing
            .filter((m) => m.category === group.category)
            .map((m) => (
              <p key={m.panel} className="flex gap-2 border-t border-line px-4 py-2.5 text-[12px] text-muted">
                <Icon name="note" className="mt-px size-4 shrink-0 text-stone" />
                <span>
                  Sin dictar de {m.panel}: {m.tests.join(", ")}. Quedan vacías en el informe para llenarlas o quitarlas.
                </span>
              </p>
            ))}
          {group.note && review && (
            <label className="flex flex-col gap-1 border-t border-line px-4 py-3 text-[12px] text-muted">
              Observación de la sección
              <textarea
                value={group.note.note}
                rows={2}
                maxLength={800}
                onChange={(e) => setNote(group.category, e.target.value)}
                className={`${inputClass} h-auto py-1.5 text-[13px]`}
              />
            </label>
          )}
        </section>
      ))}
    </div>
  );
}

function ResultRow({
  result,
  order,
  base,
  before,
  facts,
  review,
  onValue,
  onSkip,
  onConfirm,
}: {
  result: DictatedResult;
  order: number;
  base: ReportRow;
  before: { value: string; derived: boolean } | null;
  facts: PatientFacts;
  review: Review | null;
  onValue: (value: string) => void;
  onSkip: (skip: boolean) => void;
  onConfirm: () => void;
}) {
  const listId = useId();
  const editable = review !== null;
  const skipped = Boolean(review?.skipped[result.id]);
  const row = { ...base, value: result.value, kind: result.kind, flag: null };
  const flag = flagFor(row, facts);
  const shown = flag ?? (referenceLines(row, facts).length || row.normal.length ? "N" : null);
  const bar = rangeBar(row, facts);
  const reference = referenceLines(row, facts)[0];
  const doubt = review ? openDoubt(review, result) : result.doubt;
  const options = result.test ? (TESTS[result.test]?.options ?? []) : [];
  const replaces = before && before.value.trim() && before.value !== result.value ? before.value : null;
  const isNew = !before;

  return (
    <li
      className={`dictation-card relative px-4 py-3 transition-[background-color,opacity] ${skipped ? "opacity-55" : ""} ${doubt ? "bg-[#fffbf0]" : ""}`}
      style={{ "--order": Math.min(order, 14) } as CSSProperties}
    >
      {doubt && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-[#e0a526]" />}
      <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[20px_minmax(0,1fr)_auto]">
        <input
          type="checkbox"
          checked={!skipped}
          disabled={!editable}
          onChange={(e) => onSkip(!e.target.checked)}
          aria-label={`Incluir ${result.label}`}
          className="mt-1 size-4 accent-[#1e7e86]"
        />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`text-[14px] leading-snug font-medium text-navy ${skipped ? "line-through" : ""}`}>{result.label}</span>
            {isNew && <span className="rounded-full bg-frost px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-navy uppercase">Nueva</span>}
            {replaces && (
              <span className="text-[11px] text-stone">
                Antes: <span className="font-mono line-through">{replaces}</span>
              </span>
            )}
          </p>
          {result.heard && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone italic">«{result.heard}»</p>}
        </div>
        <div className="col-start-2 flex items-center gap-2 sm:col-start-3 sm:justify-end">
          <div className={`relative max-w-full ${result.kind === "number" ? "w-[136px]" : "w-[200px]"}`}>
            <input
              value={result.value}
              readOnly={!editable}
              disabled={skipped}
              list={options.length ? listId : undefined}
              inputMode={result.kind === "number" ? "decimal" : undefined}
              aria-label={`Resultado de ${result.label}`}
              onChange={(e) => onValue(e.target.value)}
              onBlur={(e) => {
                if (result.kind !== "number") return;
                const tidy = tidyNumber(e.target.value);
                if (tidy !== e.target.value) onValue(tidy);
              }}
              className={`${inputClass} h-9 font-mono text-[14px] tabular-nums ${flag ? "border-coral/60 text-[#b03a36]" : ""} ${editable ? "" : "border-dashed bg-cream/50"}`}
            />
            {options.length > 0 && (
              <datalist id={listId}>
                {options.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
          <span className="w-12 shrink-0 truncate text-[12px] text-muted">{result.unit}</span>
          <span className="w-[76px] shrink-0">
            <FlagBadge flag={shown} />
          </span>
        </div>
      </div>

      {bar && !skipped && (
        <div className="mt-2 flex items-center gap-3 pl-8">
          <span className="relative block h-1.5 min-w-0 flex-1 rounded-full bg-sand" aria-hidden="true">
            <span className="absolute inset-y-0 rounded-full bg-mint/70" style={{ left: `${bar.start * 100}%`, width: `${(bar.end - bar.start) * 100}%` }} />
            <span
              className={`range-marker absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(27,42,85,0.35)] ${flag ? "bg-[#b03a36]" : "bg-teal"}`}
              style={{ "--pos": `${bar.value * 100}%` } as CSSProperties}
            />
          </span>
          {reference && <span className="max-w-[45%] shrink-0 truncate text-[11px] text-muted">Ref. {reference}</span>}
        </div>
      )}
      {!bar && reference && !skipped && <p className="mt-1 pl-8 text-[11px] text-muted">Ref. {reference}</p>}

      {doubt && (
        <div className="mt-2 ml-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#fff3d6] px-3 py-2 text-[12px] text-[#7a5300]">
          <Icon name="alert" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{doubt}</span>
          {editable && (
            <button type="button" onClick={onConfirm} className="shrink-0 font-semibold underline-offset-2 hover:underline">
              Está bien así
            </button>
          )}
        </div>
      )}
      {before?.derived && !skipped && <p className="mt-1 pl-8 text-[11px] text-stone">El informe lo calcula; se usará el valor dictado.</p>}
    </li>
  );
}

/** The sample's details and the observations the speaker gave, editable. */
export function ReviewDetails({ review, onChange }: { review: Review; onChange: (next: Review) => void }) {
  const d = review.draft;
  const set = (patch: Partial<Dictation>) => onChange({ ...review, draft: { ...d, ...patch } });
  const hasDetails = d.requestedBy || d.patientType || d.sampledDay || d.sampledTime;
  if (!hasDetails && !d.notes && !d.unclear.length) return null;
  return (
    <div className="dictation-rise flex flex-col gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
      {hasDetails && (
        <div className="grid gap-3 sm:grid-cols-2">
          {d.requestedBy && (
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Médico solicitante
              <input value={d.requestedBy} maxLength={120} onChange={(e) => set({ requestedBy: e.target.value })} className={`${inputClass} h-9`} />
            </label>
          )}
          {d.patientType && (
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Tipo de paciente
              <select value={d.patientType} onChange={(e) => set({ patientType: e.target.value as PatientType })} className={`${inputClass} h-9`}>
                {PATIENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PATIENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(d.sampledDay || d.sampledTime) && (
            <div className="flex gap-3 sm:col-span-2">
              {d.sampledDay && (
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted">
                  Fecha de la muestra
                  <input type="date" value={d.sampledDay} onChange={(e) => set({ sampledDay: e.target.value || null })} className={`${inputClass} h-9`} />
                </label>
              )}
              {d.sampledTime && (
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted">
                  Hora
                  <input type="time" value={d.sampledTime} onChange={(e) => set({ sampledTime: e.target.value || null })} className={`${inputClass} h-9`} />
                </label>
              )}
            </div>
          )}
        </div>
      )}
      {d.notes && (
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Observaciones generales (se agregan al final del informe)
          <textarea value={d.notes} rows={2} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} className={`${inputClass} h-auto py-1.5 text-[13px]`} />
        </label>
      )}
      {d.unclear.length > 0 && (
        <div className="rounded-lg bg-cream px-3 py-2.5 text-[12px] text-muted">
          <p className="font-medium text-navy">No se pudo ubicar en el informe</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {d.unclear.map((phrase) => (
              <li key={phrase} className="italic">
                «{phrase}»
              </li>
            ))}
          </ul>
          <p className="mt-1">Si hacen falta, agrégalos a mano en el informe.</p>
        </div>
      )}
    </div>
  );
}
