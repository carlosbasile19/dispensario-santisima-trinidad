import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  FormSkeleton,
  NoAccess,
  PageHeader,
  RowsSkeleton,
  Skeleton,
} from "@/components/crm/ui";
import { ageOn, clinicToday, formatDocument, isIsoDate, isTime, isUuid, param, patientName } from "@/lib/crm/clinic";
import { getProfessionals, getServices } from "@/lib/crm/data";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "Nueva cita" };

// Nueva cita (front desk and administrators). Step 1 finds the patient, or
// registers a new one and comes back; step 2 books the visit. The step comes
// from the URL, so it streams in below the header. A free half hour of a
// calendar's week opens it with ?fecha=, ?hora= and ?profesional=, which
// both steps carry along and the booking form starts from.
export default async function NewAppointmentPage({ searchParams }: PageProps<"/dashboard/agenda/nueva">) {
  const viewer = await getViewer();
  if (!viewer.permissions.manageSchedule) return <NoAccess role={viewer.role} section="Nueva cita" />;

  return (
    <div className="flex max-w-[1000px] flex-col gap-6">
      <PageHeader
        eyebrow="Agenda"
        title="Nueva cita"
        description="Elige el paciente y los servicios. Cada servicio lleva su profesional y su precio."
      />
      <Suspense
        fallback={
          <Card>
            <CardHeader title={<Skeleton className="w-24" />} hint={<Skeleton className="w-44" />} />
            <FormSkeleton className="px-5 py-4" />
          </Card>
        }
      >
        <Step searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Step({ searchParams }: { searchParams: PageProps<"/dashboard/agenda/nueva">["searchParams"] }) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const day = isIsoDate(param(params.fecha)) ? param(params.fecha) : today;
  const time = isTime(param(params.hora)) ? param(params.hora) : undefined;
  const professionalId = isUuid(param(params.profesional)) ? param(params.profesional) : undefined;
  const patientId = param(params.paciente);
  const slot: Slot = { day, time, professionalId };

  return isUuid(patientId) ? (
    <BookingStep patientId={patientId} slot={slot} />
  ) : (
    <PatientStep query={param(params.q)} slot={slot} />
  );
}

/** The day, and when coming from a calendar the time and professional, that both steps carry along. */
type Slot = { day: string; time?: string; professionalId?: string };

const slotQuery = ({ day, time, professionalId }: Slot) => {
  const query = new URLSearchParams({ fecha: day });
  if (time) query.set("hora", time);
  if (professionalId) query.set("profesional", professionalId);
  return query.toString();
};

function PatientStep({ query, slot }: { query: string; slot: Slot }) {
  const registerHref = `/dashboard/pacientes/nuevo?agendar=1&${slotQuery(slot)}`;

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
        <input type="hidden" name="fecha" value={slot.day} />
        {slot.time && <input type="hidden" name="hora" value={slot.time} />}
        {slot.professionalId && <input type="hidden" name="profesional" value={slot.professionalId} />}
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

      {query.trim() && (
        <Suspense
          fallback={
            <div className="border-t border-line">
              <RowsSkeleton />
            </div>
          }
        >
          <PatientResults query={query} slot={slot} registerHref={registerHref} />
        </Suspense>
      )}
    </Card>
  );
}

async function PatientResults({ query, slot, registerHref }: { query: string; slot: Slot; registerHref: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_patients", { query, max_rows: 20 });
  const results = data ?? [];

  if (!results.length) {
    return (
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
    );
  }
  return (
    <ul className="divide-y divide-line border-t border-line">
      {results.map((p) => {
        const document = formatDocument(p);
        return (
          <li key={p.id}>
            <Link
              href={`/dashboard/agenda/nueva?paciente=${p.id}&${slotQuery(slot)}`}
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
  );
}

async function BookingStep({ patientId, slot }: { patientId: string; slot: Slot }) {
  const { day } = slot;
  const supabase = await createClient();
  const [{ data: patient }, services, professionals, viewer, today] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, id_type, id_number, phone, birth_date").eq("id", patientId).maybeSingle(),
    getServices(),
    getProfessionals(),
    getViewer(),
    clinicToday(),
  ]);
  const offered = services.filter((s) => s.active);

  if (!patient) {
    return (
      <Card>
        <EmptyState
          icon="patients"
          title="No encontramos ese paciente"
          action={
            <Link href={`/dashboard/agenda/nueva?${slotQuery(slot)}`} className="text-sm font-medium text-teal hover:text-navy">
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
          <Link href={`/dashboard/agenda/nueva?${slotQuery(slot)}`} className="text-sm font-medium text-teal hover:text-navy">
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
            time={slot.time}
            professionalId={slot.professionalId}
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
