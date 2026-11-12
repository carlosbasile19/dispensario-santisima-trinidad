"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { sessionText } from "@/lib/lab/dictation-detect";

// The browser's speech recognition (Web Speech API: Chrome, Edge, Safari),
// kept running for a whole dictation. Browsers end a recognition session
// after a pause, so a new one starts until the member stops. The words still
// being recognised ("interim") are kept apart from the settled text.

type Alternative = { transcript: string };
type Result = { isFinal: boolean; length: number; [index: number]: Alternative };
type ResultList = { length: number; [index: number]: Result };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const noSubscribe = () => () => {};
/** null while rendering on the server: the dialog waits before offering the microphone. */
export const useSpeechSupport = () =>
  useSyncExternalStore(
    noSubscribe,
    () => recognitionClass() !== null,
    () => null,
  );

/** Venezuelan Spanish first; a browser without it gets the closest one it has. */
const LANGUAGES = ["es-VE", "es-US", "es-ES"];

const ERRORS: Record<string, string> = {
  "not-allowed": "El navegador no tiene permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones y vuelve a intentarlo.",
  "service-not-allowed": "Este navegador no permite dictar aquí. Escribe los resultados, o usa Chrome o Edge.",
  "audio-capture": "No se encontró un micrófono. Conecta uno y vuelve a intentarlo.",
  network: "Se perdió la conexión con el servicio de dictado. Revisa el internet y continúa.",
};

const join = (...parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

/** "stopping": the browser is settling the last words; the text is final once "paused". */
export type SpeechStatus = "idle" | "listening" | "stopping" | "paused";

export function useSpeech({ onActivity }: { onActivity?: () => void } = {}) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<Recognition | null>(null);
  /** Ends the current session at once, for a browser that never reports its end. */
  const cutOff = useRef<(() => void) | null>(null);
  /** The member wants to keep listening: a session that ends opens another. */
  const wanted = useRef(false);
  /** Text of the sessions that already ended, and of the current one. */
  const committed = useRef("");
  const session = useRef("");
  const language = useRef(0);
  /** Callers of settle() waiting for the last words. */
  const waiting = useRef<((text: string) => void)[]>([]);
  const activity = useRef(onActivity);
  useEffect(() => {
    activity.current = onActivity;
  }, [onActivity]);

  const open = useCallback(function open() {
    const Class = recognitionClass();
    if (!Class) return;
    const r = new Class();
    r.lang = LANGUAGES[language.current] ?? "es-ES";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    const cumulative = /Android/i.test(navigator.userAgent);

    const finish = () => {
      if (recognition.current !== r) return;
      recognition.current = null;
      cutOff.current = null;
      committed.current = join(committed.current, session.current);
      session.current = "";
      setText(committed.current);
      setInterim("");
      if (!wanted.current) {
        setStatus("paused");
        const text = committed.current;
        for (const resolve of waiting.current.splice(0)) resolve(text);
        return;
      }
      try {
        open();
      } catch {
        wanted.current = false;
        setStatus("paused");
      }
    };

    r.onresult = (event) => {
      if (recognition.current !== r) return;
      const { settled, pending } = sessionText(event.results, cumulative);
      session.current = settled;
      setText(join(committed.current, settled));
      setInterim(pending);
      activity.current?.();
    };
    r.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "language-not-supported" && language.current < LANGUAGES.length - 1) {
        language.current++;
        return; // The session ends and the next one opens in the next language.
      }
      wanted.current = false;
      setError(ERRORS[event.error] ?? "El dictado se detuvo. Vuelve a intentarlo.");
    };
    r.onend = finish;
    recognition.current = r;
    cutOff.current = () => {
      r.onend = null;
      r.abort();
      finish();
    };
    r.start();
  }, []);

  const start = useCallback(() => {
    setError(null);
    wanted.current = true;
    setStatus("listening");
    if (recognition.current) return;
    try {
      open();
    } catch {
      wanted.current = false;
      setStatus("paused");
      setError("No se pudo iniciar el micrófono. Vuelve a intentarlo.");
    }
  }, [open]);

  /** Stops listening; the browser settles the words in progress first. */
  const pause = useCallback(() => {
    wanted.current = false;
    const r = recognition.current;
    if (!r) {
      setStatus((s) => (s === "idle" ? s : "paused"));
      return;
    }
    setStatus("stopping");
    r.stop();
    setTimeout(() => {
      if (recognition.current === r) cutOff.current?.();
    }, 1500);
  }, []);

  /** Stops listening and answers the whole text once the last words are settled. */
  const settle = useCallback(
    () =>
      new Promise<string>((resolve) => {
        if (!recognition.current) {
          wanted.current = false;
          resolve(committed.current);
          return;
        }
        waiting.current.push(resolve);
        pause();
      }),
    [pause],
  );

  /** Replaces the text (the member edited it, or starts over). A session still open is dropped, so its last words cannot come back. */
  const reset = useCallback((value = "") => {
    const r = recognition.current;
    if (r) {
      wanted.current = false;
      recognition.current = null;
      cutOff.current = null;
      r.abort();
      setStatus("paused");
      for (const resolve of waiting.current.splice(0)) resolve(value);
    }
    committed.current = value;
    session.current = "";
    setText(value);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      const r = recognition.current;
      recognition.current = null;
      r?.abort();
    },
    [],
  );

  return { status, text, interim, error, start, pause, settle, reset };
}
