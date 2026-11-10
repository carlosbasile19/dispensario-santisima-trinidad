"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { inputClass } from "@/components/crm/styles";
import { tidyNumber } from "@/lib/lab/numbers";
import { answerKey } from "@/lib/lab/reference";
import { normalize } from "@/lib/lab/search";
import type { ReportRow } from "@/lib/lab/types";

// The result field of a row, by kind: a number, a few answers as chips,
// a longer list as a combobox that still accepts any text, or a sentence.
// Enter moves to the next result, as in the clinic's spreadsheet.

/** Moves focus to the next result field of the editor. */
export function focusNextResult(from: Element) {
  const fields = [...document.querySelectorAll<HTMLElement>("[data-result-input]")];
  const index = fields.indexOf(from as HTMLElement);
  const next = fields[index + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
}

const enterMoves = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    focusNextResult(event.currentTarget);
  }
};

type Props = {
  row: ReportRow;
  options: readonly string[];
  onChange: (value: string) => void;
  flagged: boolean;
  label: string;
};

export function ResultInput({ row, options, onChange, flagged, label }: Props) {
  const tone = flagged ? "border-coral/60 bg-coral/[0.04] text-[#b03a36] font-medium" : "";

  if (row.kind === "number") {
    return (
      <input
        data-result-input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={row.value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const tidy = tidyNumber(e.target.value);
          if (tidy !== e.target.value) onChange(tidy);
        }}
        onKeyDown={enterMoves}
        className={`${inputClass} h-9 font-mono text-[14px] tabular-nums ${tone}`}
      />
    );
  }

  // A few short answers (NEGATIVO / POSITIVO, A · B · AB · O) fit as chips; longer lists open a combobox.
  if (row.kind === "option" && options.length > 0 && options.length <= 4 && options.join("").length <= 20) {
    return <Chips value={row.value} options={options} onChange={onChange} label={label} flagged={flagged} />;
  }

  if (row.kind === "option") {
    return <Combobox value={row.value} options={options} onChange={onChange} label={label} className={tone} />;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        data-result-input
        aria-label={label}
        value={row.value}
        rows={row.value.length > 60 ? 3 : row.value.length > 28 ? 2 : 1}
        placeholder="Escribe el resultado"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={enterMoves}
        className={`${inputClass} h-auto min-h-9 resize-y py-1.5 leading-snug ${tone}`}
      />
      {options.length > 0 && answerKey(row.value) !== answerKey(options[0]) && (
        <div className="flex flex-wrap gap-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className="rounded-md border border-dashed border-outline px-2 py-0.5 text-left text-[11px] text-muted hover:border-navy hover:text-navy"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Two or three answers (NEGATIVO / POSITIVO) as a segmented control. */
function Chips({ value, options, onChange, label, flagged }: { value: string; options: readonly string[]; onChange: (v: string) => void; label: string; flagged: boolean }) {
  const current = options.find((o) => answerKey(o) === answerKey(value));
  const custom = value && !current;
  return (
    <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-wrap gap-1 sm:flex-nowrap">
      {options.map((option, i) => {
        const selected = option === current;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            data-result-input={i === 0 ? "" : undefined}
            onClick={() => onChange(selected ? "" : option)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!selected) onChange(option);
                focusNextResult(event.currentTarget);
              }
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                const next = options[(i + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
                onChange(next);
              }
            }}
            className={`h-9 min-w-0 rounded-lg border px-2 text-[11px] font-semibold whitespace-nowrap transition-colors sm:h-8 ${
              selected
                ? flagged
                  ? "border-[#b03a36] bg-[#b03a36] text-white"
                  : "border-navy bg-navy text-white"
                : "border-outline bg-white text-ink hover:border-navy hover:text-navy"
            }`}
          >
            {option}
          </button>
        );
      })}
      {custom && <span className="self-center truncate text-[12px] font-medium text-navy">{value}</span>}
    </div>
  );
}

/** A longer list of usual answers; any text is accepted. */
function Combobox({ value, options, onChange, label, className }: { value: string; options: readonly string[]; onChange: (v: string) => void; label: string; className: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const exact = options.some((o) => answerKey(o) === answerKey(value));
  const shown = value && !exact ? options.filter((o) => normalize(o).includes(normalize(value))) : options;

  const pick = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <input
        ref={input}
        data-result-input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="Elige o escribe"
        onFocus={() => {
          setOpen(true);
          setActive(Math.max(0, options.findIndex((o) => o === value)));
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((a) => (shown.length ? (a + (event.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length : 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && shown[active] && !exact) pick(shown[active]);
            setOpen(false);
            focusNextResult(event.currentTarget);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${inputClass} h-9 pr-8 text-[13px] uppercase ${className}`}
      />
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-stone">
        ▾
      </span>
      {open && shown.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="picker-panel absolute top-full left-0 z-30 mt-1 max-h-60 w-full min-w-[220px] overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-[0_16px_40px_-16px_rgba(27,42,85,0.35)]"
          data-side="bottom"
        >
          {shown.map((option, i) => (
            <li
              key={option}
              id={`${id}-${i}`}
              role="option"
              aria-selected={option === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] ${i === active ? "bg-sand text-navy" : "text-ink"} ${option === value ? "font-medium" : ""}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
