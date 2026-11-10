import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { ShareLink } from "@/components/crm/share-link";
import { Avatar, Badge, Skeleton } from "@/components/crm/ui";
import { getCalendar } from "@/lib/crm/calendars";
import { isUuid } from "@/lib/crm/clinic";
import { ROLE_INFO } from "@/lib/crm/roles";
import { getViewer } from "@/lib/crm/viewer";
import { CalendarTabs } from "../calendar-tabs";

// One calendar: its header (who, open or paused, the link to send) and its
// three views below, Semana, Horario and Servicios y reservas. The header
// streams in once and stays while moving between the views.
export default function CalendarLayout({ children, params }: LayoutProps<"/dashboard/calendarios/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <CalendarHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function CalendarHeader({ params }: { params: LayoutProps<"/dashboard/calendarios/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [viewer, calendar] = await Promise.all([getViewer(), getCalendar(id)]);
  if (!calendar) notFound();
  const { professional } = calendar;
  const live = calendar.accepting && calendar.services.some((s) => s.active) && calendar.hours.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/calendarios"
        className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-navy"
      >
        <Icon name="arrow-left" className="size-4" />
        {viewer.permissions.schedule === "own" ? "Mi calendario" : "Calendarios"}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={professional.name} src={professional.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[clamp(28px,3vw,38px)] leading-[1.08] tracking-[-0.01em]">
              {professional.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-muted">
              {calendar.specialty ?? (professional.role ? ROLE_INFO[professional.role].label : "Profesional")}
              {live ? (
                <Badge tone="teal">Recibe citas en línea</Badge>
              ) : calendar.accepting ? (
                <Badge tone="coral">No recibe citas: falta {calendar.hours.length ? "un servicio" : "el horario"}</Badge>
              ) : (
                <Badge tone="outline">En pausa</Badge>
              )}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[380px]">
          <ShareLink slug={calendar.slug} name={professional.name} />
        </div>
      </header>
      <CalendarTabs id={calendar.id} />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="w-24" />
      <div className="flex items-center gap-4">
        <span className="size-14 animate-pulse rounded-full bg-sand" />
        <span className="flex flex-col gap-2">
          <Skeleton className="w-64 text-3xl" />
          <Skeleton className="w-40" />
        </span>
      </div>
      <span className="h-11 border-b border-line" />
    </div>
  );
}
