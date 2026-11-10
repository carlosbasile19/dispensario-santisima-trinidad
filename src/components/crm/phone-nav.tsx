"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import type { NavGroup, NavItem } from "@/lib/crm/roles";
import { Icon } from "./icons";
import { Avatar } from "./ui";

/** The sections on the tab bar. Every other section a role has opens from "Más". */
const TABS = ["/dashboard", "/dashboard/agenda", "/dashboard/pacientes", "/dashboard/laboratorio"];
const ACCOUNT = "/dashboard/cuenta";

const tabClass = (active: boolean) =>
  `flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] transition-colors ${
    active ? "bg-frost font-medium text-navy" : "text-muted active:bg-sand"
  }`;

// Navigation of the platform on a phone: a floating tab bar with the four
// sections used all day, and "Más", a sheet with the member's account, the
// rest of their sections and the sign-out. Tablets and up use the sidebar.
export function PhoneNav({
  groups,
  viewer,
}: {
  groups: NavGroup[];
  viewer: { name: string; avatarUrl: string | null; role: string };
}) {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const items = groups.flatMap((group) => group.items);
  const tabs = TABS.map((href) => items.find((item) => item.href === href)).filter((item): item is NavItem => Boolean(item));
  const more = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !TABS.includes(item.href) && item.href !== ACCOUNT) }))
    .filter((group) => group.items.length > 0);
  const moreActive = !tabs.some((tab) => isActive(tab.href));
  const close = () => sheet.current?.close();

  return (
    <>
      <nav
        aria-label="Secciones"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-cream via-cream/85 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
      >
        <div className="pointer-events-auto mx-auto flex max-w-[460px] gap-0.5 rounded-[26px] border border-line bg-white p-1.5 shadow-[0_14px_36px_-14px_rgba(27,42,85,0.4)]">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                <Icon name={tab.icon} className={`size-[22px] ${active ? "text-teal" : ""}`} />
                <span className="max-w-full truncate px-0.5">{tab.label}</span>
              </Link>
            );
          })}
          <button type="button" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()} className={tabClass(moreActive)}>
            <Icon name="more" className={`size-[22px] ${moreActive ? "text-teal" : ""}`} />
            <span>Más</span>
          </button>
        </div>
      </nav>

      <dialog
        ref={sheet}
        aria-label="Más secciones"
        className="modal"
        onPointerDown={(event) => {
          pressedOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (pressedOnBackdrop.current && event.target === event.currentTarget) close();
          pressedOnBackdrop.current = false;
        }}
      >
        <div className="modal-panel flex max-h-[calc(100dvh-48px)] w-full flex-col overflow-y-auto rounded-t-3xl bg-cream px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] text-navy sm:w-[420px] sm:rounded-3xl">
          <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-full bg-outline sm:hidden" />

          <Link
            href={ACCOUNT}
            onClick={close}
            aria-current={isActive(ACCOUNT) ? "page" : undefined}
            className="mt-4 flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5 active:bg-sand"
          >
            <Avatar name={viewer.name} src={viewer.avatarUrl} size="lg" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-serif text-xl">{viewer.name}</span>
              <span className="mt-1 block truncate text-[13px] text-muted">{viewer.role} · Mi cuenta</span>
            </span>
            <Icon name="chevron-right" className="size-4 text-stone" />
          </Link>

          {more.map((group) => (
            <section key={group.title} className="mt-5">
              <h2 className="mb-2 px-1 text-[11px] tracking-[0.14em] text-stone uppercase">{group.title}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className="flex h-14 items-center gap-3.5 px-4 text-[15px] active:bg-sand"
                      >
                        <span className={`grid size-9 place-items-center rounded-full ${active ? "bg-mint/30 text-teal" : "bg-frost text-navy"}`}>
                          <Icon name={item.icon} className="size-[18px]" />
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${active ? "font-medium" : ""}`}>{item.label}</span>
                        <Icon name="chevron-right" className="size-4 text-stone" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <form action={signOut} className="mt-5">
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[15px] font-medium text-[#b03a36] active:bg-sand"
            >
              <Icon name="logout" className="size-[18px]" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

/** The tab bar before the member is known: the same pill, empty. */
export function PhoneNavPlaceholder() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto h-[66px] max-w-[460px] rounded-[26px] border border-line bg-white" />
    </div>
  );
}
