"use client";

import { useRouter } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { deleteLabReport, saveLabReport, validateLabReport } from "@/app/dashboard/laboratorio/actions";
import { DatePicker } from "@/components/crm/date-picker";
import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Icon, type IconName } from "@/components/crm/icons";
import { Select } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { Avatar, Badge, RowsSkeleton } from "@/components/crm/ui";
import { CATEGORY, FEATURED_PANELS, PANEL } from "@/lib/lab/catalog";
import { documentOf, fullName, sexLabel, stampTime } from "@/lib/lab/format";
import { applyFormulas } from "@/lib/lab/formulas";
import { FLAG_INFO, formatAge, patientFacts } from "@/lib/lab/reference";
import { applyDictation, type Dictation } from "@/lib/lab/dictation";
import { PATIENT_TYPE_LABEL, addPanel, addTest, reportNumber, tally, testsIn } from "@/lib/lab/report";
import { panelSize } from "@/lib/lab/search";
import { PATIENT_TYPES, type AutoSend, type CategoryKey, type PatientType, type ReportContent, type ReportPatient, type ReportSigner } from "@/lib/lab/types";
import type { BoletaReport } from "./boleta";
import type { CatalogChoice } from "./catalog-picker";
import { Dialog } from "./dialog";
import type { DictationStatus } from "./dictation/dictation-dialog";
import { VoiceOrb } from "./dictation/voice-orb";
import { DesktopReportPreview, ReportPreview } from "./report-preview";
import { FlagBadge, SectionEditor } from "./section-editor";

const CatalogPicker = lazy(() => import("./catalog-picker").then((module) => ({ default: module.CatalogPicker })));
const DictationDialog = lazy(() => import("./dictation/dictation-dialog").then((module) => ({ default: module.DictationDialog })));

// The report builder: the sample's details, a card per exam with its results
// grid, and the live preview. Results are typed, or dictated ("Dictar": Claude
// sorts what was said and the member reviews it before it enters the report).
// Changes save themselves a moment after typing stops ("Guardado"); if
// someone else saved meanwhile, nothing is overwritten. "Revisar y validar"
// shows what will be signed, then locks it.

type SaveState = { kind: "saved"; at: string } | { kind: "saving" } | { kind: "dirty" } | { kind: "error"; message: string; conflict?: boolean };

export type EditorProps = {
  id: string;
  number: number;
  revision: number;
  updatedAt: string;
  patient: ReportPatient & { id: string };
  content: ReportContent;
  signer: ReportSigner | null;
  /** Panels the visit's services point at. */
  suggested: string[];
  /** The visit the sample was taken in. */
  visit: string | null;
  reopenReason: string | null;
  canDiscard: boolean;
  /** Whether validating also sends the PDF by WhatsApp, and where, or why not. */
  autoSend: AutoSend;
  /** The server can sort dictations (Claude's key is set). */
  dictation: boolean;
};

