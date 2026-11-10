import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import {
  ADDRESS_SHORT,
  HOURS,
  LEGAL_NAME,
  PHONE_DISPLAY,
  PHONE_TEL,
  RIF,
  WHATSAPP_URL,
} from "@/lib/site-config";
import logo from "../../../public/images/logo.jpg";

// Chrome of the public booking pages (/agendar). Quieter than the marketing
// header: the logo, a way to ask for help, and the centre's details at the
// foot, so a patient who opens a link from WhatsApp stays on the booking.
export default function BookingLayout({ children }: LayoutProps<"/agendar">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-cream text-navy">
      <header className="border-b border-line/70">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
          <Link href="/" aria-label="Centro Médico Integral Santísima Trinidad · Inicio" className="shrink-0">
            <Image src={logo} alt="" priority className="h-12 w-auto mix-blend-multiply sm:h-[60px]" sizes="60px" />
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3.5 py-2 text-[13px] text-ink transition-colors hover:border-teal hover:text-teal sm:text-sm"
          >
            <Icon name="chat" className="size-4 text-teal" />
            <span>
              ¿Dudas? <span className="font-medium">Escríbenos</span>
            </span>
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-7 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="map-pin" className="size-4 text-teal" />
              {ADDRESS_SHORT}
            </span>
            <a href={PHONE_TEL} className="inline-flex items-center gap-1.5 hover:text-navy">
              <Icon name="phone" className="size-4 text-teal" />
              {PHONE_DISPLAY}
            </a>
            <span>{HOURS}</span>
          </p>
          <p>
            © 2026 {LEGAL_NAME} · <span className="whitespace-nowrap">RIF {RIF}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
