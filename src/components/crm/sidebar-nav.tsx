"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavGroup } from "@/lib/crm/roles";
import { Icon } from "./icons";

// Sidebar links. On small screens the same links become one scrolling row.
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-6 lg:overflow-visible">
      {groups.map((group) => (
        <div key={group.title} className="flex gap-1 lg:flex-col">
          <p className="mb-1.5 hidden px-3 text-[11px] tracking-[0.14em] text-stone uppercase lg:block">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap ${
                  active
                    ? "bg-white font-medium text-navy shadow-[0_0_0_1px_var(--color-line)]"
                    : "text-ink hover:bg-white/60 hover:text-navy"
                }`}
              >
                <Icon name={item.icon} className={`size-[18px] ${active ? "text-teal" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
