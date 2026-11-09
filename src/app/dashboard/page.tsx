import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { Avatar, Card, CardHeader, PageHeader, PaymentBadge, Stat, StatusBadge, clock, usd } from "@/components/crm/ui";
import { APPOINTMENTS, DOCTORS, MOVEMENTS, SAMPLE_DAY, doctorById, patientById } from "@/lib/crm/sample-data";
import { getViewer, inScope } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

// Inicio: the day at a glance. Same layout for every role; the numbers and
// the agenda are scoped to what that role may see.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const { role, permissions } = viewer;

  const agenda = APPOINTMENTS.filter((a) => inScope(viewer, a.doctorId));
  const count = (...statuses: string[]) => agenda.filter((a) => statuses.includes(a.status)).length;
  const waiting = agenda.filter((a) => a.status === "en_sala");
  const next = agenda.find((a) => a.status === "confirmada" || a.status === "pendiente");
  const collected = MOVEMENTS.filter((m) => m.status === "cobrado").reduce((sum, m) => sum + m.amount, 0);
  const unpaid = agenda.filter((a) => a.payment === "por_cobrar" && a.status !== "no_asistio");

  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: permissions.schedule === "own" ? "Mis citas de hoy" : "Citas de hoy",
      value: String(agenda.length),
      hint: `Atendidas: ${count("atendida")}`,
    },
    { label: "En sala de espera", value: String(waiting.length), hint: `En consulta: ${count("en_consulta")}` },
  ];
  if (role === "admin") {
    stats.push(
      { label: "Ingresos del día", value: usd(collected), hint: `${MOVEMENTS.filter((m) => m.status === "cobrado").length} cobros` },
      { label: "Por cobrar", value: usd(unpaid.reduce((s, a) => s + a.price, 0)), hint: `${unpaid.length} citas` },
    );
  } else if (role === "staff") {
    stats.push(
      { label: "Por confirmar", value: String(count("pendiente")), hint: "Llamar o escribir por WhatsApp" },
      { label: "Cobros pendientes", value: String(unpaid.length), hint: "Antes de pasar a consulta" },
    );
  } else {
    stats.push(
      { label: "Próxima cita", value: next ? clock(next.time) : "—", hint: next ? patientById(next.patientId)?.name : "Sin más citas hoy" },
      role === "director"
        ? { label: "Médicos en turno", value: String(DOCTORS.length), hint: "Todas las áreas activas" }
        : { label: "No asistieron", value: String(count("no_asistio")), hint: "Hoy" },
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={SAMPLE_DAY}
        title={`Buen día, ${viewer.firstName}`}
        description={
          role === "doctor"
            ? "Esta es tu agenda de hoy y los pacientes que te esperan."
            : role === "director"
              ? "Así va el día en todos los consultorios del centro."
              : role === "staff"
                ? "Llegadas, confirmaciones y cobros de hoy."
                : "Resumen de la operación y los ingresos de hoy."
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title={permissions.schedule === "own" ? "Mi agenda de hoy" : "Agenda de hoy"}
            hint={`${agenda.length} citas`}
            action={
              <Link href="/dashboard/agenda" className="flex items-center gap-1 text-sm font-medium text-teal hover:text-navy">
                Ver agenda <Icon name="chevron" className="size-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {agenda.map((a) => {
              const patient = patientById(a.patientId)!;
              return (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/pacientes/${patient.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-cream"
                  >
                    <span className="w-[62px] font-mono text-[13px] text-ink tabular-nums">{clock(a.time)}</span>
                    <span className="min-w-0 flex-1 basis-[180px]">
                      <span className="block truncate text-sm font-medium">{patient.name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {a.service}
                        {permissions.schedule === "all" && ` · ${doctorById(a.doctorId).name}`}
                      </span>
                    </span>
                    {permissions.collectPayments && <PaymentBadge status={a.payment} />}
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Sala de espera" hint={waiting.length ? "Por orden de llegada" : undefined} />
            {waiting.length ? (
              <ul className="divide-y divide-line">
                {waiting.map((a) => {
                  const patient = patientById(a.patientId)!;
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Avatar name={patient.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{patient.name}</p>
                        <p className="truncate text-[13px] text-muted">
                          {doctorById(a.doctorId).room} · cita {clock(a.time)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">Nadie espera en este momento.</p>
            )}
          </Card>

          {permissions.schedule === "all" && (
            <Card>
              <CardHeader title="Consultorios" />
              <ul className="divide-y divide-line">
                {DOCTORS.map((d) => {
                  const mine = APPOINTMENTS.filter((a) => a.doctorId === d.id);
                  const done = mine.filter((a) => a.status === "atendida").length;
                  return (
                    <li key={d.id} className="px-5 py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="text-[13px] text-muted tabular-nums">
                          {done} de {mine.length}
                        </p>
                      </div>
                      <p className="text-[13px] text-muted">{d.specialty}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-sand">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${(done / mine.length) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
