"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavGroup } from "@/lib/crm/roles";
import { Icon } from "./icons";

// Sidebar links. On a tablet held upright the sidebar is a narrow rail: each
// link is its icon over a small label, and a line separates the groups.
// (Phones use the tab bar in phone-nav.tsx.)
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Secciones" className="flex flex-col gap-2 lg:gap-6">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1 border-t border-line pt-2 first:border-t-0 first:pt-0 lg:border-t-0 lg:pt-0">
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
                className={`flex h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10.5px] whitespace-nowrap lg:h-10 lg:flex-row lg:justify-start lg:gap-2.5 lg:rounded-lg lg:px-3 lg:text-sm ${
                  active
                    ? "bg-white font-medium text-navy shadow-[0_0_0_1px_var(--color-line)]"
                    : "text-ink hover:bg-white/60 hover:text-navy"
                }`}
              >
                <Icon name={item.icon} className={`size-[22px] lg:size-[18px] ${active ? "text-teal" : ""}`} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
