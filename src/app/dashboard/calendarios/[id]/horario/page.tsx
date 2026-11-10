import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { Card, CardHeader, EmptyState, FormSkeleton, RowsSkeleton } from "@/components/crm/ui";
import { getCalendar, getSpecialDays } from "@/lib/crm/calendars";
import { clinicToday, formatDay, isUuid, param } from "@/lib/crm/clinic";
import { WEEKDAY_NAMES, WEEKDAY_ORDER, byWeekday, formatRange } from "@/lib/crm/schedule";
import { getViewer } from "@/lib/crm/viewer";
import { HoursEditor } from "../../hours-editor";
import { AddSpecialDay, RemoveSpecialDay } from "../../special-days";

export const metadata: Metadata = { title: "Horario" };

type Props = PageProps<"/dashboard/calendarios/[id]/horario">;

// The calendar's weekly hours and its special days (a day off, or other hours
// on a date). Administrators edit them; everyone else reads them.
export default function HoursPage({ params, searchParams }: Props) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Suspense
        fallback={
          <Card>
            <CardHeader title="Horario semanal" />
            <FormSkeleton fields={5} className="px-5 py-5" />
          </Card>
        }
      >
        <WeeklyHours params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={
          <Card>
            <CardHeader title="Días especiales" />
            <RowsSkeleton rows={2} dense />
          </Card>
        }
      >
        <SpecialDays params={params} />
      </Suspense>
    </div>
  );
}

async function WeeklyHours({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query, viewer] = await Promise.all([params, searchParams, getViewer()]);
  if (!isUuid(id)) notFound();
  const calendar = await getCalendar(id);
  if (!calendar) notFound();
  const week = Object.fromEntries(byWeekday(calendar.hours));

  return (
    <Card>
      <CardHeader
        title="Horario semanal"
        hint="Las horas en que atiende cada día. Los cupos se ofrecen dentro de estas franjas."
      />
      {param(query.nuevo) === "1" && (
        <p className="flex gap-3 border-b border-line bg-[#e9f4f4] px-5 py-3 text-[14px] text-[#135c62]">
          <Icon name="check" className="mt-0.5 size-4 shrink-0" />
          Calendario creado. Empieza de lunes a viernes de 7:30 a. m. a 12:00 p. m.: ajústalo a su horario real y guárdalo.
        </p>
      )}
      {viewer.permissions.manageCalendars ? (
        <HoursEditor calendarId={calendar.id} week={week} />
      ) : (
        <ul className="divide-y divide-line">
          {WEEKDAY_ORDER.map((weekday) => (
            <li key={weekday} className="flex flex-wrap justify-between gap-x-6 gap-y-1 px-5 py-3 text-sm">
              <span className="font-medium">{WEEKDAY_NAMES[weekday]}</span>
              <span className={week[weekday]?.length ? "text-ink" : "text-stone"}>
                {week[weekday]?.length ? week[weekday].map(formatRange).join(" · ") : "No atiende"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function SpecialDays({ params }: { params: Props["params"] }) {
  const [{ id }, today, viewer] = await Promise.all([params, clinicToday(), getViewer()]);
  if (!isUuid(id)) notFound();
  const days = await getSpecialDays(id, today);
  const canEdit = viewer.permissions.manageCalendars;

  return (
    <Card>
      <CardHeader
        title="Días especiales"
        hint="Días libres u otro horario en una fecha"
        action={canEdit ? <AddSpecialDay calendarId={id} today={today} /> : undefined}
      />
      {days.length ? (
        <ul className="divide-y divide-line">
          {days.map((d) => (
            <li key={d.day} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  d.closed ? "bg-coral/10 text-[#b03a36]" : "bg-frost text-navy"
                }`}
              >
                <Icon name={d.closed ? "pause" : "clock"} className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium first-letter:uppercase">{formatDay(d.day, "long")}</p>
                <p className="truncate text-[13px] text-muted">
                  {d.closed ? "No atiende" : d.ranges.map(formatRange).join(" · ")}
                  {d.note ? ` · ${d.note}` : ""}
                </p>
              </div>
              {canEdit && <RemoveSpecialDay calendarId={id} day={d.day} label={formatDay(d.day, "long")} />}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="calendar" title="Sin días especiales">
          {canEdit
            ? "Añade vacaciones, feriados o un horario distinto para una fecha. Ese día no se ofrecen los cupos del horario semanal."
            : "No hay días libres ni horarios distintos en las próximas fechas."}
        </EmptyState>
      )}
    </Card>
  );
}
