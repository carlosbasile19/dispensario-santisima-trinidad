import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache, type ReactNode } from "react";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { TodayRateCard } from "@/components/crm/today-rate";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  RowsSkeleton,
  Skeleton,
  StatGrid,
  StatGridSkeleton,
  type Stat,
} from "@/components/crm/ui";
import {
  AREA_ICON,
  AREA_LABEL,
  SERVICE_AREAS,
  UNBILLED_STATUSES,
  clinicToday,
  formatDay,
  type AppointmentStatus,
  type ServiceArea,
} from "@/lib/crm/clinic";
import { getAppointmentsOn, getBalances, getProfessionals, getRecentRates, getTodayRate } from "@/lib/crm/data";
import { formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer, type Viewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

const INTRO = {
  doctor: "Tu agenda de hoy: los pacientes con los que tienes un servicio.",
  director: "Cómo va el día en todos los consultorios del centro.",
  staff: "Las citas, llegadas y cobros de hoy.",
  admin: "La operación de hoy: citas, cobros y la tasa BCV.",
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The key figures each member gets, in order (see TodayStats). */
const statLabels = (money: boolean) =>
  money ? ["Citas de hoy", "En sala", "Por cobrar hoy", "Tasa BCV de hoy"] : ["Citas de hoy", "En sala", "Atendidas"];

// Inicio: today at a glance, laid out like Agenda. A row of key figures, then
// today's appointments (a doctor only their own, via RLS) beside a rail with
// the day's services by area and, while it is missing, today's BCV rate for
// the members who take payments. The greeting and the frame of each card
// render from the viewer; today's date and figures stream in.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const money = p.collectPayments;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            Hoy ·{" "}
            <Suspense fallback={<Skeleton className="w-40" />}>
              <TodayIs />
            </Suspense>
          </>
        }
        title={`Buen día, ${viewer.firstName}`}
        description={INTRO[viewer.role]}
        actions={
          p.manageSchedule && (
            <Link
              href="/dashboard/agenda/nueva"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
            >
              <Icon name="plus" className="size-4" />
              Nueva cita
            </Link>
          )
        }
      />

      <Suspense fallback={<StatGridSkeleton labels={statLabels(money)} />}>
        <TodayStats money={money} />
      </Suspense>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <Suspense
            fallback={
              <>
                <AgendaHeader own={own} hint={<Skeleton className="w-32" />} />
                <RowsSkeleton />
              </>
            }
          >
            <TodayAppointments viewer={viewer} />
          </Suspense>
        </Card>

        <div className="flex flex-col gap-6">
          {money && (
            // The rate is a key figure above; its card only shows when it still
            // has to be loaded, so it has no placeholder.
            <Suspense>
              <MissingRate />
            </Suspense>
          )}

          <Card>
            <CardHeader title="Por área" hint={own ? "Tus servicios de hoy" : "Los servicios de hoy en el centro"} />
            <Suspense fallback={<AreaList />}>
              <TodayAreas viewer={viewer} />
            </Suspense>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Today's visits and, for members who take payments, their balances. Read once per request. */
const getToday = cache(async (money: boolean) => {
  const today = await clinicToday();
  const appointments = await getAppointmentsOn(today);
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;
  const billed = appointments.filter((a) => !UNBILLED_STATUSES.includes(a.status));
  return { today, appointments, balances, billed };
});

async function TodayIs() {
  return formatDay(await clinicToday());
}

async function TodayStats({ money }: { money: boolean }) {
  const { today, appointments, balances, billed } = await getToday(money);
  const rate = money ? await getTodayRate(today) : null;

  const count = (...statuses: AppointmentStatus[]) => appointments.filter((a) => statuses.includes(a.status)).length;
  const expected = count("scheduled", "confirmed");
  const waiting = count("checked_in");
  const dropped = count(...UNBILLED_STATUSES);
  const charged = balances ? sumCents(billed.map((a) => balances.get(a.id)?.total ?? 0)) : 0n;
  const pending = balances ? sumCents(billed.map((a) => Math.max(0, balances.get(a.id)?.balance ?? 0))) : 0n;

  // Everyone: how the day is going. Members who take payments: what is still
  // owed and today's rate; the others: how many visits are done.
  const stats: Stat[] = [
    { label: "Citas de hoy", value: String(appointments.length), hint: expected ? `${expected} por llegar` : "Ninguna por llegar" },
    { label: "En sala", value: String(waiting), hint: waiting ? "Pacientes que ya llegaron" : "Nadie en espera" },
  ];
  if (money) {
    stats.push(
      { label: "Por cobrar hoy", value: formatUsd(pending), hint: `De ${formatUsd(charged)} en servicios` },
      rate
        ? {
            label: "Tasa BCV de hoy",
            value: `Bs. ${formatRate(rate.bs_per_usd)}`,
            hint: rate.source === "manual" ? "Cargada a mano" : "Automática, del BCV",
          }
        : { label: "Tasa BCV de hoy", value: "Sin cargar", hint: "Cárgala antes de cobrar", alert: true },
    );
  } else {
    stats.push({
      label: "Atendidas",
      value: String(count("completed")),
      hint: dropped ? plural(dropped, "cancelada o no asistió", "canceladas o no asistieron") : "Ninguna cancelada",
    });
  }
  return <StatGrid stats={stats} />;
}

function AgendaHeader({ own, hint }: { own: boolean; hint: ReactNode }) {
  return (
    <CardHeader
      title={own ? "Mi agenda de hoy" : "Agenda de hoy"}
      hint={hint}
      action={
        <Link href="/dashboard/agenda" className="text-sm font-medium whitespace-nowrap text-teal hover:text-navy">
          Ver agenda
        </Link>
      }
    />
  );
}

async function TodayAppointments({ viewer }: { viewer: Viewer }) {
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const [{ appointments, balances }, professionals] = await Promise.all([
    getToday(p.collectPayments),
    getProfessionals(),
  ]);

  return (
    <>
      <AgendaHeader
        own={own}
        hint={appointments.length ? `${plural(appointments.length, "cita", "citas")}, por hora` : "Ninguna cita agendada"}
      />
      {appointments.length ? (
        <AppointmentList
          appointments={appointments}
          professionals={professionals.byId}
          balances={balances}
          highlight={own ? viewer.id : undefined}
        />
      ) : (
        <EmptyState
          icon="calendar"
          title="No hay citas hoy"
          action={
            p.manageSchedule ? (
              <Link href="/dashboard/agenda/nueva" className="text-sm font-medium text-teal hover:text-navy">
                Agendar una cita
              </Link>
            ) : undefined
          }
        >
          {own ? "Cuando recepción te asigne un servicio, aparecerá aquí." : "Las citas del día aparecerán aquí."}
        </EmptyState>
      )}
    </>
  );
}

async function MissingRate() {
  const today = await clinicToday();
  const [rate, recentRates] = await Promise.all([getTodayRate(today), getRecentRates(today, 2)]);
  if (rate) return null;
  return <TodayRateCard today={today} rate={rate} recentRates={recentRates} />;
}

type AreaCount = { area: ServiceArea; total: number; done: number };

/** The day's services per area; without `areas`, the counts are still loading. */
function AreaList({ areas }: { areas?: AreaCount[] }) {
  return (
    <ul aria-busy={areas ? undefined : true} className="divide-y divide-line">
      {SERVICE_AREAS.map((area, i) => {
        const counts = areas?.[i];
        const total = counts?.total ?? 0;
        // Loading rows look like rows with services until the counts arrive.
        const active = !counts || total > 0;
        return (
          <li key={area} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${active ? "bg-frost text-navy" : "bg-sand text-stone"}`}
            >
              <Icon name={AREA_ICON[area]} className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className={`text-sm font-medium ${active ? "" : "text-stone"}`}>{AREA_LABEL[area]}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {!counts ? (
                  <Skeleton className="w-24" />
                ) : !total ? (
                  "Sin servicios hoy"
                ) : counts.done ? (
                  plural(counts.done, "atendido", "atendidos")
                ) : (
                  "Ninguno atendido aún"
                )}
              </p>
            </div>
            <span className={`font-mono text-lg ${active ? "" : "text-stone"}`}>{counts ? total : <Skeleton className="w-4" />}</span>
          </li>
        );
      })}
    </ul>
  );
}

async function TodayAreas({ viewer }: { viewer: Viewer }) {
  const own = viewer.permissions.schedule === "own";
  const { billed } = await getToday(viewer.permissions.collectPayments);
  // A doctor's own services; everyone else's the whole centre's.
  const services = billed.flatMap((a) =>
    a.items
      .filter((item) => !own || item.professional_id === viewer.id)
      .map((item) => ({ area: item.service?.area, done: a.status === "completed" })),
  );
  const areas = SERVICE_AREAS.map((area) => {
    const list = services.filter((s) => s.area === area);
    return { area, total: list.length, done: list.filter((s) => s.done).length };
  });
  return <AreaList areas={areas} />;
}
