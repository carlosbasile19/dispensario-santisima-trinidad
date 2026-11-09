import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, RowsSkeleton, Skeleton, td, th } from "@/components/crm/ui";
import { ageOn, clinicToday, formatDay, formatDocument, localDay, param, patientName } from "@/lib/crm/clinic";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pacientes" };

const LIMIT = 100;

// Patients: doctors see the patients they have a service with (RLS), every
// other profile all of them. The front desk registers new ones here. The
// search (?q=) and its results stream into the card.
export default async function PatientsPage({ searchParams }: PageProps<"/dashboard/pacientes">) {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={own ? "Mis pacientes" : "Pacientes"}
        description={own ? "Los pacientes con los que tienes un servicio agendado." : "Los pacientes registrados en el centro."}
        actions={
          viewer.permissions.manageSchedule && (
            <Link
              href="/dashboard/pacientes/nuevo"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
            >
              <Icon name="plus" className="size-4" />
              Registrar paciente
            </Link>
          )
        }
      />

      <Card className="overflow-x-auto">
        <Suspense
          fallback={
            <>
              <CardHeader
                title={<Skeleton className="w-24" />}
                hint={<Skeleton className="w-48" />}
                action={<span className="h-9 w-[244px] rounded-lg border border-line bg-white sm:w-[304px]" />}
              />
              <RowsSkeleton rows={5} />
            </>
          }
        >
          <PatientTable searchParams={searchParams} viewer={viewer} />
        </Suspense>
      </Card>
    </div>
  );
}

async function PatientTable({
  searchParams,
  viewer,
}: {
  searchParams: PageProps<"/dashboard/pacientes">["searchParams"];
  viewer: Viewer;
}) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const query = param(params.q).trim().slice(0, 80);
  const own = viewer.permissions.schedule === "own";

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_patients", { query, max_rows: LIMIT });
  const patients = data ?? [];

  return (
    <>
      <CardHeader
        title={query ? `Resultados para “${query}”` : "Todos"}
        hint={`${patients.length === LIMIT ? `Los primeros ${LIMIT}` : patients.length} ${patients.length === 1 ? "paciente" : "pacientes"}, por apellido`}
        action={
          <form action="/dashboard/pacientes" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Nombre o cédula"
              aria-label="Buscar paciente"
              className="h-9 w-[200px] rounded-lg border border-outline bg-white px-3 text-sm outline-none focus:border-navy sm:w-[260px]"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="grid size-9 place-items-center rounded-lg border border-outline bg-white hover:border-navy"
            >
              <Icon name="search" className="size-4" />
            </button>
          </form>
        }
      />
      {patients.length ? (
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Paciente</th>
              <th className={th}>Documento</th>
              <th className={th}>Edad</th>
              <th className={th}>Teléfono</th>
              <th className={th}>Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-cream">
                <td className={td}>
                  <Link href={`/dashboard/pacientes/${p.id}`} className="flex items-center gap-3 font-medium hover:text-teal">
                    <Avatar name={patientName(p)} size="sm" />
                    {p.last_name}, {p.first_name}
                  </Link>
                </td>
                <td className={`${td} font-mono text-[13px] whitespace-nowrap`}>{formatDocument(p) ?? "—"}</td>
                <td className={td}>{p.birth_date ? `${ageOn(p.birth_date, today)} años` : "—"}</td>
                <td className={`${td} whitespace-nowrap`}>{p.phone ?? "—"}</td>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDay(localDay(p.created_at), "short")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          icon="patients"
          title={query ? "Nadie coincide con esa búsqueda" : "Todavía no hay pacientes"}
          action={
            viewer.permissions.manageSchedule ? (
              <Link href="/dashboard/pacientes/nuevo" className="text-sm font-medium text-teal hover:text-navy">
                Registrar paciente
              </Link>
            ) : undefined
          }
        >
          {query
            ? "Busca por nombre, apellido o número de cédula."
            : own
              ? "Aquí aparecerán los pacientes cuando te asignen un servicio en la agenda."
              : "Registra el primero o agéndalo desde la agenda."}
        </EmptyState>
      )}
    </>
  );
}
