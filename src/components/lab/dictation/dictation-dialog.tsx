"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/crm/icons";
import { inputClass } from "@/components/crm/styles";
import { TESTS } from "@/lib/lab/catalog";
import { DICTATION_LIMITS, houseValue, type Dictation, type DictatedResult, type DictationEvent } from "@/lib/lab/dictation";
import { detectMentions } from "@/lib/lab/dictation-detect";
import type { PatientFacts } from "@/lib/lab/reference";
import type { ReportSection } from "@/lib/lab/types";
import { Dialog } from "../dialog";
import { ReviewDetails, ReviewList, ReviewTotals, startReview, type Review } from "./dictation-review";
import { useMicLevel } from "./use-mic-level";
import { useSpeech, useSpeechSupport } from "./use-speech";
import { VoiceOrb, type OrbState } from "./voice-orb";

// "Dictar resultados": the bioanalyst speaks the results, the comments and the
// sample's details as they read them off the analyser; the text appears as it
// is recognised, with the tests already understood. "Terminar" sends the text
// to Claude, whose results arrive one by one in a review where every value can
// be corrected, left out or confirmed. "Aplicar" puts them in the report (a
// draft: it autosaves, and is validated as usual). Closing the dialog keeps
// the dictation and a review in progress; they come back when it reopens.

export type DictationStatus = "idle" | "listening" | "working" | "review";

type Run =
  | { state: "idle" }
  | { state: "working"; words: number; started: number }
  | { state: "done"; seconds: number }
  | { state: "error"; message: string };

const EXAMPLES = [
  "Hematología completa: hemoglobina 13,5; hematocrito 41; plaquetas 250 mil; leucocitos 7.500, segmentados 60, linfocitos 35…",
  "Orina: aspecto claro, color amarillo, densidad 1.020, pH ácido 6; leucocitos 2 a 4 por campo; lo demás negativo.",
  "Observación: muestra lipémica. Solicitado por la Dra. Pérez. Muestra de hoy a las 7 y media.",
];

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** The results, in the order Claude wrote them; a test written again replaces its earlier value. */
const upsert = (list: DictatedResult[], result: DictatedResult) =>
  list.some((r) => r.id === result.id) ? list.map((r) => (r.id === result.id ? result : r)) : [...list, result];

async function readEvents(response: Response, onEvent: (event: DictationEvent) => void) {
  const type = response.headers.get("content-type") ?? "";
  if (!response.body || !type.includes("ndjson")) {
    onEvent({
      type: "error",
      message: response.redirected || response.status === 401 ? "Tu sesión terminó. Vuelve a iniciar sesión y dicta de nuevo." : "El servidor no respondió como se esperaba. Inténtalo de nuevo.",
    });
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as DictationEvent);
        } catch {
          // A broken line: the final answer still decides.
        }
      }
      newline = buffer.indexOf("\n");
    }
  }
}

/** The review as the report receives it: results left out are dropped, corrected figures tidied. */
function reviewed(review: Review): Dictation {
  const d = review.draft;
  return {
    ...d,
    results: d.results
      .filter((r) => !review.skipped[r.id] && r.value.trim())
      .map((r) => ({ ...r, value: houseValue(r.value, r.kind, r.test ? TESTS[r.test]?.options : [], r.unit) })),
    sectionNotes: d.sectionNotes.filter((n) => n.note.trim()),
    notes: d.notes.trim(),
    requestedBy: d.requestedBy.trim(),
  };
}

