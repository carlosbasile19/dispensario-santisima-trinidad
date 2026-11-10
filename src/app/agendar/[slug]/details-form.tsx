"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { Icon } from "@/components/crm/icons";
import {
  DOCUMENT_LABEL,
  DOCUMENT_TYPES,
  formatDocumentInput,
  splitTypedDocument,
  type DocumentType,
} from "@/lib/booking/document";
import { formatPhoneInput } from "@/lib/booking/phone";
import { WHATSAPP_URL } from "@/lib/site-config";

export type DetailsValues = {
  documentType: DocumentType;
  /** The document number as typed ("12.345.678"). */
  document: string;
  notes: string;
  /** A new patient's details. */
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Receive the confirmation and a reminder by WhatsApp (offered when the clinic's number is connected). */
  whatsapp: boolean;
};

/** none: a cédula the centre may know · details: a new patient, who gives name, last name, email and mobile. */
export type Need = "none" | "details";

export type FormProblem = { message: string; field?: "document" | "phone" | "email" | "name" };

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
 * The patient's details. The cédula (or passport) finds the patient's
 * record, which is used as it is and never shown here. A document the centre
 * does not know asks for name, last name, email and mobile to register the
 * patient. A child without a cédula is booked by WhatsApp.
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
  offersWhatsApp = false,
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
  /** Offer the confirmation and reminder by WhatsApp. */
  offersWhatsApp?: boolean;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const firstName = useRef<HTMLInputElement>(null);
  const passport = values.documentType === "P";

  // Arriving at the step moves focus to its title, for keyboards and screen readers.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  // When the answer asks for the new patient's details, focus the first one.
  useEffect(() => {
    if (need === "details") firstName.current?.focus();
  }, [need]);

  const typeDocument = (value: string) => {
    // "V-12.345.678" typed whole also picks the type.
    const typed = passport ? null : splitTypedDocument(value);
    if (typed) onChange({ documentType: typed.type, document: formatDocumentInput(typed.type, typed.rest) });
    else onChange({ document: formatDocumentInput(values.documentType, value) });
  };

  const chooseType = (type: DocumentType) =>
    onChange({ documentType: type, document: formatDocumentInput(type, values.document) });

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
          Datos del paciente
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">
          Con la cédula encontramos la ficha del paciente si ya se ha atendido en el centro.
        </p>
      </div>

      <div className="lg:hidden">{summary}</div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor={`${id}-document`} className="text-[14px] font-medium text-navy">
            {passport ? "Pasaporte" : "Cédula de identidad"}
          </label>
          <div role="radiogroup" aria-label="Tipo de documento" className="inline-flex rounded-lg bg-sand p-0.5">
            {DOCUMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={values.documentType === type}
                onClick={() => chooseType(type)}
                className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                  values.documentType === type ? "bg-white text-navy shadow-[0_1px_2px_rgba(27,42,85,0.15)]" : "text-muted hover:text-navy"
                }`}
              >
                {DOCUMENT_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
        <div
          className={`flex h-12 items-center overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] ${
            problem?.field === "document" ? "border-coral" : "border-outline hover:border-navy/50 focus-within:border-navy"
          }`}
        >
          <span aria-hidden="true" className="flex h-full items-center border-r border-line bg-cream px-3.5 text-[16px] font-medium text-muted">
            {passport ? "Nº" : `${values.documentType}-`}
          </span>
          <input
            id={`${id}-document`}
            inputMode={passport ? "text" : "numeric"}
            autoComplete="off"
            autoCapitalize={passport ? "characters" : "off"}
            placeholder={passport ? "AB123456" : "12.345.678"}
            value={values.document}
            onChange={(e) => typeDocument(e.target.value)}
            aria-invalid={problem?.field === "document" || undefined}
            aria-describedby={`${id}-document-hint`}
            className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[16px] font-medium tracking-[0.02em] text-navy tabular-nums outline-none placeholder:font-normal placeholder:text-stone"
          />
        </div>
        <p id={`${id}-document-hint`} className="mt-1.5 text-[13px] leading-relaxed text-muted">
          La de quien va a la consulta: si la cita es para tu hijo, escribe su cédula. ¿No tiene cédula?{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-teal hover:text-navy">
            Agéndala por WhatsApp
          </a>
          .
        </p>
      </div>

      {need === "details" && (
        <>
          {needMessage && (
            <p role="status" className="booking-enter flex gap-3 rounded-xl bg-frost px-4 py-3 text-[14px] leading-relaxed text-navy">
              <Icon name="note" className="mt-0.5 size-[18px] shrink-0 text-teal" />
              {needMessage}
            </p>
          )}
          <div className="booking-enter grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-first`}>Nombre</Label>
              <input
                ref={firstName}
                id={`${id}-first`}
                autoComplete="given-name"
                maxLength={80}
                value={values.firstName}
                onChange={(e) => onChange({ firstName: e.target.value })}
                aria-invalid={(problem?.field === "name" && !values.firstName.trim()) || undefined}
                className={input}
              />
            </div>
            <div>
              <Label htmlFor={`${id}-last`}>Apellido</Label>
              <input
                id={`${id}-last`}
                autoComplete="family-name"
                maxLength={80}
                value={values.lastName}
                onChange={(e) => onChange({ lastName: e.target.value })}
                aria-invalid={(problem?.field === "name" && !values.lastName.trim()) || undefined}
                className={input}
              />
            </div>
          </div>
          <div className="booking-enter">
            <Label htmlFor={`${id}-phone`} hint="Para confirmar la cita">
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
              className={`${input} tabular-nums`}
            />
          </div>
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
        </>
      )}

      <div>
        <Label htmlFor={`${id}-notes`} hint="Opcional">
          Notas para la cita
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

      {offersWhatsApp && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={values.whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.checked })}
            className="mt-0.5 size-[18px] shrink-0 accent-navy"
          />
          <span className="text-[14px] leading-relaxed text-navy">
            Recibir la confirmación y un recordatorio de la cita por WhatsApp
            <span className="mt-0.5 block text-[13px] text-muted">
              Del Centro Médico Integral Santísima Trinidad, {need === "details" ? "al celular que escribiste" : "al celular de tu ficha"}.
              Puedes pedirnos que dejemos de escribirte cuando quieras.
            </span>
          </span>
        </label>
      )}

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
          Por tu privacidad, esta página nunca muestra los datos de la ficha. Para actualizarlos, avísanos en recepción.
        </p>
      </div>
    </form>
  );
}
