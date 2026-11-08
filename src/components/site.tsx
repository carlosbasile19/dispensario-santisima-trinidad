import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import logo from "../../public/images/logo.jpg";

// Shared chrome and constants for the public site (home + Odontología).

export const WHATSAPP_URL = "https://wa.me/message/EWUXZCGJGG2TO1";
export const INSTAGRAM_URL = "https://www.instagram.com/santisimatrinidad_cmi/";
export const PHONE_DISPLAY = "0412-8261258";
export const PHONE_TEL = "tel:+584128261258";
export const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Calle+Brasil+36,+Vista+Hermosa,+Ciudad+Bol%C3%ADvar";

export const container = "mx-auto w-full max-w-[1280px] px-4 sm:px-10";
export const serif = "font-serif font-normal";
export const h2 = `${serif} text-[clamp(38px,4vw,54px)] leading-[1.05] tracking-[-0.015em]`;

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[13px] tracking-[0.16em] text-teal uppercase ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block rounded-lg bg-navy px-6 py-[15px] text-base text-white transition-colors hover:bg-teal ${className}`}
    >
      {children}
    </a>
  );
}

export function SiteHeader() {
  return (
    <header
      className={`${container} grid grid-cols-[1fr_auto] items-center gap-6 py-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`}
    >
      <nav className="hidden flex-wrap gap-7 text-[15px] md:flex">
        <Link href="/#servicios" className="text-navy hover:text-teal">Servicios</Link>
        <Link href="/odontologia" className="text-navy hover:text-teal">Odontología</Link>
        <Link href="/#chequeo" className="text-navy hover:text-teal">Chequeo preventivo</Link>
        <Link href="/#visita" className="text-navy hover:text-teal">Tu visita</Link>
      </nav>
      <Link href="/" aria-label="Inicio">
        <Image
          src={logo}
          alt="Centro Médico Integral Santísima Trinidad"
          priority
          className="h-16 w-auto mix-blend-multiply md:h-[84px]"
          sizes="84px"
        />
      </Link>
      <div className="flex items-center justify-end gap-[18px] text-[15px]">
        <Link href="/login" className="hidden text-muted hover:text-navy sm:inline">
          Acceso personal
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-navy px-5 py-3 text-white transition-colors hover:bg-teal"
        >
          Agendar cita
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={`${container} pt-24 pb-10`}>
      <div className="flex flex-wrap items-end justify-between gap-8 border-t border-line pt-8">
        <div className="flex items-center gap-5">
          <Image src={logo} alt="" className="h-[72px] w-auto mix-blend-multiply" sizes="72px" />
          <span className="font-serif text-2xl text-teal italic">Tu salud, nuestra vocación.</span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
            Instagram
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
            WhatsApp
          </a>
          <Link href="/login" className="text-muted hover:text-navy">
            Acceso personal
          </Link>
        </nav>
      </div>
      <p className="mt-5 text-xs text-stone">
        © 2026 Centro Médico Integral Santísima Trinidad · Fotografías provisionales de Pexels
      </p>
    </footer>
  );
}