export function ReportEditor(props: EditorProps) {
  const router = useRouter();
  const [content, setContent] = useState<ReportContent>(props.content);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: props.updatedAt });
  const [picker, setPicker] = useState<{ open: boolean; category: CategoryKey | "all" }>({ open: false, category: "all" });
  const [validating, setValidating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  /** Mounted on the first "Dictar", then kept: a dictation in progress survives closing the dialog. */
  const [dictationUsed, setDictationUsed] = useState(false);
  const [dictationStatus, setDictationStatus] = useState<DictationStatus>("idle");
  /** Rows the last dictation filled, glowing for a moment. */
  const [flashed, setFlashed] = useState<ReadonlySet<string>>(new Set());
  const [applied, setApplied] = useState<{ count: number; key: number } | null>(null);
  /** The version last saved, for the PDF preview's address. */
  const [savedAt, setSavedAt] = useState(props.updatedAt);

  const version = useRef(props.updatedAt);
  const dirty = useRef(false);
  const inflight = useRef<Promise<boolean> | null>(null);
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  }, [content]);

  const facts = useMemo(() => patientFacts(props.patient, content.sampledDay), [props.patient, content.sampledDay]);
  const counts = useMemo(() => tally(content.sections, facts), [content.sections, facts]);
  const present = useMemo(() => testsIn(content.sections), [content.sections]);
  const values = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of content.sections) for (const row of section.rows) if (row.test) map.set(row.test, row.value);
    return map;
  }, [content.sections]);
  const total = counts.results + counts.empty;

  const update = useCallback((change: (current: ReportContent) => ReportContent) => {
    dirty.current = true;
    setSave((s) => (s.kind === "error" && s.conflict ? s : { kind: "dirty" }));
    setContent((current) => {
      const next = change(current);
      return { ...next, sections: applyFormulas(next.sections) };
    });
  }, []);

  /** Saves what is pending; answers whether everything is saved. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setSave({ kind: "saving" });
    const run = saveLabReport(props.id, latest.current, version.current).then((result) => {
      if (result.ok) {
        version.current = result.updatedAt;
        setSavedAt(result.updatedAt);
        setSave(dirty.current ? { kind: "dirty" } : { kind: "saved", at: result.updatedAt });
        return true;
      }
      if (!result.conflict) dirty.current = true;
      setSave({ kind: "error", message: result.error, conflict: result.conflict });
      return false;
    });
    inflight.current = run.finally(() => {
      inflight.current = null;
    });
    return run;
  }, [props.id]);

  // Autosave a moment after the last change. After an error it waits for
  // the next change or "Reintentar" instead of retrying in a loop.
  useEffect(() => {
    if (!dirty.current || save.kind === "error") return;
    const timer = setTimeout(() => void flush(), 900);
    return () => clearTimeout(timer);
  }, [content, flush, save]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const addChoice = (choice: CatalogChoice) =>
    update((c) => {
      let sections = c.sections;
      for (const key of choice.panels) sections = addPanel(sections, PANEL[key]);
      for (const key of choice.tests) sections = addTest(sections, key);
      return { ...c, sections };
    });

  const removeSection = (id: string) => {
    const section = content.sections.find((s) => s.id === id);
    const filled = section?.rows.filter((r) => r.value.trim()).length ?? 0;
    if (filled && !window.confirm(`¿Quitar «${section?.title}» y sus ${filled} resultados?`)) return;
    update((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id) }));
  };

  const jumpTo = (sectionId: string, rowId: string) => {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight(rowId);
    setTimeout(() => setHighlight(null), 1800);
  };

  const openDictation = () => {
    setDictationUsed(true);
    setDictating(true);
  };

  const applyDictated = (dictated: Dictation, then: "stay" | "validate") => {
    const { content: next, touched } = applyDictation(content, dictated);
    update(() => next);
    setDictating(false);
    setFlashed(new Set(touched));
    setTimeout(() => setFlashed(new Set()), 2800);
    if (then === "validate") {
      setValidating(true);
      return;
    }
    setApplied({ count: dictated.results.length, key: Date.now() });
    const first = next.sections.find((section) => section.rows.some((row) => touched.includes(row.id)));
    if (first) requestAnimationFrame(() => document.getElementById(`section-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // The confirmation after applying a dictation fades on its own.
  useEffect(() => {
    if (!applied) return;
    const timer = setTimeout(() => setApplied(null), 9000);
    return () => clearTimeout(timer);
  }, [applied]);

  const name = fullName(props.patient);
  const number = reportNumber(props.number);
  const pdfUrl = `/dashboard/laboratorio/${props.id}/pdf?v=${encodeURIComponent(savedAt)}`;
  const boleta = useMemo<BoletaReport>(() => ({
    number: props.number,
    revision: props.revision,
    status: "draft" as const,
    patient: props.patient,
    facts,
    content,
    signer: props.signer,
    finalizedAt: null,
    printedAt: savedAt,
  }), [props.number, props.revision, props.patient, props.signer, facts, content, savedAt]);
  const identity = [documentOf(props.patient), formatAge(props.patient.birth_date, content.sampledDay), sexLabel(props.patient.sex)].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6 pb-28 xl:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden sm:block">
            <Avatar name={name} size="lg" />
          </span>
          <div className="min-w-0">
            <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] tracking-[0.14em] text-teal uppercase">
              Laboratorio · Informe Nº {number}
              <Badge tone="outline">Borrador{props.revision > 1 ? ` · revisión ${props.revision}` : ""}</Badge>
            </p>
            <h1 className="font-serif text-[clamp(28px,3vw,38px)] leading-[1.08] tracking-[-0.01em] text-balance">{name}</h1>
            <p className="mt-1 text-[14px] text-muted">{identity || "Sin cédula, edad ni sexo registrados: la referencia por sexo no se elige sola."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={save} onRetry={() => void flush()} />
          <DictateButton status={dictationStatus} onClick={openDictation} />
          {props.canDiscard && (
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-stone hover:text-[#b03a36]"
            >
              <Icon name="trash" className="size-4" />
              <span className="hidden sm:inline">Descartar</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setValidating(true)}
            disabled={!counts.results}
            className="hidden h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal disabled:opacity-50 sm:inline-flex"
          >
            <Icon name="shield" className="size-4" />
            Revisar y validar
          </button>
        </div>
      </header>

      <Stepper sections={content.sections.length} results={counts.results} total={total} />

      {props.reopenReason && (
        <p className="flex gap-3 rounded-xl bg-[#fff8e6] px-4 py-3 text-sm text-[#7a5300]">
          <Icon name="refresh" className="mt-0.5 size-4 shrink-0" />
          <span>
            Corrección del informe (revisión {props.revision}). Motivo: <span className="font-medium">{props.reopenReason}</span>. La versión anterior queda guardada.
          </span>
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SampleCard content={content} visit={props.visit} onChange={(patch) => update((c) => ({ ...c, ...patch }))} />

          {content.sections.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold">
                  Exámenes <span className="font-normal text-muted">· {content.sections.length}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setPicker({ open: true, category: "all" })}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline bg-white px-3 text-[13px] font-medium text-navy hover:border-navy"
                >
                  <Icon name="plus" className="size-4" />
                  Agregar exámenes
                </button>
              </div>
              {content.sections.map((section) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  facts={facts}
                  values={values}
                  highlight={highlight}
                  flashed={flashed}
                  onChange={(next) => update((c) => ({ ...c, sections: c.sections.map((s) => (s.id === next.id ? next : s)) }))}
                  onRemove={() => removeSection(section.id)}
                  onAddTests={() => setPicker({ open: true, category: section.category })}
                />
              ))}
            </>
          ) : (
            <EmptyExams
              suggested={props.suggested}
              onPanel={(key) => update((c) => ({ ...c, sections: addPanel(c.sections, PANEL[key]) }))}
              onCatalog={() => setPicker({ open: true, category: "all" })}
              onDictate={openDictation}
            />
          )}

          <section className="rounded-xl border border-line bg-white px-4 py-4 sm:px-5">
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
              <span className="text-[15px] font-semibold text-navy">Observaciones generales</span>
              Salen al final del informe, antes de la firma.
              <textarea
                value={content.notes}
                maxLength={2000}
                rows={2}
                onChange={(e) => {
                  const notes = e.target.value;
                  update((c) => ({ ...c, notes }));
                }}
                placeholder="Ej.: Muestra tomada en ayunas de 12 horas."
                className={`${inputClass} mt-1 h-auto py-2`}
              />
            </label>
          </section>
        </div>

        <aside className="hidden flex-col gap-4 xl:sticky xl:top-6 xl:flex">
          <Summary counts={counts} total={total} signer={props.signer} onJump={jumpTo} onValidate={() => setValidating(true)} />
          <section className="rounded-xl border border-line bg-white p-4">
            <DesktopReportPreview report={boleta} pdfUrl={pdfUrl} />
          </section>
        </aside>
      </div>

      {/* Phones and tablets: the progress and the next step stay at hand. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-[1000px] items-center gap-3">
          <p className="min-w-0 flex-1 text-[13px] leading-tight text-muted">
            <span className="font-medium text-navy">
              {counts.results} de {total}
            </span>{" "}
            resultados
            {counts.flagged.length > 0 && <span className="block text-[#b03a36]">{counts.flagged.length} fuera de rango</span>}
          </p>
          <button
            type="button"
            onClick={openDictation}
            aria-label="Dictar resultados"
            className="relative grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal to-navy text-white shadow-[0_6px_16px_-6px_rgba(30,126,134,0.8)]"
          >
            <Icon name="mic" className="size-[18px]" />
            {dictationStatus !== "idle" && <span className="dictate-live absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-coral" />}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy"
          >
            <Icon name="eye" className="size-4" />
            <span className="max-sm:sr-only">Vista previa</span>
          </button>
          <button
            type="button"
            onClick={() => setValidating(true)}
            disabled={!counts.results}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Validar
          </button>
        </div>
      </div>

      {picker.open && (
        <Suspense fallback={
          <Dialog open onClose={() => setPicker((p) => ({ ...p, open: false }))} title="Agregar exámenes" icon="flask" size="xl">
            <RowsSkeleton rows={4} />
          </Dialog>
        }>
          <CatalogPicker
            open
            initialCategory={picker.category}
            onClose={() => setPicker((p) => ({ ...p, open: false }))}
            onAdd={addChoice}
            present={present}
            suggested={props.suggested}
          />
        </Suspense>
      )}

      {dictationUsed && (
        <Suspense fallback={null}>
          <DictationDialog
            open={dictating}
            onClose={() => setDictating(false)}
            reportId={props.id}
            ready={props.dictation}
            patientName={name}
            facts={facts}
            sections={content.sections}
            onApply={applyDictated}
            onStatus={setDictationStatus}
          />
        </Suspense>
      )}

      {applied && (
        <div
          key={applied.key}
          role="status"
          className="dictation-toast fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-[520px] items-center gap-3 rounded-2xl border border-teal/30 bg-white px-4 py-3 shadow-[0_18px_44px_-18px_rgba(27,42,85,0.55)] xl:bottom-6"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal text-white">
            <Icon name="check" className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-navy">
            <span className="font-medium">
              {applied.count} {applied.count === 1 ? "resultado dictado" : "resultados dictados"} en el informe.
            </span>{" "}
            <span className="text-muted max-sm:hidden">Se guarda solo; valídalo cuando esté completo.</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setApplied(null);
              setValidating(true);
            }}
            disabled={!counts.results}
            className="shrink-0 rounded-lg bg-navy px-3 py-2 text-[13px] font-medium text-white hover:bg-teal disabled:opacity-50"
          >
            Validar
          </button>
          <button type="button" onClick={() => setApplied(null)} aria-label="Cerrar" className="grid size-8 shrink-0 place-items-center rounded-lg text-stone hover:bg-sand">
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Vista previa" icon="eye" size="xl">
        <ReportPreview report={boleta} pdfUrl={pdfUrl} compact />
      </Dialog>

      <ValidateDialog
        open={validating}
        onClose={() => setValidating(false)}
        counts={counts}
        content={content}
        signer={props.signer}
        number={number}
        revision={props.revision}
        autoSend={props.autoSend}
        onConfirm={async () => {
          if (inflight.current) await inflight.current;
          dirty.current = false;
          setSave({ kind: "saving" });
          const result = await validateLabReport(props.id, latest.current, version.current);
          if (!result.ok) {
            dirty.current = true;
            setSave({ kind: "error", message: result.error, conflict: result.conflict });
            return result.error;
          }
          // The delivered view greets the validation (and cleans the address again).
          router.replace(`/dashboard/laboratorio/${props.id}?validado=1`);
          return null;
        }}
      />

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="¿Descartar este borrador?"
        description="Se borra el informe y todo lo escrito en él. No se puede deshacer."
        icon="trash"
        tone="coral"
      >
        <ActionForm action={deleteLabReport} className="flex flex-col gap-4">
          <input type="hidden" name="report" value={props.id} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDiscardOpen(false)} className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy">
              Conservar
            </button>
            <SubmitButton variant="destructive" icon="trash" pendingLabel="Descartando…">
              Descartar borrador
            </SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.kind === "error") {
    return (
      <span role="alert" className="inline-flex max-w-[320px] items-center gap-2 text-[13px] text-[#b03a36]">
        <Icon name="alert" className="size-4 shrink-0" />
        <span className="min-w-0">{state.message}</span>
        {!state.conflict && (
          <button type="button" onClick={onRetry} className="font-medium underline">
            Reintentar
          </button>
        )}
      </span>
    );
  }
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      {state.kind === "saving" ? (
        <>
          <span className="size-2 animate-pulse rounded-full bg-teal" />
          Guardando…
        </>
      ) : state.kind === "dirty" ? (
        <>
          <span className="size-2 rounded-full bg-outline" />
          Cambios sin guardar
        </>
      ) : (
        <>
          <Icon name="check" className="size-4 text-teal" />
          Guardado · {stampTime(state.at)}
        </>
      )}
    </span>
  );
}

function Stepper({ sections, results, total }: { sections: number; results: number; total: number }) {
  const steps: { label: string; detail: string; done: boolean; icon: IconName }[] = [
    { label: "Paciente", detail: "Elegido", done: true, icon: "patients" },
    { label: "Exámenes", detail: sections ? `${sections} ${sections === 1 ? "sección" : "secciones"}` : "Por elegir", done: sections > 0, icon: "flask" },
    { label: "Resultados", detail: total ? `${results} de ${total}` : "—", done: total > 0 && results === total, icon: "pen" },
    { label: "Validar y entregar", detail: "Firma del bioanalista", done: false, icon: "shield" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((step, i) => {
        const active = i === current;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${active ? "border-navy bg-white shadow-[0_0_0_1px_var(--color-navy)]" : "border-line bg-white/60"}`}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                step.done ? "bg-teal text-white" : active ? "bg-navy text-white" : "bg-sand text-stone"
              }`}
            >
              {step.done ? <Icon name="check" className="size-4" /> : i + 1}
            </span>
            <span className="min-w-0 leading-tight">
              <span className={`block truncate text-[13px] font-medium ${step.done || active ? "text-navy" : "text-muted"}`}>{step.label}</span>
              <span className="block truncate text-[12px] text-muted">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SampleCard({ content, visit, onChange }: { content: ReportContent; visit: string | null; onChange: (patch: Partial<ReportContent>) => void }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold">Muestra</h2>
        {visit && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Icon name="calendar-check" className="size-4 text-teal" />
            {visit}
          </span>
        )}
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-[1.1fr_0.8fr_0.9fr_1.4fr]">
        <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
          Fecha de la muestra
          <DatePicker value={content.sampledDay} onValueChange={(day) => day && onChange({ sampledDay: day })} aria-label="Fecha de la muestra" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
          Hora
          <input
            type="time"
            value={content.sampledTime}
            onChange={(e) => e.target.value && onChange({ sampledTime: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
          Tipo de paciente
          <Select
            value={content.patientType}
            onValueChange={(value) => onChange({ patientType: value as PatientType })}
            searchable={false}
            aria-label="Tipo de paciente"
            options={PATIENT_TYPES.map((type) => ({ value: type, label: PATIENT_TYPE_LABEL[type] }))}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
          Médico solicitante (opcional)
          <input
            value={content.requestedBy}
            maxLength={120}
            onChange={(e) => onChange({ requestedBy: e.target.value })}
            placeholder="Dr. o Dra. que indicó los exámenes"
            className={inputClass}
          />
        </label>
      </div>
    </section>
  );
}

/** "Dictar" in the header: says when a dictation is under way or waiting for review. */
function DictateButton({ status, onClick }: { status: DictationStatus; onClick: () => void }) {
  const label = status === "listening" ? "Escuchando…" : status === "working" ? "Ordenando…" : status === "review" ? "Revisar dictado" : "Dictar";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group hidden h-10 items-center gap-2 rounded-lg bg-gradient-to-br from-teal to-navy pr-4 pl-1.5 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(30,126,134,0.9)] transition-[filter,box-shadow] hover:brightness-110 sm:inline-flex"
    >
      <span className="relative grid size-7 place-items-center rounded-full bg-white/15">
        <Icon name="mic" className="size-4" />
        {status !== "idle" && <span className="dictate-live absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#1e5f6e] bg-coral" />}
      </span>
      {label}
    </button>
  );
}

