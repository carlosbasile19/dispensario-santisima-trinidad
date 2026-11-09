import type { Metadata } from "next";

import { Card, CardHeader, NoAccess, PageHeader } from "@/components/crm/ui";
import { clinicToday, isIsoDate, param } from "@/lib/crm/clinic";
import { getViewer } from "@/lib/crm/viewer";
import { PatientForm } from "../patient-form";

export const metadata: Metadata = { title: "Registrar paciente" };

// Registers a patient (front desk and administrators). Opened from
// "Nueva cita" (?agendar=1), it continues to booking once saved.
export default async function NewPatientPage({ searchParams }: PageProps<"/dashboard/pacientes/nuevo">) {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return <NoAccess role={viewer.role} section="Registrar paciente" />;

  const params = await searchParams;
  const thenBook = param(params.agendar) === "1";
  const day = param(params.fecha);

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <PageHeader
        eyebrow={thenBook ? "Nueva cita" : "Pacientes"}
        title="Registrar paciente"
        description={
          thenBook
            ? "Registra sus datos y sigue directo a agendar la cita."
            : "Los datos de contacto e identificación. La historia clínica se lleva aparte."
        }
      />
      <Card>
        <CardHeader title="Datos del paciente" hint="Solo los nombres y los apellidos son obligatorios" />
        <PatientForm thenBook={thenBook} day={isIsoDate(day) ? day : undefined} today={clinicToday()} />
      </Card>
    </div>
  );
}
