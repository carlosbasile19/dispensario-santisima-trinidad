import type { Metadata } from "next";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/crm/ui";
import { getCalendars, getVisitCounts } from "@/lib/crm/calendars";
import { clinicToday } from "@/lib/crm/clinic";
import { getProfessionals, getServices } from "@/lib/crm/data";
import { mondayOf, shiftDay } from "@/lib/crm/schedule";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { CalendarCard } from "./calendar-card";
import { NewCalendar } from "./new-calendar";

export const metadata: Metadata = { title: "Calendarios" };

// Calendarios: one booking calendar per professional, with its weekly hours,
// the services patients can book online (each with 30-minute or 1-hour
// slots) and its public link. Everyone sees them (a doctor only their own);
// administrators create and edit them. The header renders from the viewer;
// the cards stream in.
export default async function CalendarsPage() {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Clínica"
        title={own ? "Mi calendario" : "Calendarios"}
        description={
          own
            ? "Tu horario de atención y el enlace para que tus pacientes agenden en línea."
            : "El horario de cada médico, sus servicios y el enlace que se envía a los pacientes para que agenden en línea."
        }
        actions={
          <>
            <a
              href="/agendar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy"
            >
              <Icon name="external" className="size-4" />
              Página de reservas
            </a>
            {viewer.permissions.manageCalendars && (
              <Suspense
                fallback={
                  <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white">
                    <Icon name="plus" className="size-4" />
                    Nuevo calendario
                  </span>
                }
              >
                <NewCalendarButton />
              </Suspense>
            )}
          </>
        }
      />
      <Suspense fallback={<CardsSkeleton />}>
        <CalendarCards viewer={viewer} />
      </Suspense>
    </div>
  );
}

/** Professionals without a calendar, for the "Nuevo calendario" dialog. */
async function NewCalendarButton() {
  const [calendars, professionals, services] = await Promise.all([getCalendars(), getProfessionals(), getServices()]);
  const taken = new Set(calendars.map((c) => c.professional.id));
  const candidates = professionals.list.filter((p) => (p.role === "doctor" || p.role === "director") && !taken.has(p.id));
  return <NewCalendar professionals={candidates} services={services.filter((s) => s.active)} />;
}

async function CalendarCards({ viewer }: { viewer: Viewer }) {
  const today = await clinicToday();
  const monday = mondayOf(today);
  const [calendars, counts] = await Promise.all([getCalendars(), getVisitCounts(monday, shiftDay(monday, 6))]);

  if (!calendars.length) {
    return (
      <Card>
        <EmptyState icon="slots" title={viewer.permissions.schedule === "own" ? "Aún no tienes calendario" : "Aún no hay calendarios"}>
          {viewer.permissions.manageCalendars
            ? "Crea el calendario de cada médico: su horario, los servicios que se agendan en línea y el enlace para sus pacientes."
            : "Un administrador lo crea en esta sección, con tu horario y los servicios que los pacientes pueden agendar en línea."}
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {calendars.map((calendar) => (
        <CalendarCard key={calendar.id} calendar={calendar} week={counts.get(calendar.professional.id)} />
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 2 }, (_, i) => (
        <Card key={i} className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3.5">
            <span className="size-14 animate-pulse rounded-full bg-sand" />
            <span className="flex flex-col gap-2">
              <Skeleton className="w-40 text-xl" />
              <Skeleton className="w-24" />
            </span>
          </div>
          <span className="h-7 animate-pulse rounded-md bg-sand/70" />
          <Skeleton className="w-3/4" />
          <Skeleton className="w-1/2" />
        </Card>
      ))}
    </div>
  );
}
