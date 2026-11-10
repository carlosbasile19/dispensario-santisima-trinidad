"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";

import { Icon } from "@/components/crm/icons";
import { cleanDocument, isValidDocument } from "@/lib/booking/document";
import { isBookingPhone, normalizePhone } from "@/lib/booking/phone";
import type { BookedVisit, BookingCalendar, BookingService } from "@/lib/booking/types";
import { AREA_ICON, formatDay } from "@/lib/crm/clinic";
import { addMinutes, formatClock, monthOf, shiftDay, slotLabel } from "@/lib/crm/schedule";
import { ADDRESS_SHORT, WHATSAPP_URL } from "@/lib/site-config";
import { bookOnline } from "../actions";
import { ProfessionalAvatar } from "../professional-avatar";
import { BookingDone } from "./booking-done";
import { DetailsForm, type DetailsValues, type FormProblem, type Need } from "./details-form";
import { MonthCalendar } from "./month-calendar";
import { TimeSlots } from "./time-slots";

// The booking page of one calendar (patterns from Mobbin: Cal.com and
// Calendly's three-column picker, Zocdoc and Square's short checkout). Three
// steps on one page: pick the service, day and time; give the patient's
// cédula (and, for a new patient, name, last name, email and mobile); done. All free slots of the horizon arrive with the page, so moving
// between days needs no round trip. If a slot is taken meanwhile, the page
// reloads its slots and keeps what the patient typed.

type Step = "pick" | "details" | "done";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMPTY: DetailsValues = {
  documentType: "V",
  document: "",
  notes: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  whatsapp: true,
};