function EmptyExams({
  suggested,
  onPanel,
  onCatalog,
  onDictate,
}: {
  suggested: string[];
  onPanel: (key: string) => void;
  onCatalog: () => void;
  onDictate: () => void;
}) {
  const featured = [...suggested, ...FEATURED_PANELS.filter((key) => !suggested.includes(key))].slice(0, 9);
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <button
        type="button"
        onClick={onDictate}
        className="group flex w-full items-center gap-4 border-b border-line bg-gradient-to-br from-mint/25 via-white to-white px-4 py-5 text-left transition-colors hover:from-mint/35 sm:gap-5 sm:px-6"
      >
        <span className="shrink-0 transition-transform duration-500 group-hover:scale-105">
          <VoiceOrb state="idle" size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[21px] leading-tight text-navy">Dicta los resultados</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            Lee en voz alta las pruebas, los valores y las observaciones. Claude los ordena en cada examen y tú los revisas antes de que entren al informe.
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2.5 text-sm font-medium text-white group-hover:bg-teal sm:inline-flex">
          <Icon name="mic" className="size-4" />
          Empezar
        </span>
      </button>
      <div className="px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-full bg-mint/25 text-[#135c62]">
            <Icon name="flask" className="size-5" />
          </span>
          <h2 className="mt-3 font-serif text-[24px] leading-tight">O elige los exámenes y escribe</h2>
          <p className="mt-1 max-w-[52ch] text-sm text-muted">
            Toca un perfil para agregarlo con sus pruebas, sus unidades y los valores de referencia del laboratorio.
          </p>
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((key) => {
            const panel = PANEL[key];
            if (!panel) return null;
            const fromVisit = suggested.includes(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onPanel(key)}
                  className={`group flex h-full w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors hover:border-navy ${fromVisit ? "border-teal bg-mint/10" : "border-line bg-white"}`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-frost text-navy group-hover:bg-navy group-hover:text-white">
                    <Icon name="plus" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-navy">{panel.title}</span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {fromVisit ? "De la cita · " : ""}
                      {CATEGORY[panel.category].short} · {panelSize(panel)} pruebas
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onCatalog}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
          >
            <Icon name="search" className="size-4" />
            Buscar en todo el catálogo
          </button>
        </div>
      </div>
    </section>
  );
}

function Summary({
  counts,
  total,
  signer,
  onJump,
  onValidate,
}: {
  counts: ReturnType<typeof tally>;
  total: number;
  signer: ReportSigner | null;
  onJump: (sectionId: string, rowId: string) => void;
  onValidate: () => void;
}) {
  const progress = total ? Math.round((counts.results / total) * 100) : 0;
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="px-4 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Resumen</h2>
          <span className="text-[12px] text-muted">{progress} % cargado</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
          <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Resultados", counts.results, ""],
              ["Fuera de rango", counts.flagged.length, counts.flagged.length ? "text-[#b03a36]" : ""],
              ["Vacíos", counts.empty, ""],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded-lg bg-cream px-2 py-2">
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className={`font-serif text-[22px] leading-tight ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {counts.flagged.length > 0 && (
        <ul className="mt-3 max-h-[180px] divide-y divide-line overflow-y-auto border-t border-line">
          {counts.flagged.map(({ section, row, flag }) => (
            <li key={row.id}>
              <button type="button" onClick={() => onJump(section.id, row.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-cream">
                <span className="min-w-0 flex-1 truncate text-[13px] text-navy">{row.label}</span>
                <span className="font-mono text-[13px] text-[#b03a36]">{row.value}</span>
                <FlagBadge flag={flag} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onValidate}
          disabled={!counts.results}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal disabled:opacity-50"
        >
          <Icon name="shield" className="size-4" />
          Revisar y validar
        </button>
        <p className="mt-2 text-center text-[12px] text-muted">{signer ? `Firma: ${signer.name}` : "Falta configurar quién firma los informes."}</p>
      </div>
    </section>
  );
}

function ValidateDialog({
  open,
  onClose,
  counts,
  content,
  signer,
  number,
  revision,
  autoSend,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  counts: ReturnType<typeof tally>;
  content: ReportContent;
  signer: ReportSigner | null;
  number: string;
  revision: number;
  autoSend: AutoSend;
  onConfirm: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const emptyRows = content.sections.flatMap((s) => s.rows.filter((r) => !r.value.trim()).map((r) => r.label || "Prueba sin nombre"));

  return (
    <Dialog
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={`Validar el informe Nº ${number}`}
      description="Revisa lo que se va a firmar. Al validarlo queda listo para imprimir y enviar."
      icon="shield"
      tone="teal"
      size="lg"
      footer={
        <>
          {error && (
            <p role="alert" className="min-w-0 flex-1 text-sm text-[#b03a36]">
              {error}
            </p>
          )}
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy">
            Seguir editando
          </button>
          <button
            type="button"
            disabled={pending || !signer || !counts.results}
            onClick={() =>
              start(async () => {
                const problem = await onConfirm();
                setError(problem);
                if (!problem) onClose();
              })
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal disabled:opacity-60"
          >
            <Icon name="shield" className="size-4" />
            {pending ? (autoSend.will ? "Validando y enviando…" : "Validando…") : "Validar y firmar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-cream px-3 py-3">
            <dt className="text-[12px] text-muted">Resultados</dt>
            <dd className="font-serif text-[26px] leading-tight">{counts.results}</dd>
          </div>
          <div className={`rounded-xl px-3 py-3 ${counts.flagged.length ? "bg-coral/10" : "bg-cream"}`}>
            <dt className="text-[12px] text-muted">Fuera de rango</dt>
            <dd className={`font-serif text-[26px] leading-tight ${counts.flagged.length ? "text-[#b03a36]" : ""}`}>{counts.flagged.length}</dd>
          </div>
          <div className="rounded-xl bg-cream px-3 py-3">
            <dt className="text-[12px] text-muted">Sin resultado</dt>
            <dd className="font-serif text-[26px] leading-tight">{counts.empty}</dd>
          </div>
        </dl>

        {counts.flagged.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Fuera del rango de referencia</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {counts.flagged.map(({ row, flag }) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="font-mono text-[#b03a36]">
                    {row.value} {row.unit}
                  </span>
                  <span className="text-[12px] text-[#b03a36]">
                    {FLAG_INFO[flag].arrow} {FLAG_INFO[flag].label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {emptyRows.length > 0 && (
          <p className="rounded-xl bg-[#fff8e6] px-3 py-2.5 text-[13px] text-[#7a5300]">
            {emptyRows.length === 1 ? "Una prueba no tiene resultado" : `${emptyRows.length} pruebas no tienen resultado`} y no saldrán en el informe:{" "}
            {emptyRows.slice(0, 6).join(", ")}
            {emptyRows.length > 6 ? "…" : "."}
          </p>
        )}

        <div className="rounded-xl border border-line px-4 py-3">
          <p className="text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Firma</p>
          {signer ? (
            <>
              <p className="mt-1 font-serif text-[18px]">{signer.name}</p>
              <p className="text-[13px] text-muted">
                {[signer.title, signer.id_number, signer.registry, signer.college].filter(Boolean).join(" · ")}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#b03a36]">Falta el bioanalista que firma. Un administrador lo configura en Laboratorio.</p>
          )}
        </div>

        <p
          className={`flex gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
            autoSend.will ? "bg-mint/15 text-[#135c62]" : "bg-cream text-muted"
          }`}
        >
          <Icon name="chat" className="mt-0.5 size-4 shrink-0" />
          <span>
            {autoSend.will
              ? `Al validarlo, el PDF sale solo por WhatsApp al ${autoSend.phone}, protegido con la clave del paciente.`
              : `Al validarlo no sale por WhatsApp. ${autoSend.reason}`}
          </span>
        </p>

        <p className="flex gap-2 text-[13px] text-muted">
          <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
          {revision > 1
            ? `Validado, el informe ya no se edita. Esta revisión ${revision} reemplaza la anterior, que queda guardada.`
            : "Validado, el informe ya no se edita. Si hay que corregirlo, se reabre como revisión 2 y el original queda guardado."}
        </p>
      </div>
    </Dialog>
  );
}
