import Link from "next/link";
import type { ReactNode } from "react";

import { ROLE_INFO, type Role } from "@/lib/crm/roles";
import { Icon, type IconName } from "./icons";

// Building blocks of the admin platform. Same palette and type as the public
// site (navy, teal, cream, Newsreader for titles), tuned for dense data.

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[12px] tracking-[0.14em] text-teal uppercase">{eyebrow}</p>}
        <h1 className="font-serif text-[clamp(30px,3.2vw,40px)] leading-[1.08] tracking-[-0.01em] text-balance">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-[62ch] text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white ${className}`}>{children}</section>;
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** One key figure of a page (Inicio, Contabilidad). */
export type Stat = {
  label: string;
  value: string;
  hint: string;
  /** The figure is missing and someone has to act (a BCV rate not loaded yet). */
  alert?: boolean;
};

// Columns for each number of figures, so the row is always full.
const STAT_COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

/** A page's key figures as a row of cards that always spans the page. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className={`grid gap-4 ${STAT_COLUMNS[stats.length] ?? STAT_COLUMNS[4]}`}>
      {stats.map((stat) => (
        <Card key={stat.label} className="px-5 py-4">
          <p className="text-[12px] tracking-[0.04em] text-stone uppercase">{stat.label}</p>
          <p className={`mt-1.5 text-xl ${stat.alert ? "font-medium text-[#b03a36]" : "font-mono"}`}>{stat.value}</p>
          <p className="mt-1 text-[13px] text-muted">{stat.hint}</p>
        </Card>
      ))}
    </div>
  );
}

/** Stands in for a list that has no records yet. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-frost text-navy">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="mt-4 text-[15px] font-medium">{title}</p>
      <p className="mt-1 max-w-[46ch] text-sm text-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "navy" | "teal" | "solid" | "coral" | "outline";
const TONES: Record<Tone, string> = {
  neutral: "bg-sand text-ink",
  navy: "bg-frost text-navy",
  teal: "bg-mint/30 text-[#135c62]",
  solid: "bg-teal text-white",
  coral: "bg-coral/10 text-[#b03a36]",
  outline: "border border-outline text-stone",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const tone: Tone = role === "admin" ? "solid" : role === "director" ? "teal" : role === "doctor" ? "navy" : "neutral";
  return <Badge tone={tone}>{ROLE_INFO[role].label}</Badge>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const initials = name
    .replace(/^(Dr\.|Dra\.|Lcda\.|Lcdo\.)\s+/, "")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const dims =
    size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-7 text-[11px]" : size === "xs" ? "size-5 text-[9px]" : "size-9 text-[13px]";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-frost font-medium text-navy ${dims}`}>
      {initials}
    </span>
  );
}

/** Full-page state for a section the current role cannot open. */
export function NoAccess({ role, section }: { role: Role; section: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-sand text-stone">
        <Icon name="lock" className="size-5" />
      </span>
      <h1 className="mt-5 font-serif text-3xl">Sin acceso a {section}</h1>
      <p className="mt-3 text-[15px] text-muted">
        Tu perfil de {ROLE_INFO[role].label.toLowerCase()} no incluye esta sección. Si la necesitas, pídele
        acceso a un administrador.
      </p>
      <Link href="/dashboard" className="mt-6 text-sm font-medium text-teal hover:text-navy">
        Volver al inicio
      </Link>
    </div>
  );
}

export const th = "px-5 py-3 text-left text-[12px] font-medium tracking-[0.04em] text-stone uppercase whitespace-nowrap";
export const td = "px-5 py-3.5 align-middle text-sm";
