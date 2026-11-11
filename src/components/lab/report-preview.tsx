"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

import { Skeleton } from "@/components/crm/ui";
import type { BoletaReport } from "./boleta";

export const ReportPreview = dynamic(() => import("./preview-pane").then((module) => module.PreviewPane), {
  loading: () => (
    <div role="status" aria-label="Cargando vista previa" aria-busy="true" className="flex min-h-64 flex-col gap-4">
      <Skeleton className="w-48" />
      <Skeleton className="min-h-52 w-full" />
    </div>
  ),
});

const DESKTOP = "(min-width: 1280px)";
const desktopSnapshot = () => window.matchMedia(DESKTOP).matches;
const serverSnapshot = () => false;

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** A hidden desktop column must not render print sheets or fetch PDFs on phones. */
export function DesktopReportPreview({ report, pdfUrl }: { report: BoletaReport; pdfUrl: string }) {
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  return desktop ? <ReportPreview report={report} pdfUrl={pdfUrl} /> : null;
}
