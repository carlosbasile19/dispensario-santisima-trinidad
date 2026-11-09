"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { addDays, clinicToday } from "@/lib/crm/clinic";
import { panelClass, useFloatingPanel } from "./floating";
import { Icon } from "./icons";
import { Select, type SelectOption } from "./select";

// Day and time pickers. Days travel as "YYYY-MM-DD" and times as "HH:MM",
// both the clinic's local values, in a regular input named `name`.

const WEEKDAYS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"]; // Venezuelan calendars start on Sunday.
const monthTitle = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", month: "long", year: "numeric" });
const triggerDay = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const longDay = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);
const monthOf = (day: string) => day.slice(0, 7);
const addMonths = (day: string, months: number) => {
  const date = utc(day);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return iso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), last));
};
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The 6 × 7 days shown for the month of `day`, starting on a Sunday. */
function monthGrid(day: string) {
  const date = utc(day);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
  const start = addDays(first.toISOString().slice(0, 10), -first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function DatePicker({
  name,
  value: controlled,
  defaultValue = "",
  onValueChange,
  min,
  max,
  required = false,
  submitOnChange = false,
  placeholder = "Elige un día",
  size = "md",
  "aria-label": ariaLabel,
  className = "",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (day: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  /** Submit the surrounding form as soon as a day is chosen. */
  submitOnChange?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
  className?: string;
}) {
  const id = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value || "");
  const [today, setToday] = useState("");
  const [invalid, setInvalid] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitPending = useRef(false);
  /** Move focus onto the focused day (on open and on keyboard moves, not on the month buttons). */
  const focusGrid = useRef(false);

  const outOfRange = (day: string) => Boolean((min && day < min) || (max && day > max));

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  useFloatingPanel({ open, triggerRef, panelRef, onDismiss: dismiss, matchWidth: false, maxHeight: 420 });

  const openPanel = () => {
    const now = clinicToday();
    setToday(now);
    setFocused(value || (outOfRange(now) ? (max && now > max ? max : (min ?? now)) : now));
    focusGrid.current = true;
    setOpen(true);
  };

  // Keep keyboard focus on the focused day while the panel is open.
  useEffect(() => {
    if (!open || !focusGrid.current) return;
    focusGrid.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus({ preventScroll: true });
  }, [open, focused]);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || controlled !== undefined) return;
    const onReset = () => setUncontrolled(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  useEffect(() => {
    if (!submitPending.current) return;
    submitPending.current = false;
    inputRef.current?.form?.requestSubmit();
  }, [value]);

  const choose = (day: string) => {
    if (outOfRange(day)) return;
    if (controlled === undefined) setUncontrolled(day);
    if (day !== value) {
      onValueChange?.(day);
      if (submitOnChange) submitPending.current = true;
    }
    setInvalid(false);
    close(true);
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -utc(focused).getUTCDay()),
      End: () => addDays(focused, 6 - utc(focused).getUTCDay()),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    };
    if (moves[event.key]) {
      event.preventDefault();
      focusGrid.current = true;
      setFocused(moves[event.key]());
    }
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  const days = open ? monthGrid(focused) : [];
  const shownMonth = monthOf(focused || "2000-01-01");
  const prevDisabled = Boolean(min && monthOf(addMonths(focused, -1)) < monthOf(min));
  const nextDisabled = Boolean(max && monthOf(addMonths(focused, 1)) > monthOf(max));
  const height = size === "sm" ? "h-9 px-2.5 text-[13px]" : "h-10 px-3 text-sm";

  return (
    <div className={`relative min-w-0 ${className}`} data-picker-open={open || undefined}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`group flex w-full min-w-0 items-center gap-2.5 rounded-lg border bg-white text-left text-navy outline-none transition-[border-color,box-shadow] focus-visible:border-navy focus-visible:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] ${
          open ? "border-navy shadow-[0_0_0_3px_rgba(27,42,85,0.1)]" : invalid ? "border-coral" : "border-outline hover:border-navy/50"
        } ${height}`}
      >
        <Icon name="calendar" className="size-4 text-teal" />
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-stone"}`}>
          {value ? capitalize(triggerDay.format(utc(value))) : placeholder}
        </span>
        <Icon name="chevron-down" className="size-4 text-stone transition-colors group-hover:text-navy" />
      </button>
      <input
        ref={inputRef}
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          triggerRef.current?.focus();
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
      />

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          role="dialog"
          aria-label={ariaLabel ?? "Elegir día"}
          onKeyDown={onPanelKeyDown}
          // The panel may sit inside a field's <label>: keep its clicks from
          // re-activating the trigger.
          onClick={(event) => event.preventDefault()}
          className={`${panelClass} w-[300px] p-3`}
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              onClick={() => setFocused(addMonths(focused, -1))}
              disabled={prevDisabled}
              aria-label="Mes anterior"
              className="grid size-8 place-items-center rounded-lg text-navy hover:bg-frost disabled:opacity-30"
            >
              <Icon name="chevron-left" className="size-4" />
            </button>
            <p className="text-sm font-semibold" aria-live="polite" id={`${id}-month`}>
              {capitalize(monthTitle.format(utc(`${shownMonth}-01`)))}
            </p>
            <button
              type="button"
              onClick={() => setFocused(addMonths(focused, 1))}
              disabled={nextDisabled}
              aria-label="Mes siguiente"
              className="grid size-8 place-items-center rounded-lg text-navy hover:bg-frost disabled:opacity-30"
            >
              <Icon name="chevron-right" className="size-4" />
            </button>
          </div>

          <div role="grid" aria-labelledby={`${id}-month`} ref={gridRef} onKeyDown={onGridKeyDown}>
            <div role="row" className="grid grid-cols-7 pb-1">
              {WEEKDAYS.map((d) => (
                <span key={d} role="columnheader" className="grid h-7 place-items-center text-[11px] font-medium tracking-[0.04em] text-stone uppercase">
                  {d}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7 gap-y-0.5">
                {days.slice(week * 7, week * 7 + 7).map((day) => {
                  const inMonth = monthOf(day) === shownMonth;
                  const isSelected = day === value;
                  const isToday = day === today;
                  const disabled = outOfRange(day);
                  return (
                    <span role="gridcell" key={day} aria-selected={isSelected} className="grid place-items-center">
                      <button
                        type="button"
                        data-day={day}
                        tabIndex={day === focused ? 0 : -1}
                        disabled={disabled}
                        aria-label={longDay.format(utc(day))}
                        aria-current={isToday ? "date" : undefined}
                        onClick={() => choose(day)}
                        className={`relative grid size-9 place-items-center rounded-lg text-[13px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal/60 disabled:cursor-not-allowed disabled:opacity-25 ${
                          isSelected
                            ? "bg-navy font-medium text-white"
                            : isToday
                              ? "font-semibold text-teal hover:bg-frost"
                              : inMonth
                                ? "text-navy hover:bg-frost"
                                : "text-stone/70 hover:bg-frost"
                        }`}
                      >
                        {Number(day.slice(8))}
                        {isToday && !isSelected && <span className="absolute bottom-1 size-1 rounded-full bg-teal" />}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-3">
            <div className="flex gap-1.5">
              {[
                ["Hoy", today],
                ["Mañana", today && addDays(today, 1)],
              ].map(([label, day]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!day || outOfRange(day)}
                  onClick={() => choose(day)}
                  className="h-8 rounded-full border border-line px-3 text-[13px] font-medium text-navy hover:border-navy disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
            {value && <span className="truncate text-[12px] text-muted">{triggerDay.format(utc(value))}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Times -----------------------------------------------------------------------

const timeLabel = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, "0");

/** "14:30" → "2:30 p. m." */
export const formatClock = (time: string) =>
  timeLabel.format(new Date(Date.UTC(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)))));

function timeOption(time: string): SelectOption {
  const minutes = minutesOf(time);
  const hour = Math.floor(minutes / 60);
  return {
    value: time,
    label: formatClock(time),
    group: hour < 12 ? "Mañana" : hour < 18 ? "Tarde" : "Noche",
    keywords: `${time} ${String(hour)}:${time.slice(3)} ${time.replace(":", "")}`,
  };
}

/** A time of day from a list of slots (every 15 minutes by default). */
export function TimePicker({
  name,
  defaultValue = "",
  from = "06:00",
  to = "21:00",
  step = 15,
  required,
  size,
  "aria-label": ariaLabel,
}: {
  name?: string;
  defaultValue?: string;
  from?: string;
  to?: string;
  step?: number;
  required?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const slots: string[] = [];
  for (let m = minutesOf(from); m <= minutesOf(to); m += step) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  // A time booked off the grid (say 08:05) stays selectable.
  if (defaultValue && !slots.includes(defaultValue)) slots.push(defaultValue);
  slots.sort();
  return (
    <Select
      name={name}
      defaultValue={defaultValue}
      options={slots.map(timeOption)}
      required={required}
      size={size}
      searchable={false}
      triggerIcon="clock"
      placeholder="Elige la hora"
      aria-label={ariaLabel}
      panelMinWidth={200}
    />
  );
}
