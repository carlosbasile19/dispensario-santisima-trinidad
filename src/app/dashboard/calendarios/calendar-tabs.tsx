"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/crm/icons";

/** The three views of a calendar: its week, its hours and its services and booking settings. */
export function CalendarTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/dashboard/calendarios/${id}`;
  const tabs: { href: string; label: string; icon: IconName }[] = [
    { href: base, label: "Semana", icon: "calendar" },
    { href: `${base}/horario`, label: "Horario", icon: "clock" },
    { href: `${base}/ajustes`, label: "Servicios y reservas", icon: "tag" },
  ];
  return (
    <nav aria-label="Vistas del calendario" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
              active ? "border-navy font-medium text-navy" : "border-transparent text-muted hover:text-navy"
            }`}
          >
            <Icon name={tab.icon} className={`size-4 ${active ? "text-teal" : ""}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
