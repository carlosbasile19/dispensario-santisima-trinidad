import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { Card, CardHeader, NoAccess, PageHeader, Skeleton } from "@/components/crm/ui";
import { PERIOD_KINDS, PERIOD_LABEL, shiftDays, shortRange, stepPeriod } from "@/lib/crm/reports";
import { getViewer } from "@/lib/crm/viewer";
import { AccountingTabs } from "../tabs";
import { getReport, readPeriod, reportHref } from "./data";
import { NoData } from "./figures";
import { ReportView } from "./view";

export const metadata: Metadata = { title: "Reportes" };

type SearchParams = PageProps<"/dashboard/contabilidad/reportes">["searchParams"];

const control =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";
const disabledControl = "inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-3 text-stone/50";

// Reportes (administrators only): how many patients the centre saw, how many
// visits, what came in and went out, for a week, a month, a quarter or a
// year, each figure against the period before. One database call per period
// (accounting_report) feeds every card; the detail table repeats the chart
// figures and downloads as CSV.
export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/contabilidad/reportes">) {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Pacientes, citas, ingresos y gastos por semana, mes, trimestre o año, comparados con el período anterior."
      />
      <AccountingTabs active="reportes" />

      <Suspense fallback={<PeriodBarSkeleton />}>
        <PeriodBar searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ReportSkeleton />}>
        <ReportBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Period controls -------------------------------------------------------------

async function PeriodBar({ searchParams }: { searchParams: SearchParams }) {
  const { period, today, isCurrent } = await readPeriod(searchParams);
  const previous = stepPeriod(period, -1);
  const next = stepPeriod(period, 1);
  const canGoForward = next.from <= today;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Período" className="flex h-10 rounded-lg border border-outline bg-white p-1 max-sm:w-full">
        {PERIOD_KINDS.map((kind) => (
          <Link
            key={kind}
            href={reportHref(kind, kind === period.kind ? period.from : today)}
            aria-current={kind === period.kind ? "page" : undefined}
            className={`flex flex-1 items-center justify-center rounded-md px-3 text-sm sm:flex-none ${
              kind === period.kind ? "bg-navy font-medium text-white" : "text-muted hover:text-navy"
            }`}
          >
            {PERIOD_LABEL[kind]}
          </Link>
        ))}
      </nav>
      <Link href={reportHref(period.kind, previous.from)} className={control} aria-label="Período anterior">
        <Icon name="chevron-left" className="size-4" />
      </Link>
      {canGoForward ? (
        <Link href={reportHref(period.kind, next.from)} className={control} aria-label="Período siguiente">
          <Icon name="chevron-right" className="size-4" />
        </Link>
      ) : (
        <span className={disabledControl} aria-hidden="true">
          <Icon name="chevron-right" className="size-4" />
        </span>
      )}
      <h2 className="mr-auto px-2 text-lg font-medium first-letter:uppercase">
        {period.label}
        {isCurrent && <span className="ml-2 text-[13px] font-normal text-teal">En curso</span>}
      </h2>
      <div className="flex gap-2 max-sm:w-full max-sm:[&>a]:flex-1">
        {!isCurrent && (
          <Link href={reportHref(period.kind, today)} className={control}>
            Actual
          </Link>
        )}
        <a href={`/dashboard/contabilidad/reportes/csv?periodo=${period.kind}&fecha=${period.from}`} download className={control}>
          <Icon name="download" className="size-4" />
          Exportar CSV
        </a>
      </div>
    </div>
  );
}

function PeriodBarSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-wrap items-center gap-2">
      <span className="h-10 w-full rounded-lg border border-outline bg-white sm:w-[316px]" />
      <span className="size-10 rounded-lg border border-outline bg-white" />
      <span className="size-10 rounded-lg border border-outline bg-white" />
      <h2 className="mr-auto px-2 text-lg font-medium">
        <Skeleton className="w-40" />
      </h2>
    </div>
  );
}

// The report ------------------------------------------------------------------

async function ReportBody({ searchParams }: { searchParams: SearchParams }) {
  const { period, today } = await readPeriod(searchParams);
  const previousPeriod = stepPeriod(period, -1);
  // While the period is under way its deltas compare it, up to today, with
  // the previous period up to the same day (12 Nov against 12 Oct); the
  // charts still show the previous period whole.
  const underWay = period.from <= today && today < period.to;
  const elapsed = Math.round((Date.parse(today) - Date.parse(period.from)) / 86_400_000);
  const sameDay = [shiftDays(previousPeriod.from, elapsed), previousPeriod.to].sort()[0];
  const [report, previous, currentToDate, previousToDate] = await Promise.all([
    getReport(period.from, period.to, period.bucket),
    getReport(previousPeriod.from, previousPeriod.to, previousPeriod.bucket),
    underWay ? getReport(period.from, today, period.bucket) : null,
    underWay ? getReport(previousPeriod.from, sameDay, previousPeriod.bucket) : null,
  ]);
  if (!report || !previous || (underWay && (!currentToDate || !previousToDate))) {
    return (
      <Card>
        <NoData>No se pudo cargar el reporte. Vuelve a intentarlo en un momento.</NoData>
      </Card>
    );
  }
  return (
    <ReportView
      report={report}
      previous={previous}
      period={period}
      previousPeriod={previousPeriod}
      today={today}
      toDate={
        currentToDate && previousToDate
          ? { current: currentToDate, previous: previousToDate, label: shortRange(previousPeriod.from, sameDay, period.kind === "ano") }
          : undefined
      }
    />
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Cargando reporte…</span>
      <Card>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border-b border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
          {["Pacientes", "Pacientes nuevos", "Citas", "Ingresos", "Gastos", "Resultado"].map((label) => (
            <div key={label} className="bg-white px-4 py-4 sm:px-5">
              <p className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</p>
              <p className="mt-1.5 text-xl">
                <Skeleton className="w-20" />
              </p>
              <p className="mt-1.5 text-[12px]">
                <Skeleton className="w-24" />
              </p>
              <p className="mt-1 text-[12px]">
                <Skeleton className="w-28" />
              </p>
            </div>
          ))}
        </div>
        <div className="h-[316px] px-5 py-4">
          <span className="block h-full motion-safe:animate-pulse rounded-lg bg-cream" />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-[300px] lg:col-span-2">
          <CardHeader title="Ingresos y gastos" hint="Lo cobrado y lo pagado a proveedores, en dólares a tasa BCV" />
        </Card>
        <Card className="h-[300px]">
          <CardHeader title="Balance del período" hint="Lo que entró y salió" />
        </Card>
      </div>
    </div>
  );
}