const firstDayOf = (service: BookingService | undefined) =>
  service ? (Object.keys(service.slots).sort().find((day) => service.slots[day].length) ?? null) : null;

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function BookingFlow({
  calendar,
  initialServiceId,
  offersWhatsApp = false,
}: {
  calendar: BookingCalendar;
  initialServiceId?: string;
  /** The clinic's WhatsApp is connected: the form offers the confirmation by WhatsApp. */
  offersWhatsApp?: boolean;
}) {
  const router = useRouter();
  const { services, today } = calendar;
  const lastDay = shiftDay(today, calendar.horizonDays);
  const initial = services.find((s) => s.id === initialServiceId) ?? services[0];

  const [serviceId, setServiceId] = useState(initial.id);
  const [day, setDay] = useState<string | null>(() => firstDayOf(initial));
  const [month, setMonth] = useState(() => monthOf(firstDayOf(initial) ?? today));
  const [time, setTime] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [notice, setNotice] = useState<string | null>(null);
  const [values, setValues] = useState<DetailsValues>(EMPTY);
  const [need, setNeed] = useState<Need>("none");
  const [needMessage, setNeedMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [visit, setVisit] = useState<BookedVisit | null>(null);
  const [pending, startTransition] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);

  const service = services.find((s) => s.id === serviceId) ?? initial;
  // Fresh slots can arrive at any time (router.refresh), so the chosen day and
  // time count only while they are still free.
  const times = day ? (service.slots[day] ?? []) : [];
  const chosenTime = time && times.includes(time) ? time : null;
  const hasSlots = firstDayOf(service) !== null;

  const scrollToTop = () => {
    const card = top.current;
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseService = (id: string) => {
    const next = services.find((s) => s.id === id);
    if (!next) return;
    setServiceId(id);
    setTime(null);
    setNotice(null);
    if (!day || !next.slots[day]?.length) {
      const first = firstDayOf(next);
      setDay(first);
      if (first) setMonth(monthOf(first));
    }
  };

  const chooseDay = (next: string) => {
    setDay(next);
    setTime(null);
    setNotice(null);
    // On phones the times sit under the calendar: bring them into view.
    if (!isDesktop()) {
      requestAnimationFrame(() => timesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const goToDetails = () => {
    if (!day || !chosenTime) return;
    setStep("details");
    setProblem(null);
    scrollToTop();
  };

  const backToPick = () => {
    setStep("pick");
    setProblem(null);
    scrollToTop();
  };

  const change = (patch: Partial<DetailsValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
    // Another document may belong to a known patient: ask again from the start.
    if ((patch.document !== undefined || patch.documentType !== undefined) && need !== "none") {
      setNeed("none");
      setNeedMessage(null);
    }
  };

  const submit = () => {
    if (!day || !time) return backToPick();
    const askDetails = need === "details";
    if (!isValidDocument(values.documentType, values.document)) {
      return setProblem({
        field: "document",
        message:
          values.documentType === "P"
            ? "Revisa el pasaporte: de 4 a 15 letras y números."
            : "Revisa la cédula: de 5 a 10 números.",
      });
    }
    if (askDetails && (!values.firstName.trim() || !values.lastName.trim())) {
      return setProblem({ field: "name", message: "Escribe el nombre y el apellido del paciente." });
    }
    if (askDetails && !isBookingPhone(normalizePhone(values.phone))) {
      return setProblem({
        field: "phone",
        message: "Escribe un número de celular: 04xx-xxxxxxx, o con el código del país si es del exterior (+…).",
      });
    }
    if (askDetails && !EMAIL.test(values.email.trim())) {
      return setProblem({ field: "email", message: "Escribe un correo electrónico válido." });
    }

    setProblem(null);
    startTransition(async () => {
      const result = await bookOnline({
        calendarId: calendar.id,
        serviceId: service.id,
        day,
        time,
        documentType: values.documentType,
        documentNumber: cleanDocument(values.documentType, values.document),
        notes: values.notes,
        whatsapp: offersWhatsApp ? values.whatsapp : undefined,
        firstName: askDetails ? values.firstName : undefined,
        lastName: askDetails ? values.lastName : undefined,
        email: askDetails ? values.email : undefined,
        phone: askDetails ? values.phone : undefined,
      });
      if (result.status === "booked") {
        setVisit(result.visit);
        setStep("done");
        scrollToTop();
        router.refresh();
      } else if (result.status === "needs_details") {
        setNeed("details");
        setNeedMessage(result.message);
      } else if (result.reason === "slot_taken") {
        setTime(null);
        setStep("pick");
        setNotice(result.message);
        scrollToTop();
        router.refresh();
      } else {
        const field = result.reason === "document" || result.reason === "phone" || result.reason === "email" ? result.reason : undefined;
        setProblem({ message: result.message, field });
      }
    });
  };

  const bookAnother = () => {
    setVisit(null);
    setTime(null);
    setStep("pick");
    setNeed("none");
    setNeedMessage(null);
    setValues(EMPTY);
    scrollToTop();
    router.refresh();
  };

  const summary = day && time && (
    <SlotSummary
      service={service}
      day={day}
      time={time}
      onChange={step === "details" ? backToPick : undefined}
    />
  );

  return (
    <div ref={top} className="scroll-mt-4">
      <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_30px_80px_-40px_rgba(27,42,85,0.45)]">
        <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
          {/* Who and what */}
          <aside className="flex flex-col gap-6 border-b border-line bg-[#fcfbf8] p-5 sm:p-7 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <ProfessionalAvatar name={calendar.name} src={calendar.avatarUrl} />
              <div className="min-w-0">
                <p className="text-[12px] tracking-[0.16em] text-teal uppercase">Agenda tu cita</p>
                <h1 className="mt-1 font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-balance sm:text-[30px]">
                  {calendar.name}
                </h1>
                {calendar.specialty && <p className="mt-1 text-[15px] text-muted">{calendar.specialty}</p>}
              </div>
            </div>
            {calendar.intro && step === "pick" && (
              <p className="text-[14px] leading-relaxed text-ink">{calendar.intro}</p>
            )}

            {step === "pick" ? (
              <ServicePicker services={services} selected={service.id} onSelect={chooseService} />
            ) : (
              <div className="hidden lg:block">{visit ? <SlotSummary service={service} day={visit.day} time={visit.time} /> : summary}</div>
            )}

            <VisitInfo minutes={service.minutes} className="hidden border-t border-line pt-5 lg:flex" />
          </aside>

          {/* When, then who */}
          <section className="min-w-0 p-5 sm:p-7 lg:p-8">
            {step === "pick" && (
              <div className="booking-enter">
                {notice && (
                  <p role="alert" className="mb-5 flex gap-2.5 rounded-xl bg-coral/10 px-4 py-3 text-[14px] text-[#b03a36]">
                    <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                    {notice}
                  </p>
                )}
                {hasSlots ? (
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_236px] lg:gap-7">
                    <div>
                      <h2 className="mb-4 font-serif text-[24px] leading-tight lg:hidden">Elige el día y la hora</h2>
                      <MonthCalendar
                        month={month}
                        today={today}
                        lastDay={lastDay}
                        slotsByDay={service.slots}
                        selected={day}
                        onMonthChange={setMonth}
                        onSelect={chooseDay}
                      />
                    </div>
                    <div ref={timesRef} className="scroll-mt-4 lg:border-l lg:border-line lg:pl-7">
                      <TimeSlots day={day} times={times} minutes={service.minutes} selected={chosenTime} onSelect={setTime} />
                      <div className="mt-6 hidden lg:block">
                        <ContinueButton disabled={!chosenTime} onClick={goToDetails} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <NoSlots />
                )}
                {/* Phones: where and when, after the calendar rather than before it. */}
                <VisitInfo minutes={service.minutes} className="mt-8 flex border-t border-line pt-5 lg:hidden" />
              </div>
            )}

            {step === "details" && day && time && (
              <DetailsForm
                values={values}
                onChange={change}
                need={need}
                needMessage={needMessage}
                problem={problem}
                pending={pending}
                onSubmit={submit}
                onBack={backToPick}
                summary={summary}
                offersWhatsApp={offersWhatsApp}
              />
            )}

            {step === "done" && visit && <BookingDone visit={visit} onBookAnother={bookAnother} />}
          </section>
        </div>
      </div>

      {/* Phones: the chosen slot and "Continuar" stay at hand. */}
      {step === "pick" && chosenTime && day && (
        <div className="booking-bar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-20px_rgba(27,42,85,0.4)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[640px] items-center gap-4">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[14px] font-medium first-letter:uppercase">{formatDay(day, "long")}</p>
              <p className="text-[13px] whitespace-nowrap text-muted">
                {formatClock(chosenTime)} – {formatClock(addMinutes(chosenTime, service.minutes))}
              </p>
            </div>
            <div className="w-[150px] shrink-0">
              <ContinueButton onClick={goToDetails} />
            </div>
          </div>
        </div>
      )}
      {step === "pick" && chosenTime && <div aria-hidden="true" className="h-20 lg:hidden" />}
    </div>
  );
}

/** The slot length, the address and the time zone of the visit. */
function VisitInfo({ minutes, className }: { minutes: number; className: string }) {
  return (
    <ul className={`flex-col gap-2.5 text-[14px] text-ink ${className}`}>
      <li className="flex items-center gap-2.5">
        <Icon name="clock" className="size-[18px] shrink-0 text-teal" />
        Cupos de {slotLabel(minutes)}
      </li>
      <li className="flex items-start gap-2.5">
        <Icon name="map-pin" className="mt-px size-[18px] shrink-0 text-teal" />
        {ADDRESS_SHORT}
      </li>
      <li className="flex items-center gap-2.5">
        <Icon name="globe" className="size-[18px] shrink-0 text-teal" />
        Hora de Venezuela
      </li>
    </ul>
  );
}

function ContinueButton({ disabled = false, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white transition-colors hover:bg-teal disabled:bg-outline/60 disabled:text-white"
    >
      Continuar
      <Icon name="arrow-right" className="size-4" />
    </button>
  );
}

function ServicePicker({
  services,
  selected,
  onSelect,
}: {
  services: BookingService[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (services.length === 1) {
    const [only] = services;
    return (
      <div>
        <p className="mb-2 text-[12px] tracking-[0.14em] text-stone uppercase">Servicio</p>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frost text-navy">
            <Icon name={AREA_ICON[only.area]} className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{only.name}</span>
            <span className="block text-[13px] text-muted">{slotLabel(only.minutes)}</span>
          </span>
        </div>
      </div>
    );
  }
  return (
    <fieldset>
      <legend className="mb-2 text-[12px] tracking-[0.14em] text-stone uppercase">¿Qué necesitas?</legend>
      <div className="flex flex-col gap-2">
        {services.map((s) => {
          const isSelected = s.id === selected;
          return (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ${
                isSelected
                  ? "border-navy bg-white shadow-[0_0_0_1px_var(--color-navy)]"
                  : "border-line bg-white hover:border-outline"
              }`}
            >
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={isSelected}
                onChange={() => onSelect(s.id)}
                className="sr-only"
              />
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
                  isSelected ? "bg-navy text-white" : "bg-frost text-navy"
                }`}
              >
                <Icon name={AREA_ICON[s.area]} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-medium">{s.name}</span>
                <span className="block text-[13px] text-muted">{slotLabel(s.minutes)}</span>
              </span>
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${
                  isSelected ? "border-navy bg-navy text-white" : "border-outline"
                }`}
              >
                {isSelected && <Icon name="check" className="size-3" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SlotSummary({
  service,
  day,
  time,
  onChange,
}: {
  service: BookingService;
  day: string;
  time: string;
  onChange?: () => void;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-white">
          <Icon name="calendar" className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-[15px] font-medium first-letter:uppercase">{formatDay(day, "long")}</p>
          <p className="text-[14px] text-muted">
            <span className="whitespace-nowrap">{formatClock(time)}</span> –{" "}
            <span className="whitespace-nowrap">{formatClock(addMinutes(time, service.minutes))}</span>
          </p>
          <p className="mt-1 text-[14px] text-ink">{service.name}</p>
          {onChange && (
            <button type="button" onClick={onChange} className="mt-2 text-[13px] font-medium text-teal hover:text-navy">
              Cambiar fecha u hora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NoSlots() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-frost text-navy">
        <Icon name="calendar" className="size-5" />
      </span>
      <p className="mt-4 text-[16px] font-medium">No quedan horarios libres por ahora</p>
      <p className="mt-1 max-w-[42ch] text-[14px] text-muted">
        Los cupos de las próximas semanas ya están tomados. Escríbenos y te buscamos un espacio.
      </p>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white hover:bg-teal"
      >
        <Icon name="chat" className="size-4" />
        Escríbenos por WhatsApp
      </a>
    </div>
  );
}
