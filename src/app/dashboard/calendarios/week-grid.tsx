import Link from "next/link";
import type { CSSProperties } from "react";

import { Icon } from "@/components/crm/icons";
import type { SpecialDay, WeekVisit } from "@/lib/crm/calendars";
import { STATUS_INFO, UNBILLED_STATUSES, formatDay, type AppointmentStatus } from "@/lib/crm/clinic";
import { WEEKDAY_SHORT, addMinutes, formatClock, minutesOf, timeOf, weekdayOf, type Range } from "@/lib/crm/schedule";

// One week of a calendar (patterns from Mobbin: Fresha's hatched hours off,
// Rise's now line, Cal.com's week view). Columns are days, rows half hours.
// The professional's hours are white, the rest hatched; each visit is a block
// in its status colour that opens the visit. Members who book see a "+" on
// every free half hour, which opens Nueva cita with the day, time and
// professional filled in.

const SLOT = 40; // px per half hour
const HATCH = "repeating-linear-gradient(135deg, #f1ede4 0 6px, #faf8f4 6px 12px)";
const LINES = {
  backgroundImage:
    "linear-gradient(to bottom, #e4dfd3 1px, transparent 1px), linear-gradient(to bottom, rgba(217,211,198,0.4) 1px, transparent 1px)",
  backgroundSize: `100% ${SLOT * 2}px, 100% ${SLOT}px`,
} satisfies CSSProperties;

const TONE: Record<AppointmentStatus, string> = {
  scheduled: "border-l-stone bg-sand text-navy",
  confirmed: "border-l-navy bg-frost text-navy",
  checked_in: "border-l-teal bg-[#dff2f2] text-[#135c62]",
  completed: "border-l-[#135c62] bg-teal text-white",
  cancelled: "border-l-outline bg-white/90 text-stone line-through decoration-stone/40",
  no_show: "border-l-coral bg-[#fbecea] text-[#b03a36]",
};

const LEGEND: AppointmentStatus[] = ["scheduled", "confirmed", "checked_in", "completed"];

type Placed = WeekVisit & { from: number; to: number; lane: number; lanes: number };

/** Side-by-side lanes for visits that overlap, like a calendar app. */
function layout(visits: WeekVisit[]): Placed[] {
  const sorted = visits
    .map((v) => ({ ...v, from: minutesOf(v.start), to: minutesOf(v.start) + v.minutes, lane: 0, lanes: 1 }))
    .sort((a, b) => a.from - b.from || b.to - a.to);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const v of group) v.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const v of sorted) {
    if (group.length && v.from >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= v.from);
    if (lane === -1) lane = laneEnds.push(v.to) - 1;
    else laneEnds[lane] = v.to;
    v.lane = lane;
    group.push(v);
    groupEnd = group.length === 1 ? v.to : Math.max(groupEnd, v.to);
  }
  close();
  return placed;
}

const hourLabel = (minutes: number) => formatClock(timeOf(minutes)).replace(":00", "");

export function WeekStats({ visits }: { visits: WeekVisit[] }) {
  const active = visits.filter((v) => !UNBILLED_STATUSES.includes(v.status));
  const online = active.filter((v) => v.source === "online").length;
  return (
    <p className="text-[13px] text-muted">
      <span className="font-medium text-navy">{active.length}</span> {active.length === 1 ? "cita" : "citas"}
      {online > 0 && (
        <>
          {" · "}
          <span className="font-medium text-navy">{online}</span> en línea
        </>
      )}
    </p>
  );
}

