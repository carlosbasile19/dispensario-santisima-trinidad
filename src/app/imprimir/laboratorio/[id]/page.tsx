import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BoletaPages, PAPERS, sheetCount, type Paper } from "@/components/lab/boleta";
import { isUuid, param } from "@/lib/crm/clinic";
import { getViewer } from "@/lib/crm/viewer";
import { getLabReport } from "@/lib/lab/data";
import { fullName } from "@/lib/lab/format";
import { reportNumber } from "@/lib/lab/report";
import { PrintToolbar } from "./print-toolbar";

export const metadata: Metadata = { title: "Imprimir boleta", robots: { index: false } };

// The printable boleta, outside the platform's frame so nothing but the
// sheets reaches the printer. ?papel=carta|a4|media, ?portada=0 to leave the
// cover out. The page sizes itself with @page, so the printer's own margins
// and headers stay out of the way.
export default function PrintLabReportPage({ params, searchParams }: PageProps<"/imprimir/laboratorio/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Preparando la boleta…</p>}>
      <PrintView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PrintView({ params, searchParams }: PageProps<"/imprimir/laboratorio/[id]">) {
  await getViewer();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const report = await getLabReport(id);
  if (!report) notFound();

  const requested = param(query.papel);
  const paper: Paper = requested in PAPERS ? (requested as Paper) : "carta";
  const cover = param(query.portada) !== "0";
  const boleta = {
    number: report.number,
    revision: report.revision,
    status: report.status,
    patient: report.patient,
    facts: report.facts,
    content: report.content,
    signer: report.signer,
    finalizedAt: report.finalizedAt,
    printedAt: new Date().toISOString(),
  };
  const size = PAPERS[paper];

  return (
    <div className="boleta-print min-h-dvh bg-[#e8e5de]">
      <style>{`
        @page { size: ${size.width} ${size.height}; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .boleta-print { background: #fff !important; min-height: 0 !important; }
          .boleta-stack { padding: 0 !important; gap: 0 !important; }
          .boleta-sheet { box-shadow: none !important; break-after: page; overflow: hidden; }
          .boleta-sheet:last-child { break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <PrintToolbar
        id={report.id}
        final={report.status === "final"}
        paper={paper}
        cover={cover}
        title={`${fullName(report.patient)} · Nº ${reportNumber(report.number)}`}
        sheets={sheetCount(boleta, paper)}
      />
      <div className="boleta-stack flex flex-col items-center gap-6 overflow-x-auto px-4 py-8">
        <BoletaPages report={boleta} paper={paper} cover={cover} />
      </div>
    </div>
  );
}
