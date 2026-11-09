import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentList } from "@/components/crm/appointment-list";
import { Icon } from "@/components/crm/icons";
import { Modal } from "@/components/crm/modal";
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from "@/components/crm/ui";
import { UNBILLED_STATUSES, ageOn, clinicToday, formatDay, formatDocument, isUuid, localDay, patientName } from "@/lib/crm/clinic";
import { getBalances, getPatientAppointments, getProfessionals } from "@/lib/crm/data";
import { formatUsd } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { PatientForm } from "../patient-form";

export const metadata: Metadata = { title: "Paciente" };

// A patient's page: identification and contact, their visits and, for those
// who handle money, what they still owe. RLS hides patients a doctor has no
// service with, so those land on not-found.
export default async function PatientPage({ params }: PageProps<"/dashboard/pacientes/[id]">) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, id_type, id_number, birth_date, sex, phone, email, address, notes, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!patient) notFound();

  const p = viewer.permissions;
  const money = p.collectPayments || p.accounting;
  const today = clinicToday();
  const [appointments, professionals] = await Promise.all([getPatientAppointments(id), getProfessionals()]);
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
          p.manageSchedule && (
            <Link
              href={`/dashboard/agenda/nueva?paciente=${patient.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
            >
              <Icon name="calendar" className="size-4" />
              Agendar cita
            </Link>
          )
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
