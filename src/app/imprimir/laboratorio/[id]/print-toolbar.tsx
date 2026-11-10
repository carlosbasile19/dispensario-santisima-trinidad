"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Icon } from "@/components/crm/icons";
import { PAPERS, type Paper } from "@/components/lab/boleta";
import { logLabDelivery } from "@/app/dashboard/laboratorio/actions";

// Screen-only bar above the sheets: paper size, cover, how to print and fold.
export function PrintToolbar({
  id,
  final,
  paper,
  cover,
  title,
  sheets,
}: {
  id: string;
  final: boolean;
  paper: Paper;
  cover: boolean;
  title: string;
  sheets: number;
}) {
  const href = (next: { paper?: Paper; cover?: boolean }) => {
    const query = new URLSearchParams({ papel: next.paper ?? paper });
    if (!(next.cover ?? cover)) query.set("portada", "0");
    return `/imprimir/laboratorio/${id}?${query}`;
  };
  const folded = paper !== "media";

  const print = () => {
    if (final) void logLabDelivery(id, "print");
    window.print();
  };

  // Ctrl/⌘+P prints the sheets as they are; the log should not miss it.
  useEffect(() => {
    if (!final) return;
    const onPrint = () => void logLabDelivery(id, "print");
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, [final, id]);

  return (
    <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href={`/dashboard/laboratorio/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy">
          <Icon name="arrow-left" className="size-4" />
          Volver
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-[12px] text-muted">
            {sheets} {sheets === 1 ? "hoja" : "hojas"} · {PAPERS[paper].hint}
          </p>
        </div>

        <div role="radiogroup" aria-label="Papel" className="flex rounded-lg border border-outline bg-sand p-0.5">
          {(Object.keys(PAPERS) as Paper[]).map((key) => (
            <Link
              key={key}
              href={href({ paper: key })}
              replace
              role="radio"
              aria-checked={paper === key}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${paper === key ? "bg-white text-navy shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-navy"}`}
            >
              {PAPERS[key].label}
            </Link>
          ))}
        </div>
        <Link
          href={href({ cover: !cover })}
          replace
          role="switch"
          aria-checked={cover}
          className="inline-flex items-center gap-2 text-[13px] text-ink"
        >
          <span className={`relative h-5 w-8 rounded-full transition-colors ${cover ? "bg-teal" : "bg-outline"}`}>
            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${cover ? "translate-x-3" : ""}`} />
          </span>
          Portada
        </Link>
        <button
          type="button"
          onClick={print}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
        >
          <Icon name="printer" className="size-4" />
          Imprimir
        </button>
      </div>
      <ol className="mx-auto flex max-w-[1100px] flex-wrap gap-x-6 gap-y-1 px-4 pb-3 text-[12px] text-muted">
        <li>
          <span className="font-medium text-navy">1.</span> Papel {PAPERS[paper].label.toLowerCase()}, escala 100 % y sin márgenes ni encabezados del navegador.
        </li>
        {folded && cover && (
          <li>
            <span className="font-medium text-navy">2.</span> A doble cara, girando por el borde largo: la portada sale detrás de los resultados.
          </li>
        )}
        {folded && (
          <li>
            <span className="font-medium text-navy">{cover ? "3." : "2."}</span> Dobla por las marcas «doblar aquí» con los resultados hacia adentro.
          </li>
        )}
        {!final && (
          <li className="font-medium text-[#b03a36]">Borrador: sale marcado como tal. Valídalo antes de entregarlo.</li>
        )}
      </ol>
    </div>
  );
}
