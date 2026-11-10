import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { AppointmentList } from "@/components/crm/appointment-list";
import { DatePicker } from "@/components/crm/date-picker";
import { Icon } from "@/components/crm/icons";
import { Select } from "@/components/crm/select";
import { TodayRateCard } from "@/components/crm/today-rate";
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
import { getAppointmentsOn, getBalances, getProfessionals, getRecentRates, getTodayRate } from "@/lib/crm/data";
import { ROLE_INFO } from "@/lib/crm/roles";
import { getViewer, type Viewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Agenda" };

type SearchParams = PageProps<"/dashboard/agenda">["searchParams"];

const weekdayFormat = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "short" });

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
          <Suspense
            fallback={
              <Card>
                <CardHeader title="Tasa BCV de hoy" hint={<Skeleton className="w-40" />} />
                <FormSkeleton className="px-5 py-4" />
              </Card>
            }
          >
            <TodayRate />
          </Suspense>
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

  // The week on screen, Monday to Sunday, for the strip of days.
  const monday = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      <Link href={link(addDays(day, -1))} className={`${button} max-lg:hidden`} aria-label="Día anterior">
        <Icon name="chevron-left" className="size-4" />
      </Link>
      <Link href={link(addDays(day, 1))} className={`${button} max-lg:hidden`} aria-label="Día siguiente">
        <Icon name="chevron-right" className="size-4" />
      </Link>
      <h2 className="mr-auto text-lg font-medium first-letter:uppercase max-lg:order-1 lg:px-2">
        {formatDay(day)}
        {day === today && <span className="ml-2 text-[13px] font-normal text-teal">Hoy</span>}
      </h2>
      <Form action="/dashboard/agenda" className="flex w-full flex-wrap items-center gap-2 max-lg:order-4 lg:w-auto">
        <DatePicker name="fecha" defaultValue={day} aria-label="Ir al día" submitOnChange className="min-w-[170px] flex-1 lg:w-[200px] lg:flex-none" />
        {!own && professionals.list.length > 0 && (
          <Select
            name="profesional"
            defaultValue={filter}
            aria-label="Profesional"
            submitOnChange
            className="min-w-[200px] flex-1 lg:w-[230px] lg:flex-none"
            panelMinWidth={260}
            searchPlaceholder="Buscar profesional…"
            options={[
              { value: "", label: "Todos los profesionales", icon: "team", description: "Todos los consultorios" },
              ...professionals.list.map((p) => ({
                value: p.id,
                label: p.name,
                avatar: p.name,
                description: p.role ? ROLE_INFO[p.role].label : undefined,
              })),
            ]}
          />
        )}
        {day !== today && (
          <Link href={link(today)} className={`${button} max-lg:hidden`}>
            Hoy
          </Link>
        )}
      </Form>
      {day !== today && (
        <Link href={link(today)} className="order-2 text-sm font-medium text-teal lg:hidden">
          Ir a hoy
        </Link>
      )}

      {/* Phones and upright tablets: the week as a strip of days, one tap each,
          with the weeks before and after on the arrows. */}
      <nav aria-label="Días de la semana" className="order-3 flex w-full items-center gap-1 lg:hidden">
        <Link href={link(addDays(day, -7))} aria-label="Semana anterior" className="grid h-14 w-7 shrink-0 place-items-center text-stone active:text-navy">
          <Icon name="chevron-left" className="size-4" />
        </Link>
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {week.map((date) => {
            const selected = date === day;
            return (
              <li key={date}>
                <Link
                  href={link(date)}
                  aria-current={selected ? "date" : undefined}
                  aria-label={formatDay(date)}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border ${
                    selected ? "border-navy bg-navy text-white" : "border-line bg-white active:bg-sand"
                  }`}
                >
                  <span className={`text-[11px] uppercase ${selected ? "text-mist" : "text-stone"}`}>{weekdayFormat.format(new Date(`${date}T12:00:00Z`)).slice(0, 3)}</span>
                  <span className={`text-[15px] font-medium ${!selected && date === today ? "text-teal" : ""}`}>{Number(date.slice(8))}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <Link href={link(addDays(day, 7))} aria-label="Semana siguiente" className="grid h-14 w-7 shrink-0 place-items-center text-stone active:text-navy">
          <Icon name="chevron-right" className="size-4" />
        </Link>
      </nav>
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
  const [todayRate, recentRates] = await Promise.all([getTodayRate(today), getRecentRates(today, 2)]);
  return <TodayRateCard today={today} rate={todayRate} recentRates={recentRates} />;
}
