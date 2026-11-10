import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { Modal } from "@/components/crm/modal";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, RowsSkeleton, Skeleton } from "@/components/crm/ui";
import { UNBILLED_STATUSES, ageOn, clinicToday, formatDay, formatDocument, isUuid, localDay, patientName } from "@/lib/crm/clinic";
import { getBalances, getPatientAppointments, getProfessionals } from "@/lib/crm/data";
import { listLabReports } from "@/lib/lab/data";
import { reportNumber } from "@/lib/lab/report";
import { formatUsd } from "@/lib/crm/money";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { PatientForm } from "../patient-form";

export const metadata: Metadata = { title: "Paciente" };

type Params = PageProps<"/dashboard/pacientes/[id]">["params"];

// A patient's page: identification and contact, their visits and, for those
// who handle money, what they still owe. RLS hides patients a doctor has no
// service with, so those land on not-found. All of it comes from the patient,
// so the App Shell has only the frame of the cards; the record streams in.
export default async function PatientPage({ params }: PageProps<"/dashboard/pacientes/[id]">) {
  const viewer = await getViewer();
  return (
    <Suspense fallback={<PatientSkeleton />}>
      <Patient params={params} viewer={viewer} />
    </Suspense>
  );
}

function PatientSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Pacientes" title={<Skeleton className="w-72" />} description={<Skeleton className="w-24" />} />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Próximas citas" />
            <RowsSkeleton rows={1} />
          </Card>
          <Card>
            <CardHeader title="Historial" hint="Citas anteriores, de la más reciente a la más antigua" />
            <RowsSkeleton rows={3} />
          </Card>
        </div>
        <Card>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <span className="size-9 shrink-0 animate-pulse rounded-full bg-sand" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <Skeleton className="w-40" />
              </p>
              <p className="text-[13px] text-muted">
                <Skeleton className="w-32" />
              </p>
            </div>
          </div>
          <RowsSkeleton rows={6} dense />
        </Card>
      </div>
    </div>
  );
}

async function Patient({ params, viewer }: { params: Params; viewer: Viewer }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, id_type, id_number, birth_date, sex, phone, email, address, notes, created_at, whatsapp_consent")
    .eq("id", id)
    .maybeSingle();
  if (!patient) notFound();

  const p = viewer.permissions;
  const money = p.collectPayments || p.accounting;
  const today = await clinicToday();
  const [appointments, professionals, labReports] = await Promise.all([
    getPatientAppointments(id),
    getProfessionals(),
    listLabReports({ patientIds: [id], limit: 10 }),
  ]);
  const balances = money ? await getBalances(appointments.map((a) => a.id)) : undefined;
  // What is owed for visits up to today; future visits are not due yet.
  const owed = balances
    ? appointments
        .filter((a) => !UNBILLED_STATUSES.includes(a.status) && a.starts_on && a.starts_on <= today)
        .reduce((sum, a) => sum + Math.max(0, balances.get(a.id)?.balance ?? 0), 0)
    : 0;
  const upcoming = appointments.filter((a) => a.starts_on && a.starts_on >= today).reverse();
  const past = appointments.filter((a) => !a.starts_on || a.starts_on < today);

  const name = patientName(patient);
  const facts: [string, string][] = [
    ["Documento", formatDocument(patient) ?? "Sin cédula"],
    ["Nacimiento", patient.birth_date ? `${formatDay(patient.birth_date, "short")} · ${ageOn(patient.birth_date, today)} años` : "—"],
    ["Sexo", patient.sex === "F" ? "Femenino" : patient.sex === "M" ? "Masculino" : "—"],
    ["Teléfono", patient.phone ?? "—"],
    ["WhatsApp", patient.whatsapp_consent === true ? "Acepta mensajes" : patient.whatsapp_consent === false ? "No acepta mensajes" : "Sin preguntar"],
    ["Correo", patient.email ?? "—"],
    ["Dirección", patient.address ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pacientes"
        title={name}
        description={`${appointments.length} ${appointments.length === 1 ? "cita" : "citas"}${money && owed > 0 ? ` · debe ${formatUsd(owed)}` : ""}`}
        actions={
          <>
            {p.labReports && (
              <Link
                href={`/dashboard/laboratorio/nuevo?paciente=${patient.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy"
              >
                <Icon name="flask" className="size-4" />
                Informe de laboratorio
              </Link>
            )}
            {p.manageSchedule && (
              <Link
                href={`/dashboard/agenda/nueva?paciente=${patient.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
              >
                <Icon name="calendar" className="size-4" />
                Agendar cita
              </Link>
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Próximas citas" />
            {upcoming.length ? (
              <AppointmentList appointments={upcoming} professionals={professionals.byId} balances={balances} showDate />
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No tiene citas agendadas.</p>
            )}
          </Card>
          {(labReports.length > 0 || p.labReports) && (
            <Card>
              <CardHeader title="Laboratorio" hint="Informes de resultados de este paciente" />
              {labReports.length ? (
                <ul className="divide-y divide-line">
                  {labReports.map((r) => (
                    <li key={r.id}>
                      <Link href={`/dashboard/laboratorio/${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-cream">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint/25 text-[#135c62]">
                          <Icon name="flask" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.summary.join(" · ") || "Sin exámenes"}</span>
                          <span className="block text-[13px] text-muted">
                            Nº {reportNumber(r.number)} · muestra del {formatDay(localDay(r.sampledAt), "short")}
                          </span>
                        </span>
                        {r.status === "final" ? <Badge tone="teal">Validado</Badge> : <Badge tone="outline">Borrador</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted">Todavía no tiene informes de laboratorio.</p>
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Historial" hint="Citas anteriores, de la más reciente a la más antigua" />
            {past.length ? (
              <AppointmentList appointments={past} professionals={professionals.byId} balances={balances} showDate />
            ) : (
              <EmptyState icon="calendar" title="Sin citas anteriores">
                Aquí aparecerán sus visitas al centro.
              </EmptyState>
            )}
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate font-medium">{name}</p>
              <p className="text-[13px] text-muted">Registrado el {formatDay(localDay(patient.created_at), "short")}</p>
            </div>
          </div>
          <dl className="grid gap-3 px-5 py-4 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[100px_1fr] gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
            {patient.notes && (
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <dt className="text-muted">Notas</dt>
                <dd className="min-w-0 whitespace-pre-line">{patient.notes}</dd>
              </div>
            )}
          </dl>
          {p.manageSchedule && (
            <div className="border-t border-line px-5 py-3.5">
              <Modal
                trigger="Editar datos"
                triggerIcon="patients"
                title="Editar paciente"
                description={name}
                icon="patients"
                size="lg"
              >
                <PatientForm patient={patient} today={today} inModal />
              </Modal>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
