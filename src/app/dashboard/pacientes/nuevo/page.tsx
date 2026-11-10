import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardHeader, FormSkeleton, NoAccess, PageHeader, Skeleton } from "@/components/crm/ui";
import { clinicToday, isIsoDate, isTime, isUuid, param } from "@/lib/crm/clinic";
import { getViewer } from "@/lib/crm/viewer";
import { PatientForm } from "../patient-form";

export const metadata: Metadata = { title: "Registrar paciente" };

type SearchParams = PageProps<"/dashboard/pacientes/nuevo">["searchParams"];

// Registers a patient (front desk and administrators). Opened from
// "Nueva cita" (?agendar=1), it continues to booking once saved. That flag
// and the clinic clock (the latest birth date) stream in; the rest is static.
export default async function NewPatientPage({ searchParams }: PageProps<"/dashboard/pacientes/nuevo">) {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return <NoAccess role={viewer.role} section="Registrar paciente" />;

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <Suspense
        fallback={
          <PageHeader
            eyebrow={<Skeleton className="w-20" />}
            title="Registrar paciente"
            description={<Skeleton className="w-80" />}
          />
        }
      >
        <Header searchParams={searchParams} />
      </Suspense>
      <Card>
        <CardHeader title="Datos del paciente" hint="Solo los nombres y los apellidos son obligatorios" />
        <Suspense fallback={<FormSkeleton fields={6} className="px-5 py-5 sm:grid-cols-2" />}>
          <NewPatientForm searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

const thenBook = (params: Awaited<SearchParams>) => param(params.agendar) === "1";

async function Header({ searchParams }: { searchParams: SearchParams }) {
  const book = thenBook(await searchParams);
  return (
    <PageHeader
      eyebrow={book ? "Nueva cita" : "Pacientes"}
      title="Registrar paciente"
      description={
        book
          ? "Registra sus datos y sigue directo a agendar la cita."
          : "Los datos de contacto e identificación. La historia clínica se lleva aparte."
      }
    />
  );
}

async function NewPatientForm({ searchParams }: { searchParams: SearchParams }) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const day = param(params.fecha);
  const time = param(params.hora);
  const professional = param(params.profesional);
  return (
    <PatientForm
      thenBook={thenBook(params)}
      day={isIsoDate(day) ? day : undefined}
      time={isTime(time) ? time : undefined}
      professionalId={isUuid(professional) ? professional : undefined}
      today={today}
    />
  );
}
