"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { Icon } from "@/components/crm/icons";
import { formatPhoneInput } from "@/lib/booking/phone";

export type DetailsValues = {
  phone: string;
  notes: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Booking for someone else (a child, a relative) on this number. */
  other: boolean;
};

/** Which extra fields the patient must fill: none (a known number), the name, or name and email (a new patient). */
export type Need = "none" | "name" | "details";

export type FormProblem = { message: string; field?: "phone" | "email" | "name" };

const input =
  "h-12 w-full min-w-0 rounded-xl border border-outline bg-white px-3.5 text-[16px] text-navy outline-none transition-[border-color,box-shadow] placeholder:text-stone hover:border-navy/50 focus:border-navy focus:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] aria-invalid:border-coral aria-invalid:focus:shadow-[0_0_0_3px_rgba(217,83,79,0.14)]";

function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-navy">
        {children}
      </label>
      {hint && <span className="text-[12px] text-stone">{hint}</span>}
    </div>
  );
}

/**
 * The patient's details. A known number books with nothing else: the
 * patient's record is used as it is and never shown here. A new number, or a
 * booking for someone else, asks for name, last name and email; a number that
 * several patients share asks whose visit it is.
 */
export function DetailsForm({
  values,
  onChange,
  need,
  needMessage,
  problem,
  pending,
  onSubmit,
  onBack,
  summary,
}: {
  values: DetailsValues;
  onChange: (patch: Partial<DetailsValues>) => void;
  need: Need;
  needMessage: string | null;
  problem: FormProblem | null;
  pending: boolean;
  onSubmit: () => void;
  onBack: () => void;
  /** The chosen slot, shown above the form on small screens. */
  summary: ReactNode;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const firstName = useRef<HTMLInputElement>(null);
  const askDetails = need === "details" || values.other;
  const askName = askDetails || need === "name";

  // Arriving at the step moves focus to its title, for keyboards and screen readers.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  // When the answer asks for more, focus the first new field.
  useEffect(() => {
    if (need !== "none") firstName.current?.focus();
  }, [need]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} noValidate className="booking-enter flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 self-start text-[14px] text-muted transition-colors hover:text-navy"
      >
        <Icon name="arrow-left" className="size-4" />
        Cambiar fecha u hora
      </button>

      <div>
        <h2 ref={heading} tabIndex={-1} className="font-serif text-[30px] leading-tight tracking-[-0.01em] outline-none">
          Tus datos
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">
          Con tu número de celular encontramos tu ficha si ya eres paciente del centro.
        </p>
      </div>

      <div className="lg:hidden">{summary}</div>

      <div>
        <Label htmlFor={`${id}-phone`} hint="Obligatorio">
          Número de celular
        </Label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0412-1234567"
          value={values.phone}
          onChange={(e) => onChange({ phone: formatPhoneInput(e.target.value) })}
          aria-invalid={problem?.field === "phone" || undefined}
          aria-describedby={`${id}-phone-hint`}
          className={`${input} font-medium tracking-[0.01em] tabular-nums`}
        />
        <p id={`${id}-phone-hint`} className="mt-1.5 text-[13px] text-muted">
          Lo usamos para reconocerte y confirmar tu cita. Si vives fuera, escríbelo con el código de tu país (+…).
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-cream/60 px-4 py-3 text-[14px] text-ink transition-colors hover:border-outline">
        <input
          type="checkbox"
          checked={values.other}
          onChange={(e) => onChange({ other: e.target.checked })}
          className="mt-0.5 size-[18px] shrink-0 accent-navy"
        />
        <span>
          <span className="font-medium text-navy">La cita es para otra persona</span>
          <span className="block text-[13px] text-muted">Un hijo, tu pareja o un familiar que use tu número.</span>
        </span>
      </label>

      {needMessage && !values.other && (
        <p role="status" className="booking-enter flex gap-3 rounded-xl bg-frost px-4 py-3 text-[14px] leading-relaxed text-navy">
          <Icon name="note" className="mt-0.5 size-[18px] shrink-0 text-teal" />
          {needMessage}
        </p>
      )}

      {askName && (
        <div className="booking-enter grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-first`}>{values.other ? "Nombre del paciente" : "Nombre"}</Label>
            <input
              ref={firstName}
              id={`${id}-first`}
              autoComplete={values.other ? "off" : "given-name"}
              maxLength={80}
              value={values.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              aria-invalid={(problem?.field === "name" && !values.firstName.trim()) || undefined}
              className={input}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-last`}>{values.other ? "Apellido del paciente" : "Apellido"}</Label>
            <input
              id={`${id}-last`}
              autoComplete={values.other ? "off" : "family-name"}
              maxLength={80}
              value={values.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              aria-invalid={(problem?.field === "name" && !values.lastName.trim()) || undefined}
              className={input}
            />
          </div>
        </div>
      )}

      {askDetails && (
        <div className="booking-enter">
          <Label htmlFor={`${id}-email`}>Correo electrónico</Label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={120}
            placeholder="nombre@correo.com"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            aria-invalid={problem?.field === "email" || undefined}
            className={input}
          />
        </div>
      )}

      <div>
        <Label htmlFor={`${id}-notes`} hint="Opcional">
          Notas para tu cita
        </Label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={1000}
          placeholder="El motivo de la consulta, síntomas o algo que el médico deba saber."
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={`${input} h-auto resize-y py-3 leading-relaxed`}
        />
      </div>

      {problem && (
        <p role="alert" className="flex gap-2.5 rounded-xl bg-coral/10 px-4 py-3 text-[14px] text-[#b03a36]">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {problem.message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 text-[16px] font-medium text-white transition-colors hover:bg-teal disabled:opacity-70"
        >
          {pending ? (
            <>
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Agendando…
            </>
          ) : (
            <>
              <Icon name="calendar-check" className="size-[18px]" />
              Confirmar cita
            </>
          )}
        </button>
        <p className="flex gap-2 text-[12px] leading-relaxed text-stone">
          <Icon name="lock" className="mt-px size-3.5 shrink-0" />
          Por tu privacidad, esta página nunca muestra los datos de tu ficha. Para actualizarlos, avísanos en recepción.
        </p>
      </div>
    </form>
  );
}
