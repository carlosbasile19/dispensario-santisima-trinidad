"use client";

import { formatDay } from "@/lib/crm/clinic";
import { formatClock, slotLabel } from "@/lib/crm/schedule";

const PARTS = [
  { label: "Mañana", test: (t: string) => t < "12:00" },
  { label: "Tarde", test: (t: string) => t >= "12:00" && t < "18:00" },
  { label: "Noche", test: (t: string) => t >= "18:00" },
];

/** The free start times of the chosen day, grouped into morning, afternoon and evening. */
export function TimeSlots({
  day,
  times,
  minutes,
  selected,
  onSelect,
}: {
  day: string | null;
  times: string[];
  minutes: number;
  selected: string | null;
  onSelect: (time: string) => void;
}) {
  if (!day) {
    return <p className="text-sm text-muted">Elige un día en el calendario para ver sus horarios.</p>;
  }
  return (
    <div>
      <h3 className="text-[16px] font-medium first-letter:uppercase">{formatDay(day, "long")}</h3>
      <p className="mt-0.5 text-[13px] text-muted">
        {times.length} {times.length === 1 ? "horario libre" : "horarios libres"} · {slotLabel(minutes)} cada uno
      </p>
      {PARTS.map(({ label, test }) => {
        const list = times.filter(test);
        if (!list.length) return null;
        return (
          <div key={label} className="mt-5">
            <p className="mb-2 text-[11px] tracking-[0.14em] text-stone uppercase">{label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {list.map((time) => {
                const isSelected = time === selected;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => onSelect(time)}
                    aria-pressed={isSelected}
                    className={`h-11 rounded-xl border text-[15px] font-medium whitespace-nowrap tabular-nums transition-[background-color,border-color,color,box-shadow] duration-200 ${
                      isSelected
                        ? "border-navy bg-navy text-white shadow-[0_8px_18px_-8px_rgba(27,42,85,0.7)]"
                        : "border-outline bg-white text-navy hover:border-teal hover:text-teal"
                    }`}
                  >
                    {formatClock(time)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
