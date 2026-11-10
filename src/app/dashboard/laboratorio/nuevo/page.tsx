import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Icon } from "@/components/crm/icons";
import { Avatar, Card, CardHeader, EmptyState, FormSkeleton, NoAccess, PageHeader, RowsSkeleton, Skeleton } from "@/components/crm/ui";
import { addDays, ageOn, clinicToday, formatDay, formatDocument, formatTime, isUuid, localDay, param, patientName } from "@/lib/crm/clinic";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { createLabReport } from "../actions";

export const metadata: Metadata = { title: "Nuevo informe de laboratorio" };

// Nuevo informe. Step 1 finds the patient (a doctor only finds their own
// patients); step 2 links the visit of the sample, when there is one, and
// opens the draft in the builder.
export default async function NewLabReportPage({ searchParams }: PageProps<"/dashboard/laboratorio/nuevo">) {
  const viewer = await getViewer();
  if (!viewer.permissions.labReports) return <NoAccess role={viewer.role} section="Nuevo informe" />;
  return (
    <div className="flex max-w-[900px] flex-col gap-6">
      <PageHeader
        eyebrow={
          <Link href="/dashboard/laboratorio" className="hover:text-navy">
            Laboratorio
          </Link>
        }
        title="Nuevo informe"
        description="Elige al paciente. Después agregas sus exámenes y cargas los resultados."
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

async function Step({ searchParams }: { searchParams: PageProps<"/dashboard/laboratorio/nuevo">["searchParams"] }) {
  const params = await searchParams;
  const patient = param(params.paciente);
  const visit = param(params.cita);
  return isUuid(patient) ? <VisitStep patientId={patient} preselected={isUuid(visit) ? visit : null} /> : <PatientStep query={param(params.q)} />;
}

function PatientStep({ query }: { query: string }) {
  return (
    <Card>
      <CardHeader title="1. Paciente" hint="Búscalo por nombre o cédula" />
      <form action="/dashboard/laboratorio/nuevo" className="flex gap-2 px-5 py-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Nombre, apellido o cédula"
          aria-label="Buscar paciente"
          className="h-10 min-w-0 flex-1 rounded-lg border border-outline bg-white px-3 text-sm outline-none focus:border-navy"
        />
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal">
          <Icon name="search" className="size-4" />
          Buscar
        </button>
      </form>
      <Suspense
        fallback={
          <div className="border-t border-line">
            <RowsSkeleton />
          </div>
        }
      >
        <PatientResults query={query} />
      </Suspense>
    </Card>
  );
}

async function PatientResults({ query }: { query: string }) {
  const [supabase, today] = await Promise.all([createClient(), clinicToday()]);
  // Without a search: the patients seen today and yesterday, the usual case for the lab.
  if (!query.trim()) {
    const { data: visits } = await supabase
      .from("appointments")
      .select("id, starts_at, status, patients(id, first_name, last_name, id_type, id_number, birth_date)")
      .gte("starts_on", addDays(today, -1))
      .lte("starts_on", today)
      .not("status", "in", "(cancelled,no_show)")
      .order("starts_at", { ascending: false })
      .limit(30);
    const seen = new Map<string, NonNullable<NonNullable<typeof visits>[number]["patients"]>>();
    for (const v of visits ?? []) if (v.patients && !seen.has(v.patients.id)) seen.set(v.patients.id, v.patients);
    if (!seen.size) {
      return <p className="border-t border-line px-5 py-4 text-sm text-muted">Busca al paciente por su nombre o su cédula.</p>;
    }
    return (
      <div className="border-t border-line">
        <p className="px-5 pt-3 text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Atendidos hoy y ayer</p>
        <PatientList patients={[...seen.values()]} today={today} />
      </div>
    );
  }
  const { data } = await supabase.rpc("search_patients", { query, max_rows: 20 });
  const results = data ?? [];
  if (!results.length) {
    return (
      <EmptyState icon="patients" title="No hay pacientes con esa búsqueda">
        Revisa la ortografía o busca por cédula. Los pacientes nuevos se registran en Pacientes.
      </EmptyState>
    );
  }
  return (
    <div className="border-t border-line">
      <PatientList patients={results} today={today} />
    </div>
  );
}

type PatientLike = { id: string; first_name: string; last_name: string; id_type: string | null; id_number: string | null; birth_date: string | null };

function PatientList({ patients, today }: { patients: PatientLike[]; today: string }) {
  return (
    <ul className="divide-y divide-line">
      {patients.map((p) => (
        <li key={p.id}>
          <Link href={`/dashboard/laboratorio/nuevo?paciente=${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-cream">
            <Avatar name={patientName(p)} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {p.last_name}, {p.first_name}
              </span>
              <span className="block text-[13px] text-muted">
                {[formatDocument(p) ?? "Sin cédula", p.birth_date ? `${ageOn(p.birth_date, today)} años` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Icon name="chevron-right" className="size-4 text-stone" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function VisitStep({ patientId, preselected }: { patientId: string; preselected: string | null }) {
  const [supabase, today] = await Promise.all([createClient(), clinicToday()]);
  const [{ data: patient }, { data: visits }] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, id_type, id_number, birth_date, sex").eq("id", patientId).maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, starts_on, status, appointment_items(services(name, area))")
      .eq("patient_id", patientId)
      .gte("starts_on", addDays(today, -21))
      .lte("starts_on", addDays(today, 1))
      .not("status", "in", "(cancelled,no_show)")
      .order("starts_at", { ascending: false })
      .limit(8),
  ]);
  if (!patient) notFound();

  const lab = (visits ?? []).map((v) => ({
    ...v,
    services: (v.appointment_items ?? []).map((i) => i.services).filter((s) => s?.area === "bioanalisis").map((s) => s!.name),
  }));
  const withLab = lab.filter((v) => v.services.length);
  const selected = preselected ?? withLab[0]?.id ?? "";

  return (
    <Card>
      <CardHeader
        title="2. Muestra"
        hint="Vincula la cita en la que se tomó la muestra: sus exámenes se sugieren en el informe"
        action={
          <Link href="/dashboard/laboratorio/nuevo" className="text-[13px] font-medium text-teal hover:text-navy">
            Cambiar paciente
          </Link>
        }
      />
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={patientName(patient)} />
        <div className="min-w-0">
          <p className="truncate font-medium">{patientName(patient)}</p>
          <p className="text-[13px] text-muted">
            {[formatDocument(patient) ?? "Sin cédula", patient.birth_date ? `${ageOn(patient.birth_date, today)} años` : null, patient.sex === "F" ? "Femenino" : patient.sex === "M" ? "Masculino" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <ActionForm action={createLabReport} className="flex flex-col gap-4 px-5 py-5">
        <input type="hidden" name="patient" value={patient.id} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] text-muted">Cita de la muestra</legend>
          {lab.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-checked:border-teal has-checked:bg-mint/10">
              <input type="radio" name="appointment" value={v.id} defaultChecked={v.id === selected} className="size-4 accent-[#1e7e86]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {formatDay(localDay(v.starts_at), "long")} · {formatTime(v.starts_at)}
                </span>
                <span className="block truncate text-[13px] text-muted">{v.services.length ? v.services.join(", ") : "Sin servicios de bioanálisis"}</span>
              </span>
              {v.services.length > 0 && <Icon name="flask" className="size-4 text-teal" />}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-checked:border-teal has-checked:bg-mint/10">
            <input type="radio" name="appointment" value="" defaultChecked={!selected} className="size-4 accent-[#1e7e86]" />
            <span className="text-sm">Sin cita (muestra sin agendar)</span>
          </label>
        </fieldset>
        <div>
          <SubmitButton icon="flask" pendingLabel="Creando…">
            Crear informe
          </SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
