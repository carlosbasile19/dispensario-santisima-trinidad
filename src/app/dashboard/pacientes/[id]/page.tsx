import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import {
  Avatar, Badge, Button, Card, CardHeader, Locked, NoAccess, PaymentBadge, StatusBadge, clock, usd,
} from "@/components/crm/ui";
import { APPOINTMENTS, DOCUMENTS, doctorById, patientById } from "@/lib/crm/sample-data";
import { canDownloadDocuments, canEditClinical, canReadClinical, getViewer, inScope } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Paciente" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Tags({ items, empty, tone }: { items: string[]; empty: string; tone?: "coral" }) {
  if (!items.length) return <span className="text-stone">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} tone={tone}>
          {item}
        </Badge>
      ))}
    </span>
  );
}

// Patient record. Personal data and appointments on the left; clinical
// history and documents on the right. Reading, writing and downloading are
// separate permissions: operational staff read and download but cannot edit.
//
// The record reads the URL and the session, so it streams inside its own
// <Suspense>: the page shell stays the same for every patient link.
export default function PatientPage({ params }: PageProps<"/dashboard/pacientes/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <PatientRecord params={params} />
    </Suspense>
  );
}

async function PatientRecord({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  const patient = patientById(id);
  if (!patient) notFound();
  if (!inScope(viewer, patient.doctorId)) return <NoAccess role={viewer.role} section="este paciente" />;

  const clinical = canReadClinical(viewer, patient);
  const editable = canEditClinical(viewer, patient);
  const documents = DOCUMENTS.filter((d) => d.patientId === patient.id);
  const doctor = doctorById(patient.doctorId);
  const visits = APPOINTMENTS.filter((a) => a.patientId === patient.id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/pacientes" className="flex items-center gap-1 self-start text-sm text-muted hover:text-navy">
        <Icon name="chevron" className="size-3.5 rotate-180" /> Pacientes
      </Link>

      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <Avatar name={patient.name} size="lg" />
        <div className="min-w-0 flex-1 basis-[240px]">
          <h1 className="font-serif text-[clamp(28px,3vw,36px)] leading-tight">{patient.name}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {patient.age} años · {patient.sex === "F" ? "Femenino" : "Masculino"} ·{" "}
            <span className="font-mono text-[13px]">{patient.cedula}</span> · Paciente desde{" "}
            {patient.since}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewer.permissions.manageSchedule && <Button variant="secondary" icon="calendar">Agendar cita</Button>}
          {editable && <Button icon="plus">Nueva nota</Button>}
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Datos personales" />
            <dl className="grid gap-4 px-5 py-4">
              <Field label="Teléfono">{patient.phone}</Field>
              <Field label="Dirección">{patient.address}</Field>
              <Field label="Médico tratante">
                {doctor.name} · {doctor.specialty}
              </Field>
              <Field label="Última visita">{patient.lastVisit}</Field>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Citas de hoy" />
            {visits.length ? (
              <ul className="divide-y divide-line">
                {visits.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{a.service}</p>
                      <p className="font-mono text-[13px] text-ink">{clock(a.time)}</p>
                    </div>
                    <p className="text-[13px] text-muted">{doctorById(a.doctorId).name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={a.status} />
                      {viewer.permissions.collectPayments && (
                        <>
                          <PaymentBadge status={a.payment} />
                          <span className="ml-auto text-sm tabular-nums">{usd(a.price)}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-sm text-muted">Sin citas hoy. Próxima: {patient.nextVisit ?? "sin agendar"}.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Historia clínica"
            hint={clinical ? `Grupo sanguíneo ${patient.bloodType}` : undefined}
            action={
              clinical && !editable ? (
                <Badge tone="outline">
                  <Icon name="eye" className="mr-1 size-3.5" /> Solo lectura
                </Badge>
              ) : undefined
            }
          />
          {clinical ? (
            <div className="flex flex-col gap-6 px-5 py-5">
              <dl className="grid gap-5 sm:grid-cols-3">
                <Field label="Condiciones">
                  <Tags items={patient.conditions} empty="Sin registrar" />
                </Field>
                <Field label="Alergias">
                  <Tags items={patient.allergies} empty="Ninguna conocida" tone="coral" />
                </Field>
                <Field label="Medicación actual">
                  <Tags items={patient.medication} empty="Ninguna" />
                </Field>
              </dl>

              <div>
                <h3 className="text-[12px] tracking-[0.04em] text-stone uppercase">Evolución</h3>
                {patient.notes.length ? (
                  <ol className="mt-3 flex flex-col">
                    {patient.notes.map((note, i) => (
                      <li key={i} className="relative border-l border-line pb-6 pl-5 last:pb-0">
                        <span className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-teal" />
                        <p className="text-[13px] text-muted">
                          {note.date} · {doctorById(note.doctorId).name}
                        </p>
                        <p className="mt-1 text-sm font-medium">{note.title}</p>
                        <p className="mt-1 max-w-[68ch] text-sm text-ink">{note.text}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted">Primera visita: todavía no hay notas.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-5">
              <Locked title="Datos clínicos protegidos">
                Tu perfil no incluye la historia clínica de este paciente. Si la necesitas, pídele acceso a
                un administrador.
              </Locked>
            </div>
          )}
        </Card>

        {canDownloadDocuments(viewer, patient) && (
          <Card>
            <CardHeader
              title="Documentos"
              hint={`${documents.length} ${documents.length === 1 ? "archivo" : "archivos"}`}
              action={editable ? <Button variant="secondary" icon="plus">Subir documento</Button> : undefined}
            />
            {documents.length ? (
              <ul className="divide-y divide-line">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frost text-navy">
                      <Icon name="file" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="truncate text-[13px] text-muted">
                        {doc.kind} · {doc.date} · {doc.size}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Descargar ${doc.name}`}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-outline px-3 text-[13px] font-medium whitespace-nowrap hover:border-navy"
                    >
                      <Icon name="download" className="size-4" />
                      <span className="hidden sm:inline">Descargar</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-sm text-muted">Este paciente todavía no tiene documentos.</p>
            )}
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
