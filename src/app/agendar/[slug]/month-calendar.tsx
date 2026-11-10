"use client";

import { Icon } from "@/components/crm/icons";
import { formatDay } from "@/lib/crm/clinic";
import { WEEKDAY_SHORT, monthGrid, monthLabel, monthOf, shiftMonth } from "@/lib/crm/schedule";

/**
 * A month of the booking calendar. Days with free slots are tinted teal and
 * can be chosen; the chosen day is navy; today carries a dot. The arrows stop
 * at the months the calendar can be booked in.
 */
export function MonthCalendar({
  month,
  today,
  lastDay,
  slotsByDay,
  selected,
  onMonthChange,
  onSelect,
}: {
  month: string;
  today: string;
  /** The last day of the booking horizon. */
  lastDay: string;
  slotsByDay: Record<string, string[]>;
  selected: string | null;
  onMonthChange: (month: string) => void;
  onSelect: (day: string) => void;
}) {
  // Only the weeks that have days of this month (4 to 6).
  const days = monthGrid(month).filter((_, i, all) => {
    const week = all.slice(i - (i % 7), i - (i % 7) + 7);
    return week.some((d) => monthOf(d) === month);
  });
  const canGoBack = month > monthOf(today);
  const canGoForward = month < monthOf(lastDay);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-medium" aria-live="polite">
          {monthLabel(month)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            disabled={!canGoBack}
            aria-label="Mes anterior"
            className="grid size-9 place-items-center rounded-full text-navy transition-colors hover:bg-sand disabled:pointer-events-none disabled:text-outline"
          >
            <Icon name="chevron-left" className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={!canGoForward}
            aria-label="Mes siguiente"
            className="grid size-9 place-items-center rounded-full text-navy transition-colors hover:bg-sand disabled:pointer-events-none disabled:text-outline"
          >
            <Icon name="chevron-right" className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-[11px] tracking-[0.1em] text-stone uppercase" aria-hidden="true">
        {WEEKDAY_SHORT.map((name) => (
          <span key={name} className="py-1">
            {name}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((day) => {
          if (monthOf(day) !== month) return <span key={day} aria-hidden="true" className="h-11 sm:h-12" />;
          const count = slotsByDay[day]?.length ?? 0;
          const isSelected = day === selected;
          const isToday = day === today;
          const label = `${formatDay(day, "long")}${count ? `, ${count} ${count === 1 ? "horario libre" : "horarios libres"}` : ", sin horarios"}`;
          return (
            <button
              key={day}
              type="button"
              disabled={!count}
              onClick={() => onSelect(day)}
              aria-label={label}
              aria-pressed={isSelected}
              className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-[15px] tabular-nums transition-[background-color,color,box-shadow] duration-200 sm:h-12 ${
                isSelected
                  ? "bg-navy font-semibold text-white shadow-[0_8px_18px_-8px_rgba(27,42,85,0.7)]"
                  : count
                    ? "bg-[#e9f4f4] font-semibold text-[#135c62] hover:bg-[#d6ebeb] hover:shadow-[inset_0_0_0_1px_#1e7e86]"
                    : "text-stone/70"
              }`}
            >
              {Number(day.slice(8))}
              {isToday && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1.5 size-1 rounded-full ${isSelected ? "bg-mint" : "bg-teal"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
