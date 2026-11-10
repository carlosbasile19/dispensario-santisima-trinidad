"use client";

import { useState } from "react";

import { DatePicker } from "@/components/crm/date-picker";
import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Icon, type IconName } from "@/components/crm/icons";
import { Modal } from "@/components/crm/modal";
import { inputClass } from "@/components/crm/styles";
import { rangesProblem, type Range } from "@/lib/crm/schedule";
import { deleteSpecialDay, saveSpecialDay } from "./actions";
import { RangesEditor } from "./ranges-editor";

type Mode = "closed" | "hours";

const MODES: { value: Mode; icon: IconName; title: string; text: string }[] = [
  { value: "closed", icon: "pause", title: "No atiende ese día", text: "Vacaciones, un congreso o un feriado." },
  { value: "hours", icon: "clock", title: "Atiende en otro horario", text: "Solo ese día, en lugar del horario semanal." },
];

/** "Añadir día especial": a day off, or other hours on one date. */
export function AddSpecialDay({ calendarId, today }: { calendarId: string; today: string }) {
  return (
    <Modal
      trigger="Añadir día"
      triggerIcon="plus"
      triggerVariant="secondary"
      title="Día especial"
      description="Para una fecha concreta. Reemplaza el horario semanal de ese día; los demás días no cambian."
      icon="calendar"
    >
      <SpecialDayForm calendarId={calendarId} today={today} />
    </Modal>
  );
}

function SpecialDayForm({ calendarId, today }: { calendarId: string; today: string }) {
  const [mode, setMode] = useState<Mode>("closed");
  const [ranges, setRanges] = useState<Range[]>([{ starts: "08:00", ends: "12:00" }]);
  const invalid = mode === "hours" && (ranges.length === 0 || rangesProblem(ranges) !== null);

  return (
    <ActionForm action={saveSpecialDay} className="flex flex-col gap-5">
      <input type="hidden" name="calendar" value={calendarId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="ranges" value={JSON.stringify(mode === "hours" ? ranges : [])} />

      <Field label="Fecha">
        <DatePicker name="day" required defaultValue={today} min={today} />
      </Field>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Ese día</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
              mode === m.value ? "border-navy bg-frost/50 shadow-[0_0_0_1px_var(--color-navy)]" : "border-line hover:border-outline"
            }`}
          >
            <input
              type="radio"
              name="mode-choice"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="sr-only"
            />
            <Icon name={m.icon} className={`mt-0.5 size-[18px] ${mode === m.value ? "text-navy" : "text-stone"}`} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{m.title}</span>
              <span className="block text-[12px] text-muted">{m.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "hours" && <RangesEditor ranges={ranges} onChange={setRanges} label="Ese día" />}

      <Field label="Motivo (opcional)" hint="Solo lo ve el equipo, no los pacientes.">
        <input name="note" maxLength={120} placeholder="Vacaciones, congreso, jornada médica…" className={inputClass} />
      </Field>

      <ModalActions>
        <SubmitButton icon="check" pendingLabel="Guardando…" disabled={invalid}>
          Guardar día
        </SubmitButton>
      </ModalActions>
    </ActionForm>
  );
}

/** Removes a special day: the date goes back to its weekly hours. */
export function RemoveSpecialDay({ calendarId, day, label }: { calendarId: string; day: string; label: string }) {
  return (
    <ActionForm action={deleteSpecialDay} className="flex shrink-0 items-center [&>p]:sr-only">
      <input type="hidden" name="calendar" value={calendarId} />
      <input type="hidden" name="day" value={day} />
      <button
        type="submit"
        aria-label={`Quitar el día especial del ${label}`}
        title="Quitar"
        className="grid size-8 place-items-center rounded-lg text-stone transition-colors hover:bg-sand hover:text-[#b03a36]"
      >
        <Icon name="trash" className="size-4" />
      </button>
    </ActionForm>
  );
}
