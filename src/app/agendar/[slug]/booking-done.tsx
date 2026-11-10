"use client";

import { useEffect, useRef } from "react";

import { Icon, type IconName } from "@/components/crm/icons";
import { googleCalendarUrl, icsFile } from "@/lib/booking/calendar-export";
import type { BookedVisit } from "@/lib/booking/types";
import { formatDay } from "@/lib/crm/clinic";
import { addMinutes, formatClock, slotLabel } from "@/lib/crm/schedule";
import { ADDRESS_SHORT, MAPS_URL, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "@/lib/site-config";

const secondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-outline bg-white px-4 text-[14px] font-medium text-navy transition-colors hover:border-navy";

function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frost text-navy">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] tracking-[0.06em] text-stone uppercase">{label}</dt>
        <dd className="mt-0.5 text-[15px] text-navy">{children}</dd>
      </div>
    </div>
  );
}

/** The booked visit, with "add to my calendar", directions and what to bring. */
export function BookingDone({ visit, onBookAnother }: { visit: BookedVisit; onBookAnother: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([icsFile(visit)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cita-santisima-trinidad.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="booking-enter flex flex-col gap-6">
      <div>
        <span className="booking-pop grid size-14 place-items-center rounded-full bg-mint/40 text-[#135c62]">
          <Icon name="check" className="size-7" />
        </span>
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-5 font-serif text-[32px] leading-[1.08] tracking-[-0.015em] outline-none sm:text-[36px]"
        >
          ¡Tu cita está agendada!
        </h2>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">
          Te esperamos el <span className="font-medium text-navy">{formatDay(visit.day, "long")}</span> a las{" "}
          <span className="font-medium text-navy">{formatClock(visit.time)}</span>
          {visit.professional ? ` con ${visit.professional}` : ""}.
        </p>
        {visit.registered && (
          <p className="mt-2 text-[14px] text-muted">
            Creamos tu ficha con los datos que nos diste. En recepción te pediremos tu cédula.
          </p>
        )}
      </div>

      <dl className="divide-y divide-line rounded-2xl border border-line px-4">
        <Row icon="stethoscope" label="Servicio">
          {visit.service} <span className="text-muted">· {slotLabel(visit.minutes)}</span>
        </Row>
        <Row icon="calendar" label="Fecha y hora">
          <span className="first-letter:uppercase">{formatDay(visit.day, "full")}</span>
          <span className="block text-muted">
            {formatClock(visit.time)} – {formatClock(addMinutes(visit.time, visit.minutes))} · hora de Venezuela
          </span>
        </Row>
        <Row icon="map-pin" label="Dónde">
          {ADDRESS_SHORT}
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1 text-[14px] font-medium text-teal hover:text-navy"
          >
            Cómo llegar
            <Icon name="external" className="size-3.5" />
          </a>
        </Row>
      </dl>

      <div className="grid gap-2 sm:grid-cols-2">
        <a href={googleCalendarUrl(visit)} target="_blank" rel="noopener noreferrer" className={secondary}>
          <Icon name="calendar-check" className="size-[18px] text-teal" />
          Añadir a Google Calendar
        </a>
        <button type="button" onClick={downloadIcs} className={secondary}>
          <Icon name="download" className="size-[18px] text-teal" />
          Apple u otro calendario
        </button>
      </div>

      <div className="rounded-2xl bg-sand px-5 py-4">
        <p className="text-[12px] tracking-[0.14em] text-teal uppercase">Antes de tu cita</p>
        <ul className="mt-2.5 flex flex-col gap-2 text-[14px] leading-relaxed text-ink">
          <li className="flex gap-2.5">
            <Icon name="clock" className="mt-0.5 size-4 shrink-0 text-teal" />
            Llega 10 minutos antes y trae tu cédula.
          </li>
          <li className="flex gap-2.5">
            <Icon name="chat" className="mt-0.5 size-4 shrink-0 text-teal" />
            <span>
              Para cambiarla o cancelarla,{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-navy underline-offset-2 hover:underline">
                escríbenos por WhatsApp
              </a>{" "}
              o llama al{" "}
              <a href={PHONE_TEL} className="font-medium whitespace-nowrap text-navy underline-offset-2 hover:underline">
                {PHONE_DISPLAY}
              </a>
              .
            </span>
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onBookAnother}
        className="self-start text-[14px] font-medium text-teal underline-offset-4 hover:text-navy hover:underline"
      >
        Agendar otra cita
      </button>
    </div>
  );
}
