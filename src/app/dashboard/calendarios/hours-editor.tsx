"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Icon } from "@/components/crm/icons";
import { Switch } from "@/components/crm/switch";
import { WEEKDAY_NAMES, WEEKDAY_ORDER, rangesProblem, type Range } from "@/lib/crm/schedule";
import { saveCalendarHours } from "./actions";
import { RangesEditor } from "./ranges-editor";

type Day = { weekday: number; on: boolean; ranges: Range[] };

const toPayload = (days: Day[]) =>
  days.flatMap((d) => (d.on ? d.ranges.map((r) => ({ weekday: d.weekday, starts: r.starts, ends: r.ends })) : []));

const fromWeek = (week: Record<number, Range[]>): Day[] =>
  WEEKDAY_ORDER.map((weekday) => ({ weekday, on: (week[weekday]?.length ?? 0) > 0, ranges: week[weekday] ?? [] }));

/**
 * The weekly hours (patterns from Mobbin: Cal.com, Time2book and Fresha):
 * one row per day, Monday first, with a switch and one or more ranges.
 * Saving replaces the whole week at once; the patients' booking page shows
 * the new slots right away.
 */
export function HoursEditor({ calendarId, week }: { calendarId: string; week: Record<number, Range[]> }) {
  const [days, setDays] = useState(() => fromWeek(week));
  const saved = JSON.stringify(toPayload(fromWeek(week)));
  const payload = toPayload(days);
  const dirty = JSON.stringify(payload) !== saved;
  const invalid = days.some((d) => d.on && (d.ranges.length === 0 || rangesProblem(d.ranges)));

  const update = (weekday: number, patch: Partial<Day>) =>
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const toggle = (day: Day, on: boolean) =>
    update(day.weekday, { on, ranges: on && day.ranges.length === 0 ? [{ starts: "07:30", ends: "12:00" }] : day.ranges });

  const copyToOthers = (source: Day) =>
    setDays((current) =>
      current.map((d) => (d.weekday !== source.weekday && d.on ? { ...d, ranges: source.ranges.map((r) => ({ ...r })) } : d)),
    );

  const otherDaysOn = (day: Day) => days.some((d) => d.on && d.weekday !== day.weekday);

  return (
    <ActionForm action={saveCalendarHours} className="flex flex-col [&>p]:px-5 [&>p]:pb-4">
      <input type="hidden" name="calendar" value={calendarId} />
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />

      <ul className="divide-y divide-line">
        {days.map((day) => {
          const name = WEEKDAY_NAMES[day.weekday];
          return (
            <li key={day.weekday} className="grid gap-3 px-5 py-4 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start">
              <div className="flex h-10 items-center">
                <Switch checked={day.on} onCheckedChange={(on) => toggle(day, on)} label={name} />
              </div>
              {day.on ? (
                <RangesEditor
                  ranges={day.ranges}
                  onChange={(ranges) => update(day.weekday, { ranges, on: ranges.length > 0 })}
                  label={name}
                  extra={
                    otherDaysOn(day) && day.ranges.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => copyToOthers(day)}
                        title="Copiar este horario a los demás días activos"
                        className="inline-flex h-8 items-center gap-1.5 text-[13px] font-medium text-muted hover:text-navy"
                      >
                        <Icon name="copy" className="size-4" />
                        Copiar a los demás días
                      </button>
                    ) : null
                  }
                />
              ) : (
                <p className="flex h-10 items-center text-sm text-stone">No atiende</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-cream/60 px-5 py-4">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          {dirty ? (
            <>
              <span className="size-2 rounded-full bg-coral" aria-hidden="true" />
              Cambios sin guardar
            </>
          ) : (
            "Los cupos de cada servicio se calculan con este horario."
          )}
        </p>
        <SubmitButton icon="check" pendingLabel="Guardando…" disabled={!dirty || invalid}>
          Guardar horario
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
