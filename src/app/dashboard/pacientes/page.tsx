import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Pagination } from "@/components/crm/pagination";
import { SearchForm } from "@/components/crm/search-form";
import { Icon } from "@/components/crm/icons";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, RowsSkeleton, Skeleton, td, th } from "@/components/crm/ui";
import { ageOn, clinicToday, formatDay, formatDocument, localDay, param, patientName } from "@/lib/crm/clinic";
import { PAGE_SIZE, pageNumber } from "@/lib/crm/pagination";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pacientes" };

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
  const page = pageNumber(params.pagina);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_patients_page", {
    query, page_offset: (page - 1) * PAGE_SIZE, page_size: PAGE_SIZE + 1,
  });
  if (error) throw new Error("No se pudieron cargar los pacientes.");
  const patients = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data?.length ?? 0) > PAGE_SIZE;

  return (
    <>
      <CardHeader
        title={query ? `Resultados para “${query}”` : "Todos"}
        hint={`${patients.length} ${patients.length === 1 ? "paciente" : "pacientes"} en esta página, por apellido`}
        action={
          <SearchForm path="/dashboard/pacientes" query={query} placeholder="Nombre o cédula" label="Buscar paciente" />
        }
      />
      {patients.length ? (
        <>
        {/* Phones and upright tablets: one row per patient, the whole row opens the record. */}
        <ul className="divide-y divide-line lg:hidden">
          {patients.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/pacientes/${p.id}`} className="flex items-center gap-3.5 px-4 py-3.5 active:bg-cream sm:px-5">
                <Avatar name={patientName(p)} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-medium">
                    {p.last_name}, {p.first_name}
                  </span>
                  <span className="mt-1 block truncate text-[13px] text-muted">
                    {[formatDocument(p) ?? "Sin cédula", p.birth_date && `${ageOn(p.birth_date, today)} años`, p.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Icon name="chevron-right" className="size-4 text-stone" />
              </Link>
            </li>
          ))}
        </ul>
        <table className="hidden w-full min-w-[720px] border-collapse lg:table">
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
        </>
      ) : (
        <EmptyState
          icon="patients"
          title={page > 1 ? "No hay más pacientes en esta página" : query ? "Nadie coincide con esa búsqueda" : "Todavía no hay pacientes"}
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
      <Pagination path="/dashboard/pacientes" filters={{ q: query }} page={page} hasNext={hasNext} />
    </>
  );
}
