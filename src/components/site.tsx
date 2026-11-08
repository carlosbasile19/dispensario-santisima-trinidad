import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import logo from "../../public/images/logo.jpg";
import {
  ADDRESS_SHORT,
  AREAS,
  HOURS,
  INSTAGRAM_URL,
  LEGAL_NAME,
  PHONE_DISPLAY,
  PHONE_TEL,
  RIF,
  WHATSAPP_URL,
} from "@/lib/site-config";

// Shared chrome and constants for the public site (home, Odontología, Bioanálisis).

export {
  INSTAGRAM_URL,
  MAPS_URL,
  PHONE_DISPLAY,
  PHONE_TEL,
  WHATSAPP_URL,
} from "@/lib/site-config";
export { SiteHeader } from "./site-header";

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

const footerLink = "text-[15px] text-navy hover:text-teal";
const footerHeading = "mb-4 text-[12px] tracking-[0.14em] text-teal";

// Footer as a site map (patterns from Mobbin: Function, Hims): areas and key
// sections, contact details, and the legal line with the RIF on every page.
export function SiteFooter() {
  return (
    <footer className={`${container} pt-24 pb-10`}>
      <div className="grid grid-cols-1 gap-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div className="flex flex-col items-start gap-4 sm:col-span-2 lg:col-span-1">
          <Image src={logo} alt="" className="h-[72px] w-auto mix-blend-multiply" sizes="72px" />
          <span className="font-serif text-2xl text-teal italic">Tu salud, nuestra vocación.</span>
        </div>

        <nav aria-label="Explora">
          <h2 className={footerHeading}>EXPLORA</h2>
          <ul className="flex flex-col gap-2.5">
            {AREAS.map((area) => (
              <li key={area.href}>
                <Link href={area.href} className={footerLink}>
                  {area.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/#chequeo" className={footerLink}>
                Chequeo preventivo
              </Link>
            </li>
            <li>
              <Link href="/#cashea" className={footerLink}>
                Paga en cuotas con Cashea
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className={footerHeading}>CONTACTO</h2>
          <ul className="flex flex-col gap-2.5 text-[15px] text-ink">
            <li>
              <a href={PHONE_TEL} className="font-semibold text-navy hover:text-teal">
                {PHONE_DISPLAY}
              </a>
            </li>
            <li>{HOURS}</li>
            <li>{ADDRESS_SHORT}</li>
            <li className="flex gap-5 pt-1">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
                WhatsApp
              </a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p>
          © 2026 {LEGAL_NAME} · <span className="whitespace-nowrap">RIF {RIF}</span>
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/login" className="hover:text-navy">
            Acceso personal
          </Link>
          <span>Algunas fotografías son provisionales (Pexels)</span>
        </p>
      </div>
    </footer>
  );
}