export function WeekLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {LEGEND.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] border-l-[3px] ${TONE[status]}`} aria-hidden="true" />
          {STATUS_INFO[status].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <Icon name="globe" className="size-3.5 text-teal" />
        Agendada en línea
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-line" style={{ background: HATCH }} aria-hidden="true" />
        Fuera de horario
      </li>
    </ul>
  );
}

export function WeekGrid({
  days,
  today,
  now,
  windows,
  specialDays,
  visits,
  bookHref,
}: {
  /** Monday to Sunday. */
  days: string[];
  today: string;
  /** The clinic's time now, "HH:MM". */
  now: string;
  windows: Map<string, (Range & { special: boolean })[]>;
  specialDays: Map<string, SpecialDay>;
  visits: WeekVisit[];
  /** Link to book a free half hour; only for members who book. */
  bookHref?: (day: string, time: string) => string;
}) {
  // Saturday and Sunday only when something happens on them.
  const shown = days.filter(
    (day, i) => i < 5 || windows.has(day) || specialDays.has(day) || visits.some((v) => v.day === day),
  );
  const shownVisits = visits.filter((v) => shown.includes(v.day));

  // From the first hour anything starts to the last one anything ends; 7 to 5 when empty.
  const starts = [...shown.flatMap((d) => (windows.get(d) ?? []).map((w) => minutesOf(w.starts))), ...shownVisits.map((v) => minutesOf(v.start))];
  const ends = [
    ...shown.flatMap((d) => (windows.get(d) ?? []).map((w) => minutesOf(w.ends))),
    ...shownVisits.map((v) => minutesOf(v.start) + v.minutes),
  ];
  const first = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 7 * 60;
  const last = ends.length ? Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60) : 17 * 60;
  const height = ((last - first) / 30) * SLOT;
  const top = (minutes: number) => ((minutes - first) / 30) * SLOT;
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, i) => first + i * 60);
  const nowMinutes = minutesOf(now);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[760px]"
        style={{ gridTemplateColumns: `60px repeat(${shown.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky left-0 z-20 border-b border-line bg-white" />
        {shown.map((day) => {
          const special = specialDays.get(day);
          const count = visits.filter((v) => v.day === day && !UNBILLED_STATUSES.includes(v.status)).length;
          const isToday = day === today;
          return (
            <div key={day} className={`border-b border-l border-line px-2 pt-3 pb-2.5 text-center ${isToday ? "bg-frost/40" : ""}`}>
              <p className={`text-[11px] tracking-[0.12em] uppercase ${isToday ? "text-teal" : "text-stone"}`}>
                {WEEKDAY_SHORT[weekdayOf(day)]}
              </p>
              <p
                className={`mx-auto mt-1 grid size-8 place-items-center rounded-full text-[17px] tabular-nums ${
                  isToday ? "bg-navy font-medium text-white" : "text-navy"
                }`}
              >
                {Number(day.slice(8))}
              </p>
              <p className="mt-1 h-4 text-[11px] text-muted">
                {special ? (
                  <span className={special.closed ? "text-[#b03a36]" : "text-teal"} title={special.note ?? undefined}>
                    {special.closed ? "Día libre" : "Horario especial"}
                  </span>
                ) : count ? (
                  `${count} ${count === 1 ? "cita" : "citas"}`
                ) : (
                  ""
                )}
              </p>
            </div>
          );
        })}

        {/* Time axis */}
        <div className="sticky left-0 z-20 bg-white" style={{ height }}>
          <div className="relative h-full">
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap text-stone tabular-nums first:translate-y-0"
                style={{ top: top(m) }}
              >
                {hourLabel(m)}
              </span>
            ))}
          </div>
        </div>

        {shown.map((day) => {
          const open = windows.get(day) ?? [];
          const special = specialDays.get(day);
          const dayVisits = layout(shownVisits.filter((v) => v.day === day));
          const busy = dayVisits.filter((v) => !UNBILLED_STATUSES.includes(v.status));
          const past = (minutes: number) => day < today || (day === today && minutes < nowMinutes);
          const free = bookHref
            ? open.flatMap((w) => {
                const cells: number[] = [];
                for (let m = minutesOf(w.starts); m + 30 <= minutesOf(w.ends); m += 30) {
                  if (!past(m) && !busy.some((v) => v.from < m + 30 && v.to > m)) cells.push(m);
                }
                return cells;
              })
            : [];

          return (
            <div key={day} className="relative border-l border-line" style={{ height, background: HATCH }}>
              {open.map((w) => (
                <div
                  key={`${w.starts}-${w.ends}`}
                  className="absolute inset-x-0 bg-white"
                  style={{ top: top(minutesOf(w.starts)), height: top(minutesOf(w.ends)) - top(minutesOf(w.starts)) }}
                />
              ))}
              <div className="pointer-events-none absolute inset-0" style={LINES} />

              {special?.closed && open.length === 0 && (
                <div className="absolute inset-x-2 top-6 rounded-lg border border-coral/30 bg-white/95 px-2 py-2 text-center text-[12px] text-[#b03a36]">
                  No atiende
                  {special.note && <span className="block text-[11px] text-muted">{special.note}</span>}
                </div>
              )}

              {bookHref &&
                free.map((m) => (
                  <Link
                    key={m}
                    href={bookHref(day, timeOf(m))}
                    aria-label={`Agendar el ${formatDay(day, "long")} a las ${formatClock(timeOf(m))}`}
                    className="group absolute inset-x-1 flex items-center rounded-md px-2 text-[11px] font-medium text-[#135c62] opacity-0 transition-opacity hover:bg-mint/25 hover:opacity-100 focus-visible:bg-mint/25 focus-visible:opacity-100"
                    style={{ top: top(m) + 1, height: SLOT - 2 }}
                  >
                    <Icon name="plus" className="mr-1 size-3.5" />
                    {formatClock(timeOf(m))}
                  </Link>
                ))}

              {dayVisits.map((v) => {
                const blockHeight = Math.max(top(v.to) - top(v.from) - 2, 18);
                return (
                  <Link
                    key={v.id}
                    href={`/dashboard/agenda/${v.id}`}
                    title={`${formatClock(v.start)} – ${formatClock(addMinutes(v.start, v.minutes))} · ${v.patient} · ${v.services.join(", ")} · ${STATUS_INFO[v.status].label}${v.source === "online" ? " · agendada en línea" : ""}`}
                    className={`absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[12px] leading-[15px] shadow-[0_1px_2px_rgba(27,42,85,0.08)] transition-shadow hover:z-20 hover:shadow-[0_10px_24px_-10px_rgba(27,42,85,0.55)] ${TONE[v.status]}`}
                    style={{
                      top: top(v.from) + 1,
                      height: blockHeight,
                      left: `calc(${(v.lane / v.lanes) * 100}% + 3px)`,
                      width: `calc(${100 / v.lanes}% - 6px)`,
                    }}
                  >
                    <p className="flex items-center gap-1 truncate font-medium">
                      {v.source === "online" && <Icon name="globe" className="size-3 shrink-0" />}
                      <span className="truncate">
                        <span className="tabular-nums">{formatClock(v.start)}</span> · {v.patient}
                      </span>
                    </p>
                    {blockHeight >= 34 && <p className="truncate opacity-75">{v.services.join(" · ")}</p>}
                  </Link>
                );
              })}

              {day === today && nowMinutes >= first && nowMinutes <= last && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-30" style={{ top: top(nowMinutes) }}>
                  <div className="relative h-0.5 bg-coral">
                    <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-coral" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
