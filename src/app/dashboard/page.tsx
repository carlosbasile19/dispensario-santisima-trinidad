import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { RateForm } from "@/components/crm/rate-form";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/crm/ui";
import { UNBILLED_STATUSES, clinicToday, formatDay } from "@/lib/crm/clinic";
import { getAppointmentsOn, getBalances, getProfessionals, getRate, getRecentRates } from "@/lib/crm/data";
import { formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

const INTRO = {
  doctor: "Tu agenda de hoy: los pacientes con los que tienes un servicio.",
  director: "Cómo va el día en todos los consultorios del centro.",
  staff: "Las citas, llegadas y cobros de hoy.",
  admin: "La operación de hoy: citas, cobros y la tasa BCV.",
} as const;

// Inicio: today at a glance. Everyone sees today's appointments (a doctor
// only their own, via RLS); members who take payments also see today's BCV
// rate and what has been charged and collected.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const p = viewer.permissions;
  const own = p.schedule === "own";
  const money = p.collectPayments;
  const today = clinicToday();

  const [appointments, professionals, rate, recentRates] = await Promise.all([
    getAppointmentsOn(today),
    getProfessionals(),
    money ? getRate(today) : null,
    money ? getRecentRates(today, 2) : [],
  ]);
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;
  const billed = appointments.filter((a) => !UNBILLED_STATUSES.includes(a.status));
  const charged = balances ? sumCents(billed.map((a) => balances.get(a.id)?.total ?? 0)) : 0n;
  const pending = balances ? sumCents(billed.map((a) => Math.max(0, balances.get(a.id)?.balance ?? 0))) : 0n;
  const waiting = appointments.filter((a) => a.status === "checked_in").length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Buen día, ${viewer.firstName}`}
        description={`${INTRO[viewer.role]} Hoy es ${formatDay(today)}.`}
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
        {[
          ["Citas de hoy", String(appointments.length), `${waiting} en sala ahora`],
          ...(money
            ? [
                ["Por cobrar hoy", formatUsd(pending), `De ${formatUsd(charged)} en servicios`],
                ["Tasa BCV de hoy", rate ? `Bs. ${formatRate(rate.bs_per_usd)}` : "Sin cargar", rate ? "Bolívares por dólar" : "Cárgala antes de cobrar"],
              ]
            : []),
        ].map(([label, value, hint]) => (
          <Card key={label} className="px-5 py-4">
            <p className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</p>
            <p className="mt-1.5 font-mono text-xl">{value}</p>
            <p className="mt-1 text-[13px] text-muted">{hint}</p>
          </Card>
        ))}
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

        {money && !rate && (
          <Card>
            <CardHeader title="Tasa BCV de hoy" hint="Hace falta para cobrar en bolívares y en dólares" />
            <div className="px-5 py-4">
              <RateForm day={today} current={null} suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