export function DictationDialog({
  open,
  onClose,
  reportId,
  ready,
  patientName,
  facts,
  sections,
  onApply,
  onStatus,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
  /** The server has Claude's key. */
  ready: boolean;
  patientName: string;
  facts: PatientFacts;
  sections: ReportSection[];
  onApply: (dictation: Dictation, then: "stay" | "validate") => void;
  onStatus?: (status: DictationStatus) => void;
}) {
  const support = useSpeechSupport();
  const stage = useRef<HTMLDivElement>(null);
  const pulse = useRef<(() => void) | null>(null);
  const onWords = useCallback(() => pulse.current?.(), []);
  const speech = useSpeech({ onActivity: onWords });
  const listening = speech.status === "listening" || speech.status === "stopping";
  const bump = useMicLevel(stage, open && speech.status === "listening");
  useEffect(() => {
    pulse.current = bump;
  }, [bump]);

  const [typing, setTyping] = useState(false);
  const [run, setRun] = useState<Run>({ state: "idle" });
  const [streamed, setStreamed] = useState<DictatedResult[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  // Listening time, across pauses.
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);
  useEffect(() => {
    if (speech.status !== "listening") return;
    const started = Date.now();
    const base = elapsedBase.current;
    const timer = setInterval(() => {
      elapsedBase.current = base + (Date.now() - started) / 1000;
      setElapsed(elapsedBase.current);
    }, 250);
    return () => clearInterval(timer);
  }, [speech.status]);

  const status: DictationStatus = run.state === "working" ? "working" : review ? "review" : listening ? "listening" : "idle";
  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  // The member leaving the page stops the request.
  useEffect(() => () => request.current?.abort(), []);

  // Closing stops the microphone; the text and any review stay.
  const { pause } = speech;
  const close = () => {
    pause();
    onClose();
  };

  const transcriptBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = transcriptBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [speech.text, speech.interim]);

  const mentions = useMemo(() => detectMentions(`${speech.text} ${speech.interim}`), [speech.text, speech.interim]);
  const hasText = Boolean(speech.text.trim() || speech.interim.trim());
  const textMode = typing || support === false;

  const compile = async () => {
    setNotice(null);
    const transcript = (await speech.settle()).trim();
    if (!transcript) {
      setNotice("Todavía no hay nada dictado.");
      return;
    }
    if (transcript.length > DICTATION_LIMITS.transcript) {
      setNotice("El dictado es muy largo. Aplica una parte y dicta el resto después.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStreamed([]);
    setReview(null);
    setRun({ state: "working", words: transcript.split(/\s+/).length, started: Date.now() });
    try {
      const response = await fetch(`/dashboard/laboratorio/${reportId}/dictado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        signal: controller.signal,
      });
      let finished = false;
      await readEvents(response, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === "result") setStreamed((list) => upsert(list, event.result));
        else if (event.type === "reset") setStreamed([]);
        else if (event.type === "done") {
          finished = true;
          setStreamed(event.dictation.results);
          setReview(startReview(event.dictation));
          setRun({ state: "done", seconds: event.seconds });
        } else if (event.type === "error") {
          finished = true;
          setRun({ state: "error", message: event.message });
        }
      });
      if (!finished && !controller.signal.aborted) setRun({ state: "error", message: "La respuesta se cortó antes de terminar. Inténtalo de nuevo." });
    } catch {
      if (!controller.signal.aborted) setRun({ state: "error", message: "No se pudo conectar con el servidor. Revisa el internet e inténtalo de nuevo." });
    }
  };

  const backToDictation = () => {
    request.current?.abort();
    setRun({ state: "idle" });
    setReview(null);
    setStreamed([]);
  };

  const discard = () => {
    pause();
    speech.reset("");
    elapsedBase.current = 0;
    setElapsed(0);
    setNotice(null);
  };

  const apply = (then: "stay" | "validate") => {
    if (!review) return;
    onApply(reviewed(review), then);
    speech.reset("");
    elapsedBase.current = 0;
    setElapsed(0);
    setRun({ state: "idle" });
    setReview(null);
    setStreamed([]);
    setTyping(false);
  };

  const orb: OrbState = run.state === "working" ? "thinking" : speech.status === "listening" ? "listening" : hasText ? "paused" : "idle";
  const phase = run.state === "idle" ? "listen" : "review";
  const kept = review ? review.draft.results.filter((r) => !review.skipped[r.id]).length : 0;

  const footer = !ready ? null : phase === "listen" ? (
    <>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        {support && (
          <button
            type="button"
            onClick={() => {
              if (!textMode) pause();
              setTyping(!textMode);
            }}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-navy"
          >
            <Icon name={textMode ? "mic" : "pen"} className="size-4" />
            {textMode ? "Volver al micrófono" : hasText ? "Corregir el texto" : "Escribir en su lugar"}
          </button>
        )}
        {hasText && (
          <button type="button" onClick={discard} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-[#b03a36]">
            <Icon name="trash" className="size-4" />
            Borrar
          </button>
        )}
      </div>
      <div className={`grid gap-2 sm:flex ${textMode ? "" : "grid-cols-2"}`}>
        {!textMode && (
          <button
            type="button"
            onClick={() => (listening ? pause() : speech.start())}
            disabled={speech.status === "stopping"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium whitespace-nowrap text-navy hover:border-navy disabled:opacity-60 sm:px-4"
          >
            <Icon name={listening ? "pause" : hasText ? "play" : "mic"} className="size-4" />
            <span>
              {listening ? "Pausar" : hasText ? "Seguir" : "Empezar"}
              <span className="max-sm:hidden">{listening ? "" : hasText ? " dictando" : " a dictar"}</span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => void compile()}
          disabled={!hasText || speech.status === "stopping"}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-teal disabled:opacity-50 sm:px-4"
        >
          <Icon name="sparkle" className="size-4" />
          <span>
            {listening ? "Terminar" : "Ordenar"}
            <span className="max-sm:hidden">{listening ? " y ordenar" : " resultados"}</span>
          </span>
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="flex min-w-0 flex-1 items-center">
        <button type="button" onClick={backToDictation} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-navy">
          <Icon name="arrow-left" className="size-4" />
          {run.state === "working" ? "Cancelar" : "Volver al dictado"}
        </button>
      </div>
      {run.state === "error" ? (
        <button
          type="button"
          onClick={() => void compile()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
        >
          <Icon name="refresh" className="size-4" />
          Reintentar
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => apply("stay")}
            disabled={!review || !kept}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium whitespace-nowrap text-navy hover:border-navy disabled:opacity-50 sm:px-4"
          >
            <Icon name="check" className="size-4" />
            <span>
              Aplicar<span className="max-sm:hidden"> al informe</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => apply("validate")}
            disabled={!review || !kept}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-teal disabled:opacity-50 sm:px-4"
          >
            <Icon name="shield" className="size-4" />
            {review ? (
              <span>
                Aplicar<span className="max-sm:hidden"> {kept}</span> y validar
              </span>
            ) : (
              "Ordenando…"
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      title={phase === "listen" ? "Dictar resultados" : run.state === "working" ? "Ordenando el dictado" : run.state === "error" ? "No se pudo ordenar" : "Revisa lo dictado"}
      description={
        phase === "listen"
          ? `${patientName} · Di cada prueba y su valor, en el orden que quieras.`
          : run.state === "done"
            ? "Corrige lo que no esté bien antes de pasarlo al informe. Nada se guarda hasta que lo apliques."
            : patientName
      }
      icon={phase === "listen" ? "mic" : "sparkle"}
      tone="teal"
      size="xl"
      footer={footer}
    >
      {!ready ? (
        <NotReady />
      ) : phase === "listen" ? (
        <div className="flex flex-col gap-4">
          {!textMode && (
            <div ref={stage} className="voice-stage flex flex-col items-center gap-3 pt-7">
              <button
                type="button"
                onClick={() => (listening ? pause() : speech.start())}
                disabled={support !== true || speech.status === "stopping"}
                aria-label={listening ? "Pausar el dictado" : "Empezar a dictar"}
                className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-mint/60"
              >
                <VoiceOrb state={orb} />
              </button>
              <p role="status" aria-live="polite" className="flex h-5 items-center gap-2 text-[13px] text-muted">
                {speech.status === "listening" ? (
                  <>
                    <span className="dictation-rec size-2 rounded-full bg-[#d9534f]" />
                    Escuchando · <span className="font-mono tabular-nums">{clock(elapsed)}</span>
                  </>
                ) : speech.status === "stopping" ? (
                  "Terminando…"
                ) : hasText ? (
                  <>En pausa · {clock(elapsed)}. Toca el círculo para seguir.</>
                ) : support === null ? (
                  ""
                ) : (
                  "Toca el círculo y empieza a hablar."
                )}
              </p>
            </div>
          )}

          {speech.error && (
            <p role="alert" className="flex gap-2 rounded-xl bg-coral/10 px-3 py-2.5 text-[13px] text-[#b03a36]">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              {speech.error}
            </p>
          )}
          {notice && <p className="rounded-xl bg-[#fff8e6] px-3 py-2.5 text-[13px] text-[#7a5300]">{notice}</p>}

          {textMode ? (
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
              {support === false
                ? "Este navegador no permite dictar aquí. Escribe los resultados, o usa el micrófono del teclado del teléfono."
                : "Corrige el texto o escribe los resultados como los dirías."}
              <textarea
                autoFocus
                value={speech.text}
                rows={8}
                maxLength={DICTATION_LIMITS.transcript}
                onChange={(e) => speech.reset(e.target.value)}
                placeholder={EXAMPLES[0]}
                className={`${inputClass} h-auto py-2 leading-relaxed`}
              />
            </label>
          ) : (
            <div
              ref={transcriptBox}
              className={`dictation-transcript max-h-[220px] min-h-[112px] overflow-y-auto rounded-xl border px-4 py-3 text-[15px] leading-relaxed transition-colors ${
                speech.status === "listening" ? "border-teal/40 bg-mint/[0.06]" : "border-line bg-cream/60"
              }`}
            >
              {hasText ? (
                <p className="text-navy">
                  {speech.text}
                  {speech.interim && <span className="text-teal"> {speech.interim}</span>}
                  {speech.status === "listening" && <span className="dictation-caret text-teal" />}
                </p>
              ) : (
                <div className="text-[13px] text-muted">
                  <p className="font-medium text-navy">Habla como al leer los resultados. Por ejemplo:</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {EXAMPLES.map((example) => (
                      <li key={example} className="flex gap-2">
                        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-teal" />
                        <span className="italic">«{example}»</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mentions.length > 0 && !textMode && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.08em] text-stone uppercase">
                Pruebas mencionadas <span className="text-teal">· {mentions.length}</span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {mentions.slice(-30).map((mention, i, shown) => (
                  <li key={`${mention.label}-${mentions.length - shown.length + i}`} className="dictation-chip inline-flex h-7 items-center gap-1.5 rounded-full border border-teal/25 bg-white px-2.5 text-[12px] text-navy">
                    <Icon name="check" className="size-3.5 text-teal" />
                    {mention.label}
                    {mention.value && <span className="font-mono text-[#135c62]">{mention.value}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex gap-2 text-[12px] leading-relaxed text-stone">
            <Icon name="lock" className="mt-0.5 size-3.5 shrink-0" />
            Claude recibe solo lo dictado y el sexo y la edad del paciente: el informe no le envía su nombre ni su cédula, así que no hace falta decirlos. Tú revisas todo antes de que entre al informe.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Progress run={run} found={(review?.draft.results ?? streamed).length} />
          {run.state === "error" ? (
            <p role="alert" className="flex gap-3 rounded-xl bg-coral/10 px-4 py-3 text-sm text-[#b03a36]">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              {run.message}
            </p>
          ) : (
            <>
              {review && <ReviewTotals review={review} facts={facts} sections={sections} />}
              {review && review.draft.results.length === 0 && (
                <p className="rounded-xl bg-[#fff8e6] px-4 py-3 text-sm text-[#7a5300]">
                  Claude no encontró resultados en el dictado. Vuelve al dictado y di cada prueba con su valor.
                </p>
              )}
              <ReviewList results={streamed} review={review} facts={facts} sections={sections} onChange={setReview} />
              {run.state === "working" && <PendingCards count={streamed.length ? 1 : 3} />}
              {review && <ReviewDetails review={review} onChange={setReview} />}
            </>
          )}
          {speech.text && (
            <details className="rounded-xl border border-line bg-cream/50 px-4 py-2.5 text-[13px] text-muted">
              <summary className="cursor-pointer font-medium text-navy">Lo que se dictó</summary>
              <p className="mt-2 leading-relaxed whitespace-pre-line">{speech.text}</p>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The steps of the sorting, as in Heidi's and Elicit's progress lists: done, under way, waiting. */
function Progress({ run, found }: { run: Run; found: number }) {
  if (run.state === "done") {
    return (
      <p className="dictation-rise flex items-center gap-2 rounded-xl bg-mint/15 px-4 py-2.5 text-[13px] text-[#135c62]">
        <Icon name="sparkle" className="size-4 shrink-0" />
        Claude ordenó {found} {found === 1 ? "resultado" : "resultados"} en {String(run.seconds).replace(".", ",")} s. Revisa los marcados en amarillo.
      </p>
    );
  }
  if (run.state !== "working") return null;
  const steps: { label: string; state: "done" | "active" | "waiting" }[] = [
    { label: `Dictado recibido · ${run.words} ${run.words === 1 ? "palabra" : "palabras"}`, state: "done" },
    { label: found ? `Ubicando cada valor en su prueba · ${found} hasta ahora` : "Ubicando cada valor en su prueba", state: "active" },
    { label: "Comparando con los valores de referencia", state: "waiting" },
  ];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-white px-4 py-3">
      <span className="hidden sm:block">
        <VoiceOrb state="thinking" size="sm" />
      </span>
      <ol className="flex min-w-0 flex-col gap-1.5">
        {steps.map((step) => (
          <li key={step.label.split(" · ")[0]} className={`flex items-center gap-2 text-[13px] ${step.state === "waiting" ? "text-stone" : "text-navy"}`}>
            {step.state === "done" ? (
              <span className="grid size-4 place-items-center rounded-full bg-teal text-white">
                <Icon name="check" className="size-3" />
              </span>
            ) : step.state === "active" ? (
              <span className="dictation-spinner size-4 rounded-full border-2 border-teal/25 border-t-teal" />
            ) : (
              <span className="size-4 rounded-full border-2 border-line" />
            )}
            <span className="min-w-0 truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PendingCards({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-white/70 px-4 py-3">
          <span className="size-4 rounded bg-sand" />
          <span className="dictation-shimmer h-3 w-40 rounded-full" />
          <span className="dictation-shimmer ml-auto h-8 w-32 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function NotReady() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <VoiceOrb state="paused" size="sm" />
      <p className="font-serif text-[22px] leading-tight">El dictado todavía no está activado</p>
      <p className="max-w-[46ch] text-sm text-muted">
        Para ordenar lo dictado, el servidor necesita la clave de Claude. Un administrador debe agregar <span className="font-mono text-[13px]">ANTHROPIC_API_KEY</span>{" "}
        en Vercel y volver a publicar. Mientras tanto, los resultados se escriben como siempre.
      </p>
    </div>
  );
}
