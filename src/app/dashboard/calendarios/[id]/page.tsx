import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { Card, Skeleton } from "@/components/crm/ui";
import { getCalendar, getProfessionalVisits, getSpecialDays, getWindows } from "@/lib/crm/calendars";
import { clinicToday, isIsoDate, isUuid, localTime, param } from "@/lib/crm/clinic";
import { mondayOf, shiftDay } from "@/lib/crm/schedule";
import { getViewer } from "@/lib/crm/viewer";
import { WeekGrid, WeekLegend, WeekStats } from "../week-grid";

export const metadata: Metadata = { title: "Calendario" };

type Props = PageProps<"/dashboard/calendarios/[id]">;

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-2.5 text-sm font-medium text-navy hover:border-navy";

const dayMonth = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** "10 al 16 de noviembre de 2026", or across months "28 de diciembre de 2026 al 3 de enero de 2027". */
function weekLabel(start: string, end: string) {
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))} al ${dayMonthYear.format(at(end))}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${dayMonth.format(at(start))} al ${dayMonthYear.format(at(end))}`;
  return `${dayMonthYear.format(at(start))} al ${dayMonthYear.format(at(end))}`;
}

// The calendar's week: its hours, its visits by status, the special days and,
// for the front desk and administrators, a "+" on every free half hour.
export default function CalendarWeekPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<WeekSkeleton />}>
      <Week params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Week({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query, today, viewer] = await Promise.all([params, searchParams, clinicToday(), getViewer()]);
  if (!isUuid(id)) notFound();
  const calendar = await getCalendar(id);
  if (!calendar) notFound();

  const requested = param(query.semana);
  const start = mondayOf(isIsoDate(requested) ? requested : today);
  const end = shiftDay(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const [windows, specialDays, visits] = await Promise.all([
    getWindows(calendar.id, start, end),
    getSpecialDays(calendar.id, start, end),
    getProfessionalVisits(calendar.professional.id, start, end),
  ]);
  const thisWeek = start === mondayOf(today);
  const link = (monday: string) => `/dashboard/calendarios/${calendar.id}?semana=${monday}`;
  const canBook = viewer.permissions.manageSchedule;
  const professional = calendar.professional.id;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Link href={link(shiftDay(start, -7))} className={button} aria-label="Semana anterior">
          <Icon name="chevron-left" className="size-4" />
        </Link>
        <Link href={link(shiftDay(start, 7))} className={button} aria-label="Semana siguiente">
          <Icon name="chevron-right" className="size-4" />
        </Link>
        <h2 className="mr-auto px-1.5 text-[15px] font-medium">
          {weekLabel(start, end)}
          {thisWeek && <span className="ml-2 text-[13px] font-normal text-teal">Esta semana</span>}
        </h2>
        <WeekStats visits={visits} />
        {!thisWeek && (
          <Link href={link(mondayOf(today))} className={button}>
            Hoy
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <WeekLegend />
        {canBook && <p className="text-[12px] text-stone">Pasa el cursor por un espacio libre para agendar.</p>}
      </div>
      <WeekGrid
        days={days}
        today={today}
        now={localTime(new Date().toISOString())}
        windows={windows}
        specialDays={new Map(specialDays.map((s) => [s.day, s]))}
        visits={visits}
        bookHref={
          canBook
            ? (day, time) => `/dashboard/agenda/nueva?fecha=${day}&hora=${time}&profesional=${professional}`
            : undefined
        }
      />
    </Card>
  );
}

function WeekSkeleton() {
  return (
    <Card>
      <div aria-busy="true" className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="size-9 rounded-lg border border-outline" />
        <span className="size-9 rounded-lg border border-outline" />
        <Skeleton className="ml-2 w-56" />
      </div>
      <div className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] gap-px p-px">
        {Array.from({ length: 6 * 8 }, (_, i) => (
          <span key={i} className={`h-10 ${i % 6 === 0 ? "" : "animate-pulse bg-sand/50"}`} />
        ))}
      </div>
    </Card>
  );
}
