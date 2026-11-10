"use client";

import { Icon } from "@/components/crm/icons";
import { Select } from "@/components/crm/select";
import { HALF_HOURS, formatClock, minutesOf, rangesProblem, timeOf, type Range } from "@/lib/crm/schedule";

const options = (times: readonly string[]) => times.map((t) => ({ value: t, label: formatClock(t), keywords: t }));

/** A range to add after the last one: an hour later, for up to three hours. Null when the day is full. */
export function nextRange(ranges: Range[]): Range | null {
  if (!ranges.length) return { starts: "07:30", ends: "12:00" };
  const last = Math.max(...ranges.map((r) => minutesOf(r.ends)));
  const starts = last + 60;
  const ends = Math.min(starts + 180, minutesOf("22:00"));
  return ends > starts ? { starts: timeOf(starts), ends: timeOf(ends) } : null;
}

/**
 * One day's ranges ("7:30 a. m. – 12:00 p. m."), on half hours, with buttons
 * to add and remove ranges and a note when they overlap.
 */
export function RangesEditor({
  ranges,
  onChange,
  label,
  extra,
}: {
  ranges: Range[];
  onChange: (ranges: Range[]) => void;
  /** Spoken name of the group of ranges ("Lunes"). */
  label: string;
  /** More buttons beside "Añadir horario" (copy to other days). */
  extra?: React.ReactNode;
}) {
  const problem = rangesProblem(ranges);
  const update = (index: number, patch: Partial<Range>) =>
    onChange(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const next = nextRange(ranges);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {ranges.map((range, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Select
            value={range.starts}
            onValueChange={(starts) => update(index, { starts })}
            options={options(HALF_HOURS.slice(0, -1))}
            searchable={false}
            aria-label={`${label}: desde`}
            panelMinWidth={170}
            className="w-[124px] sm:w-[136px]"
          />
          <span className="text-stone" aria-hidden="true">
            –
          </span>
          <Select
            value={range.ends}
            onValueChange={(ends) => update(index, { ends })}
            options={options(HALF_HOURS.slice(1))}
            searchable={false}
            aria-label={`${label}: hasta`}
            panelMinWidth={170}
            className="w-[124px] sm:w-[136px]"
          />
          <button
            type="button"
            onClick={() => onChange(ranges.filter((_, i) => i !== index))}
            aria-label={`Quitar el horario ${formatClock(range.starts)} – ${formatClock(range.ends)} del ${label.toLowerCase()}`}
            title="Quitar este horario"
            className="grid size-8 place-items-center rounded-lg text-stone transition-colors hover:bg-sand hover:text-[#b03a36]"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      ))}
      {problem && (
        <p role="alert" className="text-[12px] text-[#b03a36]">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => next && onChange([...ranges, next])}
          disabled={!next}
          className="inline-flex h-8 items-center gap-1.5 text-[13px] font-medium text-teal hover:text-navy disabled:text-stone"
        >
          <Icon name="plus" className="size-4" />
          Añadir horario
        </button>
        {extra}
      </div>
    </div>
  );
}
