import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { TodayRateCard } from "@/components/crm/today-rate";
import { Card, CardHeader, EmptyState, PageHeader, StatGrid, type Stat } from "@/components/crm/ui";
import {
  AREA_ICON,
  AREA_LABEL,
  SERVICE_AREAS,
  UNBILLED_STATUSES,
  clinicToday,
  formatDay,
  type AppointmentStatus,
} from "@/lib/crm/clinic";
import { getAppointmentsOn, getBalances, getProfessionals, getRecentRates, getTodayRate } from "@/lib/crm/data";
import { formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

const INTRO = {
  doctor: "Tu agenda de hoy: los pacientes con los que tienes un servicio.",
  director: "Cómo va el día en todos los consultorios del centro.",
  staff: "Las citas, llegadas y cobros de hoy.",
  admin: "La operación de hoy: citas, cobros y la tasa BCV.",
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Inicio: today at a glance, laid out like Agenda. A row of key figures, then
// today's appointments (a doctor only their own, via RLS) beside a rail with
// the day's services by area and, while it is missing, today's BCV rate for
// the members who take payments.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const money = p.collectPayments;
  const today = await clinicToday();

  const [appointments, professionals, rate, recentRates] = await Promise.all([
    getAppointmentsOn(today),
    getProfessionals(),
    money ? getTodayRate(today) : null,
    money ? getRecentRates(today, 2) : [],
  ]);
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;

  const count = (...statuses: AppointmentStatus[]) => appointments.filter((a) => statuses.includes(a.status)).length;
  const expected = count("scheduled", "confirmed");
  const waiting = count("checked_in");
  const dropped = count(...UNBILLED_STATUSES);
  const billed = appointments.filter((a) => !UNBILLED_STATUSES.includes(a.status));
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

  // The day's services by area: a doctor's own, everyone else's the whole centre's.
  const services = billed.flatMap((a) =>
    a.items
      .filter((item) => !own || item.professional_id === viewer.id)
      .map((item) => ({ area: item.service?.area, done: a.status === "completed" })),
  );
  const areas = SERVICE_AREAS.map((area) => {
    const list = services.filter((s) => s.area === area);
    return { area, total: list.length, done: list.filter((s) => s.done).length };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`Hoy · ${formatDay(today)}`}
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

      <StatGrid stats={stats} />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title={own ? "Mi agenda de hoy" : "Agenda de hoy"}
            hint={appointments.length ? `${plural(appointments.length, "cita", "citas")}, por hora` : "Ninguna cita agendada"}
            action={
              <Link href="/dashboard/agenda" className="text-sm font-medium whitespace-nowrap text-teal hover:text-navy">
                Ver agenda
              </Link>
            }
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
        </Card>

        <div className="flex flex-col gap-6">
          {/* The rate is a key figure above; its card only shows when it still has to be loaded. */}
          {money && !rate && <TodayRateCard today={today} rate={rate} recentRates={recentRates} />}

          <Card>
            <CardHeader title="Por área" hint={own ? "Tus servicios de hoy" : "Los servicios de hoy en el centro"} />
            <ul className="divide-y divide-line">
              {areas.map(({ area, total, done }) => (
                <li key={area} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${
                      total ? "bg-frost text-navy" : "bg-sand text-stone"
                    }`}
                  >
                    <Icon name={AREA_ICON[area]} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className={`text-sm font-medium ${total ? "" : "text-stone"}`}>{AREA_LABEL[area]}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {!total ? "Sin servicios hoy" : done ? plural(done, "atendido", "atendidos") : "Ninguno atendido aún"}
                    </p>
                  </div>
                  <span className={`font-mono text-lg ${total ? "" : "text-stone"}`}>{total}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
