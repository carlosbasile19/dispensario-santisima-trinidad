import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card, PageHeader, clock, statusLabel } from "@/components/crm/ui";
import { APPOINTMENTS, DOCTORS, SAMPLE_DAY, patientById, type AppointmentStatus } from "@/lib/crm/sample-data";
import { getViewer, inScope } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Agenda" };

const FIRST_SLOT = 7 * 60 + 30; // 7:30am, when the centre opens
const SLOTS = 12; // half hours until 1:30pm
const ROW = 60; // px per half hour

const BLOCK: Record<AppointmentStatus, string> = {
  pendiente: "border border-dashed border-outline bg-white text-ink",
  confirmada: "bg-frost text-navy",
  en_sala: "bg-mint/35 text-[#135c62]",
  en_consulta: "bg-teal text-white",
  atendida: "bg-sand text-muted",
  no_asistio: "bg-coral/10 text-[#b03a36]",
};

const LEGEND: AppointmentStatus[] = ["pendiente", "confirmada", "en_sala", "en_consulta", "atendida", "no_asistio"];

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// Agenda: one column per doctor, half-hour rows. A doctor sees only their own
// column; the director, staff and admins see every consulting room.
export default async function AgendaPage() {
  const viewer = await getViewer();
  const doctors = DOCTORS.filter((d) => inScope(viewer, d.id));
  const slots = Array.from({ length: SLOTS }, (_, i) => FIRST_SLOT + i * 30);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={SAMPLE_DAY}
        title={viewer.permissions.schedule === "own" ? "Mi agenda" : "Agenda"}
        actions={
          <>
            <Button variant="secondary">Hoy</Button>
            <Button variant="secondary">Semana</Button>
            {viewer.permissions.manageSchedule && <Button icon="plus">Nueva cita</Button>}
          </>
        }
      />

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span className={`size-3 rounded-[4px] ${BLOCK[status]}`} />
            {statusLabel(status)}
          </li>
        ))}
      </ul>

      <Card className="overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(${doctors.length}, minmax(200px, 1fr))`,
            minWidth: 64 + doctors.length * 200,
          }}
        >
          <div className="sticky left-0 z-10 border-b border-line bg-white" />
          {doctors.map((d) => (
            <div key={d.id} className="border-b border-l border-line px-4 py-3">
              <p className="truncate text-sm font-medium">{d.name}</p>
              <p className="truncate text-[13px] text-muted">
                {d.specialty} · {d.room}
              </p>
            </div>
          ))}

          <div className="sticky left-0 z-10 bg-white">
            {slots.map((slot) => (
              <div key={slot} style={{ height: ROW }} className="pt-1.5 pr-3 text-right font-mono text-[12px] text-stone">
                {clock(`${Math.floor(slot / 60)}:${String(slot % 60).padStart(2, "0")}`)}
              </div>
            ))}
          </div>

          {doctors.map((d) => (
            <div
              key={d.id}
              className="relative border-l border-line"
              style={{
                height: SLOTS * ROW,
                backgroundImage: "linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)",
                backgroundSize: `100% ${ROW}px`,
              }}
            >
              {APPOINTMENTS.filter((a) => a.doctorId === d.id).map((a) => {
                const patient = patientById(a.patientId)!;
                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/pacientes/${patient.id}`}
                    className={`absolute inset-x-1.5 overflow-hidden rounded-lg px-3 py-2 text-[13px] leading-snug transition-shadow hover:shadow-[0_0_0_2px_var(--color-navy)] ${BLOCK[a.status]}`}
                    style={{
                      top: ((minutesOf(a.time) - FIRST_SLOT) / 30) * ROW + 3,
                      height: (a.minutes / 30) * ROW - 5,
                    }}
                  >
                    <span className="block truncate font-medium">{patient.name}</span>
                    <span className="block truncate opacity-80">
                      {clock(a.time)} · {a.service}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
