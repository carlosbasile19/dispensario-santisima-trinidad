"use client";

import { useState } from "react";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { Select } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { Switch } from "@/components/crm/switch";
import { isSlug, slugify } from "@/lib/booking/slug";
import { saveCalendarSettings } from "./actions";

const NOTICE = [
  { value: "0", label: "Sin mínimo", description: "Hasta el inicio del cupo" },
  { value: "1", label: "1 hora antes" },
  { value: "2", label: "2 horas antes" },
  { value: "4", label: "4 horas antes" },
  { value: "12", label: "12 horas antes" },
  { value: "24", label: "1 día antes" },
  { value: "48", label: "2 días antes" },
];
const HORIZON = [
  { value: "7", label: "1 semana" },
  { value: "14", label: "2 semanas" },
  { value: "30", label: "1 mes" },
  { value: "60", label: "2 meses" },
  { value: "90", label: "3 meses" },
];

export type CalendarSettings = {
  id: string;
  slug: string;
  specialty: string | null;
  intro: string | null;
  accepting: boolean;
  minNoticeHours: number;
  horizonDays: number;
};

/** What patients see and when they can book: open or paused, the texts, notice, horizon and the link. */
export function SettingsForm({ calendar }: { calendar: CalendarSettings }) {
  const [slug, setSlug] = useState(calendar.slug);
  const changedSlug = slug !== calendar.slug;
  const validSlug = isSlug(slug);

  return (
    <ActionForm action={saveCalendarSettings} className="flex flex-col gap-5 px-5 py-5">
      <input type="hidden" name="calendar" value={calendar.id} />

      <Switch
        name="accepting"
        defaultChecked={calendar.accepting}
        label="Recibe citas en línea"
        description="En pausa, el enlace sigue abierto y pide a los pacientes escribir por WhatsApp."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Especialidad" hint="Bajo el nombre del médico.">
          <input
            name="specialty"
            maxLength={80}
            defaultValue={calendar.specialty ?? ""}
            placeholder="Medicina general"
            className={inputClass}
          />
        </Field>
        <Field label="Enlace" hint={changedSlug ? "Los enlaces enviados antes dejarán de funcionar." : "Minúsculas, números y guiones."}>
          <span
            className={`flex h-10 items-center overflow-hidden rounded-lg border bg-white text-sm transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] ${
              validSlug ? "border-outline focus-within:border-navy" : "border-coral"
            }`}
          >
            <span className="flex h-full items-center border-r border-line bg-sand px-2.5 text-stone">/agendar/</span>
            <input
              name="slug"
              required
              maxLength={60}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              onBlur={() => setSlug((current) => slugify(current) || current)}
              aria-invalid={!validSlug || undefined}
              className="h-full min-w-0 flex-1 px-2.5 text-navy outline-none"
            />
          </span>
        </Field>
      </div>

      <Field label="Presentación (opcional)" hint="Unas palabras para los pacientes en la página de reservas.">
        <textarea
          name="intro"
          rows={2}
          maxLength={400}
          defaultValue={calendar.intro ?? ""}
          placeholder="Consulta de medicina general para adultos y niños. Trae tus exámenes recientes."
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Anticipación mínima" hint="Lo más tarde que se puede agendar un cupo.">
          <Select
            name="min_notice_hours"
            defaultValue={String(calendar.minNoticeHours)}
            options={NOTICE}
            searchable={false}
            triggerIcon="clock"
          />
        </Field>
        <Field label="Se puede agendar con" hint="Hasta cuánto tiempo por delante.">
          <Select
            name="horizon_days"
            defaultValue={String(calendar.horizonDays)}
            options={HORIZON.some((o) => o.value === String(calendar.horizonDays)) ? HORIZON : [...HORIZON, { value: String(calendar.horizonDays), label: `${calendar.horizonDays} días` }]}
            searchable={false}
            triggerIcon="calendar"
          />
        </Field>
      </div>

      <div>
        <SubmitButton icon="check" pendingLabel="Guardando…" disabled={!validSlug}>
          Guardar ajustes
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
