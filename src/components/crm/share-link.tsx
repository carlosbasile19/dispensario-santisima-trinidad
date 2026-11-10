"use client";

import { useState, useSyncExternalStore } from "react";

import { Icon } from "./icons";

// The public link of a booking calendar, ready to send: copy it, share it
// on WhatsApp with a short message, or open it as a patient sees it. The
// domain comes from the browser, so it is right on production, on preview
// deployments and locally.

const noSubscribe = () => () => {};
const useOrigin = () => useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-lg border border-outline bg-white text-navy transition-colors hover:border-navy";

export function ShareLink({
  slug,
  name,
  compact = false,
}: {
  slug: string;
  /** The professional, for the WhatsApp message. */
  name: string;
  compact?: boolean;
}) {
  const origin = useOrigin();
  const path = `/agendar/${slug}`;
  const url = `${origin}${path}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  };

  const message = `Agenda tu cita con ${name} en el Centro Médico Integral Santísima Trinidad: ${url}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const host = origin.replace(/^https?:\/\//, "");

  return (
    <div className={`flex min-w-0 items-center gap-2 ${compact ? "" : "rounded-xl border border-line bg-cream/60 p-1.5 pl-3"}`}>
      <Icon name="link" className="size-4 shrink-0 text-teal" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={url}>
        <span className="text-stone">{host}</span>
        {path}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Enlace copiado" : "Copiar enlace"}
        title="Copiar enlace"
        className={`${iconButton} ${compact ? "" : "w-auto gap-1.5 px-3 text-[13px] font-medium"} ${copied ? "border-teal text-teal" : ""}`}
      >
        <Icon name={copied ? "check" : "copy"} className="size-4" />
        {!compact && (copied ? "Copiado" : "Copiar")}
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Enviar por WhatsApp"
        title="Enviar por WhatsApp"
        className={iconButton}
      >
        <Icon name="chat" className="size-4" />
      </a>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver la página como la ve el paciente"
        title="Ver como paciente"
        className={iconButton}
      >
        <Icon name="external" className="size-4" />
      </a>
    </div>
  );
}
