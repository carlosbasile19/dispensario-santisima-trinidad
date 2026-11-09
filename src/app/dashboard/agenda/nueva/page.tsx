import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { Avatar, Card, CardHeader, EmptyState, NoAccess, PageHeader } from "@/components/crm/ui";
import { ageOn, clinicToday, formatDocument, isIsoDate, isUuid, param, patientName } from "@/lib/crm/clinic";
import { getProfessionals, getServices } from "@/lib/crm/data";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "Nueva cita" };

// Nueva cita (front desk and administrators). Step 1 finds the patient, or
// registers a new one and comes back; step 2 books the visit.
export default async function NewAppointmentPage({ searchParams }: PageProps<"/dashboard/agenda/nueva">) {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return <NoAccess role={viewer.role} section="Nueva cita" />;

  const params = await searchParams;
  const today = await clinicToday();
  const day = isIsoDate(param(params.fecha)) ? param(params.fecha) : today;
  const patientId = param(params.paciente);

  return (
    <div className="flex max-w-[1000px] flex-col gap-6">
      <PageHeader
        eyebrow="Agenda"
        title="Nueva cita"
        description="Elige el paciente y los servicios. Cada servicio lleva su profesional y su precio."
      />
      {isUuid(patientId) ? (
        <BookingStep patientId={patientId} day={day} today={today} />
      ) : (
        <PatientStep query={param(params.q)} day={day} />
      )}
    </div>
  );
}

async function PatientStep({ query, day }: { query: string; day: string }) {
  const supabase = await createClient();
  const { data } = query.trim()
    ? await supabase.rpc("search_patients", { query, max_rows: 20 })
    : { data: null };
  const results = data ?? [];
  const registerHref = `/dashboard/pacientes/nuevo?agendar=1&fecha=${day}`;

  return (
    <Card>
      <CardHeader
        title="1. Paciente"
        hint="Búscalo por nombre o cédula"
        action={
          <Link href={registerHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-navy">
            <Icon name="plus" className="size-4" />
            Paciente nuevo
          </Link>
        }
      />
      <form action="/dashboard/agenda/nueva" className="flex gap-2 px-5 py-4">
        <input type="hidden" name="fecha" value={day} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Nombre, apellido o cédula"
          aria-label="Buscar paciente"
          className="h-10 min-w-0 flex-1 rounded-lg border border-outline bg-white px-3 text-sm outline-none focus:border-navy"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
        >
          <Icon name="search" className="size-4" />
          Buscar
        </button>
      </form>

      {query.trim() &&
        (results.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {results.map((p) => {
              const document = formatDocument(p);
              return (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/agenda/nueva?paciente=${p.id}&fecha=${day}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-cream"
                  >
                    <Avatar name={patientName(p)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{patientName(p)}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {[document, p.phone].filter(Boolean).join(" · ") || "Sin cédula"}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-teal">Elegir</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="patients"
            title="No hay pacientes con esa búsqueda"
            action={
              <Link href={registerHref} className="text-sm font-medium text-teal hover:text-navy">
                Registrar paciente nuevo
              </Link>
            }
          >
            Revisa la ortografía o busca por cédula.
          </EmptyState>
        ))}
    </Card>
  );
}

async function BookingStep({ patientId, day, today }: { patientId: string; day: string; today: string }) {
  const supabase = await createClient();
  const [{ data: patient }, services, professionals, viewer] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, id_type, id_number, phone, birth_date").eq("id", patientId).maybeSingle(),
    getServices(),
    getProfessionals(),
    getViewer(),
  ]);
  const offered = services.filter((s) => s.active);

  if (!patient) {
    return (
      <Card>
        <EmptyState
          icon="patients"
          title="No encontramos ese paciente"
          action={
            <Link href={`/dashboard/agenda/nueva?fecha=${day}`} className="text-sm font-medium text-teal hover:text-navy">
              Buscar otro paciente
            </Link>
          }
        >
          Puede que el enlace esté incompleto.
        </EmptyState>
      </Card>
    );
  }

  const document = formatDocument(patient);
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Avatar name={patientName(patient)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{patientName(patient)}</p>
            <p className="truncate text-[13px] text-muted">
              {[
                document ?? "Sin cédula",
                patient.birth_date ? `${ageOn(patient.birth_date, today)} años` : null,
                patient.phone,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Link href={`/dashboard/agenda/nueva?fecha=${day}`} className="text-sm font-medium text-teal hover:text-navy">
            Cambiar paciente
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Cita" hint="Día, hora y servicios" />
        {offered.length ? (
          <AppointmentForm
            patientId={patient.id}
            day={day}
            services={offered}
            professionals={professionals.list}
          />
        ) : (
          <EmptyState
            icon="tag"
            title="El tarifario está vacío"
            action={
              viewer.permissions.accounting ? (
                <Link href="/dashboard/contabilidad/tarifas" className="text-sm font-medium text-teal hover:text-navy">
                  Cargar servicios y precios
                </Link>
              ) : undefined
            }
          >
            Para agendar hace falta al menos un servicio con su precio. Los carga Contabilidad.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
