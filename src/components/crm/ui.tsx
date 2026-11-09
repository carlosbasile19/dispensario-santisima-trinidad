import Link from "next/link";
import type { ReactNode } from "react";

import { ROLE_INFO, type Role } from "@/lib/crm/roles";
import type { AppointmentStatus, PaymentStatus } from "@/lib/crm/sample-data";
import { Icon } from "./icons";

// Building blocks of the admin platform. Same palette and type as the public
// site (navy, teal, cream, Newsreader for titles), tuned for dense data.

export const usd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

/** "08:30" → "8:30am" */
export function clock(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

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

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1.5 font-serif text-[32px] leading-none tracking-[-0.01em] tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-[13px] text-stone">{hint}</p>}
    </div>
  );
}

const buttonBase =
  "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors";

export function Button({
  children,
  variant = "primary",
  icon,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  icon?: Parameters<typeof Icon>[0]["name"];
}) {
  const tone =
    variant === "primary"
      ? "bg-navy text-white hover:bg-teal"
      : "border border-outline bg-white text-navy hover:border-navy";
  return (
    <button type="button" className={`${buttonBase} ${tone}`}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

export function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-lg border border-outline bg-white px-3 text-muted focus-within:border-navy">
      <Icon name="search" className="size-4" />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-sm text-navy outline-none placeholder:text-stone"
      />
    </label>
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

const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Por confirmar", tone: "outline" },
  confirmada: { label: "Confirmada", tone: "navy" },
  en_sala: { label: "En sala", tone: "teal" },
  en_consulta: { label: "En consulta", tone: "solid" },
  atendida: { label: "Atendida", tone: "neutral" },
  no_asistio: { label: "No asistió", tone: "coral" },
};

export const statusLabel = (status: AppointmentStatus) => STATUS[status].label;

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

const PAYMENT: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pagado: { label: "Pagado", tone: "neutral" },
  por_cobrar: { label: "Por cobrar", tone: "coral" },
  cashea: { label: "Cashea", tone: "navy" },
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT[status].tone}>{PAYMENT[status].label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  const tone: Tone = role === "admin" ? "solid" : role === "director" ? "teal" : role === "doctor" ? "navy" : "neutral";
  return <Badge tone={tone}>{ROLE_INFO[role].label}</Badge>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .replace(/^(Dr\.|Dra\.|Lcda\.|Lcdo\.)\s+/, "")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const dims = size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-7 text-[11px]" : "size-9 text-[13px]";
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-frost font-medium text-navy ${dims}`}>
      {initials}
    </span>
  );
}

/** Stands in for content the current role may not see. */
export function Locked({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-outline bg-cream px-4 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-stone">
        <Icon name="lock" className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{children}</p>
      </div>
    </div>
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
