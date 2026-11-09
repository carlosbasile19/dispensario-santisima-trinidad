import Link from "next/link";

const TABS = [
  { href: "/dashboard/contabilidad", label: "Cobros y tasa BCV", key: "cobros" },
  { href: "/dashboard/contabilidad/tarifas", label: "Tarifas", key: "tarifas" },
] as const;

export function AccountingTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Contabilidad" className="flex gap-1 border-b border-line">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
            tab.key === active ? "border-teal font-medium text-navy" : "border-transparent text-muted hover:text-navy"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
