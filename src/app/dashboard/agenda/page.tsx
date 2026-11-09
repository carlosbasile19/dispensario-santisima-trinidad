import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { RateForm } from "@/components/crm/rate-form";
import {
  Card,
  CardHeader,
  DayBarSkeleton,
  EmptyState,
  FormSkeleton,
  PageHeader,
  RowsSkeleton,
  Skeleton,
} from "@/components/crm/ui";
import { STATUS_INFO, addDays, clinicToday, formatDay, isIsoDate, isUuid, param } from "@/lib/crm/clinic";
import { getAppointmentsOn, getBalances, getProfessionals, getRate, getRecentRates } from "@/lib/crm/data";
import { formatRate } from "@/lib/crm/money";
import { getViewer, type Viewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Agenda" };

type SearchParams = PageProps<"/dashboard/agenda">["searchParams"];

const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";

// Agenda: one clinic day at a time. A doctor sees only the visits where they
// have a service (RLS); everyone else sees every consulting room and can
// filter by professional. The front desk books from here and sets today's
// BCV rate. The header and the cards render from the viewer; the day (from
// the URL or the clinic clock) and its appointments stream in.
export default async function AgendaPage({ searchParams }: PageProps<"/dashboard/agenda">) {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";
  const money = viewer.permissions.collectPayments;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={own ? "Mi agenda" : "Agenda"}
        description={own ? "Las citas en las que atiendes un servicio." : "Las citas de todos los consultorios, día por día."}
        actions={
          viewer.permissions.manageSchedule && (
            // Books for the day on screen once it is known; today until then.
            <Suspense fallback={<NewAppointmentLink />}>
              <NewAppointmentForDay searchParams={searchParams} />
            </Suspense>
          )
        }
      />

      <Suspense fallback={<DayBarSkeleton />}>
        <DayBar searchParams={searchParams} own={own} />
      </Suspense>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <Suspense
            fallback={
              <>
                <CardHeader title={<Skeleton className="w-20" />} hint={<Skeleton className="w-44" />} />
                <RowsSkeleton />
              </>
            }
          >
            <DayAppointments searchParams={searchParams} viewer={viewer} />
          </Suspense>
        </Card>

        {money && (
          <Card>
            <Suspense
              fallback={
                <>
                  <CardHeader title="Tasa BCV de hoy" hint={<Skeleton className="w-40" />} />
                  <FormSkeleton className="px-5 py-4" />
                </>
              }
            >
              <TodayRate />
            </Suspense>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The day on screen (?fecha=, or today in the clinic) and the professional filter. */
async function readAgendaQuery(searchParams: SearchParams) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const day = isIsoDate(param(params.fecha)) ? param(params.fecha) : today;
  const filter = isUuid(param(params.profesional)) ? param(params.profesional) : "";
  return { today, day, filter };
}

function NewAppointmentLink({ day }: { day?: string }) {
  return (
    <Link
      href={day ? `/dashboard/agenda/nueva?fecha=${day}` : "/dashboard/agenda/nueva"}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
    >
      <Icon name="plus" className="size-4" />
      Nueva cita
    </Link>
  );
}

async function NewAppointmentForDay({ searchParams }: { searchParams: SearchParams }) {
  const { day } = await readAgendaQuery(searchParams);
  return <NewAppointmentLink day={day} />;
}

async function DayBar({ searchParams, own }: { searchParams: SearchParams; own: boolean }) {
  const [{ today, day, filter }, professionals] = await Promise.all([readAgendaQuery(searchParams), getProfessionals()]);
  const link = (target: string) => {
    const query = new URLSearchParams({ fecha: target });
    if (filter) query.set("profesional", filter);
    return `/dashboard/agenda?${query}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={link(addDays(day, -1))} className={button} aria-label="Día anterior">
        <Icon name="chevron-left" className="size-4" />
      </Link>
      <Link href={link(addDays(day, 1))} className={button} aria-label="Día siguiente">
        <Icon name="chevron-right" className="size-4" />
      </Link>
      <h2 className="mr-auto px-2 text-lg font-medium first-letter:uppercase">
        {formatDay(day)}
        {day === today && <span className="ml-2 text-[13px] font-normal text-teal">Hoy</span>}
      </h2>
      <form action="/dashboard/agenda" className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          name="fecha"
          defaultValue={day}
          aria-label="Ir al día"
          className="h-10 rounded-lg border border-outline bg-white px-3 text-sm"
        />
        {!own && professionals.list.length > 0 && (
          <select
            name="profesional"
            defaultValue={filter}
            aria-label="Profesional"
            className="h-10 max-w-[220px] rounded-lg border border-outline bg-white px-2 text-sm"
          >
            <option value="">Todos los profesionales</option>
            {professionals.list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={button}>
          Ver
        </button>
        {day !== today && (
          <Link href={link(today)} className={button}>
            Hoy
          </Link>
        )}
      </form>
    </div>
  );
}

async function DayAppointments({ searchParams, viewer }: { searchParams: SearchParams; viewer: Viewer }) {
  const { day, filter } = await readAgendaQuery(searchParams);
  const own = viewer.permissions.schedule === "own";
  const money = viewer.permissions.collectPayments;

  const [all, professionals] = await Promise.all([getAppointmentsOn(day), getProfessionals()]);
  const appointments = filter ? all.filter((a) => a.items.some((i) => i.professional_id === filter)) : all;
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;
  const counts = appointments.reduce<Partial<Record<keyof typeof STATUS_INFO, number>>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <CardHeader
        title={`${appointments.length} ${appointments.length === 1 ? "cita" : "citas"}`}
        hint={
          Object.entries(counts)
            .map(([status, n]) => `${n} ${STATUS_INFO[status as keyof typeof STATUS_INFO].label.toLowerCase()}`)
            .join(" · ") || undefined
        }
      />
      {appointments.length ? (
        <AppointmentList
          appointments={appointments}
          professionals={professionals.byId}
          balances={balances}
          highlight={own ? viewer.id : filter || undefined}
        />
      ) : (
        <EmptyState
          icon="calendar"
          title="No hay citas este día"
          action={
            viewer.permissions.manageSchedule ? (
              <Link href={`/dashboard/agenda/nueva?fecha=${day}`} className="text-sm font-medium text-teal hover:text-navy">
                Agendar una cita
              </Link>
            ) : undefined
          }
        >
          {filter ? "Ninguna cita con ese profesional. Prueba con todos los profesionales." : "Cambia de día con las flechas o el calendario."}
        </EmptyState>
      )}
    </>
  );
}

async function TodayRate() {
  const today = await clinicToday();
  const [todayRate, recentRates] = await Promise.all([getRate(today), getRecentRates(today, 2)]);
  return (
    <>
      <CardHeader
        title="Tasa BCV de hoy"
        hint={todayRate ? `Bs. ${formatRate(todayRate.bs_per_usd)} por dólar` : "Sin cargar: hace falta para cobrar"}
      />
      <div className="px-5 py-4">
        <RateForm
          day={today}
          current={todayRate?.bs_per_usd ?? null}
          suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null}
          hasPayments
        />
      </div>
    </>
  );
}
