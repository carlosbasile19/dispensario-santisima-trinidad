import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { ShareLink } from "@/components/crm/share-link";
import { Avatar, Badge, Card } from "@/components/crm/ui";
import type { Calendar } from "@/lib/crm/calendars";
import { ROLE_INFO } from "@/lib/crm/roles";
import { WEEKDAY_NAMES, WEEKDAY_ORDER, slotLabel, summarizeWeek } from "@/lib/crm/schedule";

const LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * A calendar at a glance: the professional, whether it takes bookings, the
 * days and hours, its services with their slot length, this week's visits
 * and the link to send.
 */
export function CalendarCard({ calendar, week }: { calendar: Calendar; week?: { visits: number; online: number } }) {
  const { professional } = calendar;
  const days = new Set(calendar.hours.map((h) => h.weekday));
  const summary = summarizeWeek(calendar.hours);
  const offered = calendar.services.filter((s) => s.active);
  const live = calendar.accepting && offered.length > 0 && calendar.hours.length > 0;

  return (
    <Card className="flex flex-col">
      <Link
        href={`/dashboard/calendarios/${calendar.id}`}
        className="group flex items-start gap-3.5 rounded-t-xl px-5 pt-5 pb-4 transition-colors hover:bg-cream/60"
      >
        <Avatar name={professional.name} src={professional.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[22px] leading-tight">{professional.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {calendar.specialty ?? (professional.role ? ROLE_INFO[professional.role].label : "Profesional")}
          </p>
          <div className="mt-2">
            {live ? (
              <Badge tone="teal">Recibe citas en línea</Badge>
            ) : !calendar.accepting ? (
              <Badge tone="outline">En pausa</Badge>
            ) : (
              <Badge tone="coral">{offered.length ? "Sin horario" : "Sin servicios"}</Badge>
            )}
          </div>
        </div>
        <Icon name="chevron-right" className="mt-1 size-5 text-stone transition-transform group-hover:translate-x-0.5 group-hover:text-navy" />
      </Link>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <ol className="grid grid-cols-7 gap-1" aria-label="Días de atención">
          {WEEKDAY_ORDER.map((weekday) => (
            <li
              key={weekday}
              title={WEEKDAY_NAMES[weekday]}
              className={`grid h-7 place-items-center rounded-md text-[11px] font-medium ${
                days.has(weekday) ? "bg-[#e9f4f4] text-[#135c62]" : "bg-sand/70 text-stone"
              }`}
            >
              <span aria-hidden="true">{LETTERS[weekday]}</span>
              <span className="sr-only">
                {WEEKDAY_NAMES[weekday]}: {days.has(weekday) ? "atiende" : "no atiende"}
              </span>
            </li>
          ))}
        </ol>
        {summary.length ? (
          <ul className="flex flex-col gap-0.5 text-[13px] text-ink">
            {summary.map((line) => (
              <li key={line} className="first-letter:uppercase">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Sin horario de atención.</p>
        )}
        {offered.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {offered.map((s) => (
              <li key={s.serviceId} className="inline-flex items-center gap-1 rounded-md bg-sand px-2 py-1 text-[12px] text-ink">
                {s.name}
                <span className="text-stone">· {slotLabel(s.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-line px-5 py-3.5">
        <p className="text-[13px] text-muted">
          Esta semana: <span className="font-medium text-navy">{week?.visits ?? 0}</span>{" "}
          {week?.visits === 1 ? "cita" : "citas"}
          {week?.online ? ` · ${week.online} en línea` : ""}
        </p>
        <ShareLink slug={calendar.slug} name={professional.name} compact />
      </div>
    </Card>
  );
}
