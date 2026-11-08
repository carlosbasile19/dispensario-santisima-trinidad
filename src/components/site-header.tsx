"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, useEffect, useId, useRef, useState } from "react";

import logo from "../../public/images/logo.jpg";
import {
  ADDRESS_SHORT,
  AREAS,
  HOURS,
  PHONE_DISPLAY,
  PHONE_TEL,
  WHATSAPP_URL,
} from "@/lib/site-config";

// Site header (patterns from Mobbin: Sana's segmented section switcher,
// Superpower's always-reachable bar, CVS Health / Noom full-screen menus).
// - Desktop: a pill switcher for the three areas, current one highlighted.
// - Phones/tablets: a full-screen menu with a line of context per area.
// - Sticky: hides while scrolling down, comes back as soon as you scroll up.

const container = "mx-auto w-full max-w-[1280px] px-4 sm:px-10";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  // Unique per instance: Next keeps recently visited pages mounted (hidden) for
  // instant back/forward, so several headers can exist in the document at once.
  const menuId = useId();
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Hide on scroll down, show on scroll up (rAF-throttled, passive listener).
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);
      if (Math.abs(y - lastY) < 6) return;
      setHidden(y > lastY && y > 160);
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Close the menu whenever the page changes.
  useEffect(() => {
    menuRef.current?.close();
  }, [pathname]);

  const openMenu = () => {
    menuRef.current?.showModal();
    setMenuOpen(true);
  };
  const closeMenu = () => menuRef.current?.close();

  return (
    <ViewTransition name="site-header" default="none">
      <header
        className={[
          "sticky top-0 z-40 w-full transition-[translate,background-color,box-shadow] duration-300 ease-out has-[:focus-visible]:translate-y-0 motion-reduce:transition-none",
          hidden && !menuOpen ? "-translate-y-full" : "translate-y-0",
          scrolled
            ? "bg-cream/90 shadow-[0_1px_0_0_#d9d3c6] backdrop-blur-md"
            : "bg-cream",
        ].join(" ")}
      >
        <div
          className={`${container} grid grid-cols-[1fr_auto] items-center gap-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 lg:py-4`}
        >
          {/* Desktop: area switcher */}
          <nav aria-label="Áreas del centro" className="hidden lg:block">
            <ul className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 p-1">
              {AREAS.map((area) => {
                const active = isActive(pathname, area.href);
                return (
                  <li key={area.href}>
                    <Link
                      href={area.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-full px-4 py-2 text-[14px] transition-colors ${
                        active ? "bg-navy text-white" : "text-navy hover:bg-sand"
                      }`}
                    >
                      {area.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link href="/" aria-label="Inicio" className="justify-self-start lg:justify-self-center">
            <Image
              src={logo}
              alt="Centro Médico Integral Santísima Trinidad"
              priority
              className="h-14 w-auto mix-blend-multiply lg:h-[76px]"
              sizes="76px"
            />
          </Link>

          <div className="flex items-center justify-end gap-3 text-[15px] lg:gap-[18px]">
            <Link href="/login" className="hidden text-muted hover:text-navy lg:inline">
              Acceso personal
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-navy px-4 py-2.5 text-white transition-colors hover:bg-teal sm:px-5 sm:py-3"
            >
              Agendar cita
            </a>
            <button
              type="button"
              onClick={openMenu}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              className="grid size-11 place-items-center rounded-lg border border-line text-navy lg:hidden"
            >
              <span className="sr-only">Abrir menú</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Phones/tablets: full-screen menu */}
        <dialog
          id={menuId}
          ref={menuRef}
          aria-label="Menú"
          onClose={() => setMenuOpen(false)}
          className="site-menu m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-cream p-0 text-navy backdrop:bg-navy/30"
        >
          <div className={`${container} flex min-h-full flex-col pb-8`}>
            <div className="flex items-center justify-between py-3">
              <Image src={logo} alt="" className="h-14 w-auto mix-blend-multiply" sizes="56px" />
              <button
                type="button"
                onClick={closeMenu}
                className="grid size-11 place-items-center rounded-lg border border-line text-navy"
              >
                <span className="sr-only">Cerrar menú</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label="Áreas del centro" className="mt-6">
              <ul className="border-t border-line">
                {AREAS.map((area, i) => {
                  const active = isActive(pathname, area.href);
                  return (
                    <li key={area.href} className="border-b border-line">
                      <Link
                        href={area.href}
                        onClick={closeMenu}
                        aria-current={active ? "page" : undefined}
                        className="flex items-center gap-4 py-5"
                      >
                        <span className="flex-none font-mono text-[13px] text-stone">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2.5">
                            <span className={`font-serif text-[30px] leading-none ${active ? "text-teal" : ""}`}>
                              {area.label}
                            </span>
                            {active && (
                              <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] tracking-[0.08em] text-teal">
                                ESTÁS AQUÍ
                              </span>
                            )}
                          </span>
                          <span className="mt-1.5 block text-[14px] leading-snug text-muted">{area.description}</span>
                        </span>
                        <span aria-hidden="true" className="flex-none text-xl text-teal">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-8 flex flex-col gap-1.5 text-[15px] text-ink">
              <span className="text-[12px] tracking-[0.14em] text-teal">CONTACTO</span>
              <a href={PHONE_TEL} className="font-semibold text-navy">{PHONE_DISPLAY}</a>
              <span>{HOURS}</span>
              <span>{ADDRESS_SHORT}</span>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-navy px-6 py-4 text-center text-base text-white"
              >
                Agenda por WhatsApp
              </a>
              <Link href="/login" onClick={closeMenu} className="py-2 text-center text-[15px] text-muted">
                Acceso personal
              </Link>
            </div>
          </div>
        </dialog>
      </header>
    </ViewTransition>
  );
}
