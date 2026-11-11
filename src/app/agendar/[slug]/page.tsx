import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/crm/icons";
import { getBookingCalendar } from "@/lib/booking/data";
import type { BookingCalendar } from "@/lib/booking/types";
import { isUuid, param } from "@/lib/crm/clinic";
import { PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "@/lib/site-config";
import { ProfessionalAvatar } from "../professional-avatar";
import { BookingFlow } from "./booking-flow";

type Props = PageProps<"/agendar/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const calendar = await getBookingCalendar(slug);
  if (!calendar || calendar === "unavailable") return { title: "Agendar cita" };
  const what = calendar.specialty ? `${calendar.specialty} · ` : "";
  return {
    title: `Agenda con ${calendar.name}`,
    description: `${what}Elige el día y la hora de tu cita con ${calendar.name} en el Centro Médico Integral Santísima Trinidad, Ciudad Bolívar.`,
    openGraph: { title: `Agenda tu cita con ${calendar.name}`, url: `/agendar/${calendar.slug}` },
  };
}

// A calendar's public booking page, the link the centre sends to patients.
// The frame is static; the calendar and its free slots are read fresh on every
// visit (they change as people book) and stream in.
export default function BookingPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-3 py-5 sm:px-8 sm:py-10">
      <Suspense fallback={<BookingSkeleton />}>
        <Booking params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Booking({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const calendar = await getBookingCalendar(slug);
  if (calendar === null) notFound();
  if (calendar === "unavailable") {
    return <Closed>La reserva en línea no está disponible en este momento.</Closed>;
  }
  if (!calendar.accepting || calendar.services.length === 0) {
    return (
      <Closed calendar={calendar}>
        {calendar.name} no está recibiendo citas en línea por ahora. Escríbenos y te ayudamos a agendar.
      </Closed>
    );
  }
  const service = param(query.servicio);
  return <BookingFlow calendar={calendar} initialServiceId={isUuid(service) ? service : undefined} />;
}

function Closed({ calendar, children }: { calendar?: BookingCalendar; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center rounded-[22px] border border-line bg-white px-6 py-14 text-center shadow-[0_30px_80px_-40px_rgba(27,42,85,0.45)]">
      {calendar ? (
        <ProfessionalAvatar name={calendar.name} src={calendar.avatarUrl} />
      ) : (
        <span className="grid size-14 place-items-center rounded-full bg-frost text-navy">
          <Icon name="pause" className="size-6" />
        </span>
      )}
      {calendar && <h1 className="mt-5 font-serif text-[30px] leading-tight">{calendar.name}</h1>}
      <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-ink">{children}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white hover:bg-teal"
        >
          <Icon name="chat" className="size-[18px]" />
          Escríbenos por WhatsApp
        </a>
        <a
          href={PHONE_TEL}
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-outline bg-white px-5 text-[15px] font-medium text-navy hover:border-navy"
        >
          <Icon name="phone" className="size-[18px]" />
          {PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}

/** The booking card while the calendar loads: same frame, pulsing placeholders. */
function BookingSkeleton() {
  const bar = "animate-pulse rounded bg-sand";
  return (
    <div aria-busy="true" className="overflow-hidden rounded-[22px] border border-line bg-white">
      <span className="sr-only">Cargando horarios…</span>
      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 border-b border-line bg-[#fcfbf8] p-5 sm:p-7 lg:border-r lg:border-b-0">
          <span className="size-[72px] animate-pulse rounded-full bg-sand" />
          <span className={`${bar} h-3 w-24`} />
          <span className={`${bar} h-7 w-52`} />
          <span className={`${bar} h-14 w-full rounded-xl`} />
          <span className={`${bar} h-14 w-full rounded-xl`} />
        </div>
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_236px] lg:p-8">
          <div>
            <span className={`${bar} block h-5 w-36`} />
            <div className="mt-6 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }, (_, i) => (
                <span key={i} className="h-11 animate-pulse rounded-xl bg-sand/60 sm:h-12" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={`${bar} h-5 w-40`} />
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="h-11 animate-pulse rounded-xl bg-sand/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
