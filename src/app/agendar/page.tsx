import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon, type IconName } from "@/components/crm/icons";
import { getBookingDirectory } from "@/lib/booking/data";
import { WHATSAPP_URL } from "@/lib/site-config";
import { ProfessionalAvatar } from "./professional-avatar";

export const metadata: Metadata = {
  title: "Agenda tu cita en línea",
  description:
    "Elige con quién quieres atenderte, el día y la hora. Agenda tu cita en el Centro Médico Integral Santísima Trinidad, Ciudad Bolívar, sin llamadas.",
};

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: "calendar-check", title: "En pocos pasos", text: "Eliges el día y la hora que te quedan mejor." },
  { icon: "id-card", title: "Con tu cédula", text: "Sin crear cuentas ni contraseñas." },
  { icon: "lock", title: "Datos protegidos", text: "Tu ficha nunca se muestra en la página." },
];

// The general booking link: every professional whose calendar takes online
// bookings. The heading is static; the list streams in.
export default function BookingDirectoryPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      <div className="hero-stagger max-w-[680px]">
        <p className="text-[13px] tracking-[0.16em] text-teal uppercase">Agenda en línea</p>
        <h1 className="mt-4 font-serif text-[clamp(40px,6vw,64px)] leading-[1.02] tracking-[-0.02em] text-balance">
          Tu cita, <i className="text-teal">cuando te quede mejor.</i>
        </h1>
        <p className="mt-5 text-[18px] leading-relaxed text-pretty text-ink">
          Elige con quién quieres atenderte y reserva el día y la hora. Te esperamos en el centro.
        </p>
      </div>

      <ul className="mt-9 grid gap-x-8 gap-y-3 border-y border-line py-5 sm:grid-cols-3">
        {PROMISES.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <Icon name={p.icon} className="mt-0.5 size-5 shrink-0 text-teal" />
            <span className="text-[14px] leading-snug text-ink">
              <span className="block font-medium text-navy">{p.title}</span>
              {p.text}
            </span>
          </li>
        ))}
      </ul>

      <Suspense fallback={<DirectorySkeleton />}>
        <Directory />
      </Suspense>
    </div>
  );
}

async function Directory() {
  const entries = await getBookingDirectory();
  if (entries === "unavailable" || entries.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-line bg-white p-7">
        <p className="text-[16px] text-ink">
          {entries === "unavailable"
            ? "La reserva en línea no está disponible en este momento."
            : "Muy pronto podrás agendar en línea con nuestros médicos."}{" "}
          Mientras tanto, te atendemos por WhatsApp.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white hover:bg-teal"
        >
          <Icon name="chat" className="size-[18px]" />
          Agenda por WhatsApp
        </a>
      </div>
    );
  }
  return (
    <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <li key={entry.slug}>
          <Link
            href={`/agendar/${entry.slug}`}
            className="group flex h-full flex-col gap-5 rounded-2xl border border-line bg-white p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-outline hover:shadow-[0_24px_48px_-32px_rgba(27,42,85,0.5)]"
          >
            <div className="flex items-center gap-4">
              <ProfessionalAvatar name={entry.name} src={entry.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="font-serif text-[23px] leading-tight">{entry.name}</p>
                {entry.specialty && <p className="mt-0.5 text-[14px] text-muted">{entry.specialty}</p>}
              </div>
            </div>
            {entry.services.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {entry.services.slice(0, 4).map((name) => (
                  <li key={name} className="rounded-full bg-sand px-2.5 py-1 text-[12px] text-ink">
                    {name}
                  </li>
                ))}
                {entry.services.length > 4 && (
                  <li className="rounded-full px-1.5 py-1 text-[12px] text-stone">+{entry.services.length - 4}</li>
                )}
              </ul>
            )}
            <span className="mt-auto inline-flex items-center gap-2 text-[15px] font-medium text-teal transition-colors group-hover:text-navy">
              Ver horarios
              <Icon name="arrow-right" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DirectorySkeleton() {
  return (
    <ul aria-busy="true" className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center gap-4">
            <span className="size-14 animate-pulse rounded-full bg-sand" />
            <span className="flex flex-col gap-2">
              <span className="h-5 w-40 animate-pulse rounded bg-sand" />
              <span className="h-3 w-24 animate-pulse rounded bg-sand" />
            </span>
          </div>
          <span className="h-6 w-3/4 animate-pulse rounded-full bg-sand/70" />
        </li>
      ))}
    </ul>
  );
}
