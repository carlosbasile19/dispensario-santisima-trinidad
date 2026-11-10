"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/crm/icons";
import { BoletaPages, type BoletaReport } from "./boleta";

// The live preview beside the editor: the printed boleta, redrawn as results
// are typed, or the branded PDF as it was last saved.

export function PreviewPane({ report, pdfUrl, compact = false }: { report: BoletaReport; pdfUrl: string; compact?: boolean }) {
  const [tab, setTab] = useState<"boleta" | "pdf">("boleta");
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista previa" className="flex rounded-lg border border-outline bg-sand p-0.5">
          {(
            [
              ["boleta", "Boleta impresa"],
              ["pdf", "PDF para WhatsApp"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${tab === key ? "bg-white text-navy shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-navy"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-teal hover:text-navy">
          Abrir
          <Icon name="external" className="size-3.5" />
        </a>
      </div>
      {tab === "boleta" ? (
        <ScaledSheets report={report} />
      ) : (
        <iframe
          key={pdfUrl}
          src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
          title="PDF del informe"
          className={`w-full rounded-lg border border-line bg-white ${compact ? "h-[70dvh]" : "h-[calc(100dvh-260px)] min-h-[480px]"}`}
        />
      )}
    </div>
  );
}

/** The boleta's sheets scaled to the column's width. */
function ScaledSheets({ report }: { report: BoletaReport }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (!el || !content) return;
    const measure = () => {
      const width = content.scrollWidth || 816;
      const next = Math.min(1, el.clientWidth / width);
      setScale(next);
      setHeight(content.scrollHeight * next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="overflow-hidden rounded-lg bg-[#e8e5de] p-0" style={{ height: height || undefined }}>
      <div ref={inner} className="flex w-max origin-top-left flex-col gap-3" style={{ transform: `scale(${scale})` }}>
        <BoletaPages report={report} paper="carta" cover={false} />
      </div>
    </div>
  );
}
