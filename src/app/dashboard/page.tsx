import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { RateForm } from "@/components/crm/rate-form";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  RowsSkeleton,
  Skeleton,
  StatCard,
  StatCardsSkeleton,
} from "@/components/crm/ui";
import { UNBILLED_STATUSES, clinicToday, formatDay } from "@/lib/crm/clinic";
import { getAppointmentsOn, getBalances, getProfessionals, getRate, getRecentRates } from "@/lib/crm/data";
import { formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer, type Viewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

const INTRO = {
  doctor: "Tu agenda de hoy: los pacientes con los que tienes un servicio.",
  director: "Cómo va el día en todos los consultorios del centro.",
  staff: "Las citas, llegadas y cobros de hoy.",
  admin: "La operación de hoy: citas, cobros y la tasa BCV.",
} as const;

const STATS = ["Citas de hoy", "Por cobrar hoy", "Tasa BCV de hoy"] as const;
const statsFor = (money: boolean) => (money ? STATS : STATS.slice(0, 1));

// Inicio: today at a glance. Everyone sees today's appointments (a doctor
// only their own, via RLS); members who take payments also see today's BCV
// rate and what has been charged and collected. The greeting and the frame of
// each card render from the viewer; today's date and figures stream in.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const money = p.collectPayments;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Buen día, ${viewer.firstName}`}
        description={
          <>
            {INTRO[viewer.role]}{" "}
            <Suspense fallback={<Skeleton className="w-48" />}>
              <TodayIs />
            </Suspense>
          </>
        }
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<StatCardsSkeleton labels={statsFor(money)} />}>
          <TodayStats money={money} />
        </Suspense>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title={own ? "Mi agenda de hoy" : "Agenda de hoy"}
            action={
              <Link href="/dashboard/agenda" className="text-sm font-medium text-teal hover:text-navy">
                Ver agenda
              </Link>
            }
          />
          <Suspense fallback={<RowsSkeleton />}>
            <TodayAppointments viewer={viewer} />
          </Suspense>
        </Card>

        {money && (
          // Only shown while today's rate is missing, so it has no placeholder.
          <Suspense>
            <MissingRate />
          </Suspense>
        )}
      </div>
    </div>
  );
}

/** Today's visits and, for members who take payments, their balances. Read once per request. */
const getToday = cache(async (money: boolean) => {
  const today = await clinicToday();
  const appointments = await getAppointmentsOn(today);
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;
  return { today, appointments, balances };
});

async function TodayIs() {
  return `Hoy es ${formatDay(await clinicToday())}.`;
}

async function TodayStats({ money }: { money: boolean }) {
  const { today, appointments, balances } = await getToday(money);
  const rate = money ? await getRate(today) : null;
  const billed = appointments.filter((a) => !UNBILLED_STATUSES.includes(a.status));
  const charged = balances ? sumCents(billed.map((a) => balances.get(a.id)?.total ?? 0)) : 0n;
  const pending = balances ? sumCents(billed.map((a) => Math.max(0, balances.get(a.id)?.balance ?? 0))) : 0n;
  const waiting = appointments.filter((a) => a.status === "checked_in").length;
  const values: [string, string][] = [
    [String(appointments.length), `${waiting} en sala ahora`],
    [formatUsd(pending), `De ${formatUsd(charged)} en servicios`],
    rate ? [`Bs. ${formatRate(rate.bs_per_usd)}`, "Bolívares por dólar"] : ["Sin cargar", "Cárgala antes de cobrar"],
  ];

  return statsFor(money).map((label, i) => <StatCard key={label} label={label} value={values[i][0]} hint={values[i][1]} />);
}

async function TodayAppointments({ viewer }: { viewer: Viewer }) {
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const [{ appointments, balances }, professionals] = await Promise.all([
    getToday(p.collectPayments),
    getProfessionals(),
  ]);

  if (!appointments.length) {
    return (
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
    );
  }
  return (
    <AppointmentList
      appointments={appointments}
      professionals={professionals.byId}
      balances={balances}
      highlight={own ? viewer.id : undefined}
    />
  );
}

async function MissingRate() {
  const today = await clinicToday();
  const [rate, recentRates] = await Promise.all([getRate(today), getRecentRates(today, 2)]);
  if (rate) return null;
  return (
    <Card>
      <CardHeader title="Tasa BCV de hoy" hint="Hace falta para cobrar en bolívares y en dólares" />
      <div className="px-5 py-4">
        <RateForm day={today} current={null} suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null} />
      </div>
    </Card>
  );
}
