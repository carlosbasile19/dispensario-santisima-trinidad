import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";

import { Icon } from "@/components/crm/icons";
import {
  Card,
  CardHeader,
  DayBarSkeleton,
  EmptyState,
  FormSkeleton,
  NoAccess,
  PageHeader,
  RowsSkeleton,
  Skeleton,
  StatGrid,
  StatGridSkeleton,
  td,
  th,
} from "@/components/crm/ui";
import { PAYMENT_METHODS, addDays, clinicToday, formatDay, isIsoDate, param } from "@/lib/crm/clinic";
import { expenseMethod, formatAccount, formatWeek, weekStart, type ExpenseMethod } from "@/lib/crm/expenses";
import { formatBs, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { AccountingTabs } from "../tabs";
import { DeleteExpense, ExpenseForm, SupplierModal, type SupplierOption } from "./forms";

export const metadata: Metadata = { title: "Gastos" };

type SearchParams = PageProps<"/dashboard/contabilidad/gastos">["searchParams"];

const navButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";

const TOTALS = ["Ingresos de la semana", "Gastos de la semana", "Resultado"] as const;

// Gastos (administrators only): what the centre paid out, to whom and into
// which account, and a week's income set against its spending, in dollars
// and in bolívares. Weeks run Monday to Sunday.
export default async function ExpensesPage({ searchParams }: PageProps<"/dashboard/contabilidad/gastos">) {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Lo que se paga a proveedores, en dólares o en bolívares, y cuánto entró y salió cada semana."
      />
      <AccountingTabs active="gastos" />

      <Suspense fallback={<DayBarSkeleton />}>
        <WeekBar searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<StatGridSkeleton labels={TOTALS} />}>
        <WeekTotals searchParams={searchParams} />
      </Suspense>

      <Card className="overflow-x-auto">
        <CardHeader title="Por moneda" hint="Lo que entró y salió en cada moneda" />
        <Suspense fallback={<RowsSkeleton rows={2} dense />}>
          <ByCurrency searchParams={searchParams} />
        </Suspense>
      </Card>

      <Card>
        <CardHeader title="Nuevo gasto" />
        <Suspense fallback={<FormSkeleton fields={3} className="px-5 py-5" />}>
          <NewExpense />
        </Suspense>
      </Card>

      <Card className="overflow-x-auto">
        <Suspense
          fallback={
            <>
              <CardHeader title="Gastos de la semana" hint={<Skeleton className="w-24" />} />
              <RowsSkeleton />
            </>
          }
        >
          <WeekExpenses searchParams={searchParams} />
        </Suspense>
      </Card>

      <Card>
        <CardHeader title="Proveedores" hint="A quién se le paga y a qué cuentas" action={<SupplierModal />} />
        <Suspense fallback={<RowsSkeleton rows={3} dense />}>
          <Suppliers />
        </Suspense>
      </Card>
    </div>
  );
}

/** The week on screen (its Monday): from ?semana=, or this week in the clinic. */
async function readWeek(searchParams: SearchParams) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const requested = param(params.semana);
  const thisWeek = weekStart(today);
  return { today, thisWeek, monday: isIsoDate(requested) ? weekStart(requested) : thisWeek };
}

/** A week's valid payments in and expenses out. The cards share one read per request. */
const getWeek = cache(async (monday: string) => {
  const sunday = addDays(monday, 6);
  const supabase = await createClient();
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from("payments")
      .select("method, currency, amount_usd, amount_bs")
      .gte("paid_on", monday)
      .lte("paid_on", sunday)
      .is("voided_at", null),
    supabase
      .from("expenses")
      .select("id, spent_on, description, method, currency, amount_usd, amount_bs, rate, reference, destination, created_at, supplier:suppliers(name)")
      .gte("spent_on", monday)
      .lte("spent_on", sunday)
      .order("spent_on")
      .order("created_at"),
  ]);
  return { payments: payments ?? [], expenses: expenses ?? [] };
});

async function WeekBar({ searchParams }: { searchParams: SearchParams }) {
  const { thisWeek, monday } = await readWeek(searchParams);
  const href = (day: string) => `/dashboard/contabilidad/gastos?semana=${day}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(addDays(monday, -7))} className={navButton} aria-label="Semana anterior">
        <Icon name="chevron-left" className="size-4" />
      </Link>
      <Link href={href(addDays(monday, 7))} className={navButton} aria-label="Semana siguiente">
        <Icon name="chevron-right" className="size-4" />
      </Link>
      <h2 className="mr-auto px-2 text-lg font-medium">
        Semana del {formatWeek(monday)}
        {monday === thisWeek && <span className="ml-2 text-[13px] font-normal text-teal">Esta semana</span>}
      </h2>
      {monday !== thisWeek && (
        <Link href="/dashboard/contabilidad/gastos" className={navButton}>
          Esta semana
        </Link>
      )}
    </div>
  );
}

async function WeekTotals({ searchParams }: { searchParams: SearchParams }) {
  const { monday } = await readWeek(searchParams);
  const { payments, expenses } = await getWeek(monday);
  const inUsd = sumCents(payments.map((p) => p.amount_usd));
  const inBs = sumCents(payments.map((p) => p.amount_bs));
  const outUsd = sumCents(expenses.map((e) => e.amount_usd));
  const outBs = sumCents(expenses.map((e) => e.amount_bs));
  const resultUsd = inUsd - outUsd;
  const financed = sumCents(payments.filter((p) => PAYMENT_METHODS[p.method].financed).map((p) => p.amount_usd));

  return (
    <StatGrid
      stats={[
        {
          label: TOTALS[0],
          value: formatUsd(inUsd),
          hint: `${formatBs(inBs)} a tasa BCV${financed > 0n ? ` · ${formatUsd(financed)} por Cashea` : ""}`,
        },
        {
          label: TOTALS[1],
          value: formatUsd(outUsd),
          hint: `${formatBs(outBs)} a tasa BCV · ${expenses.length} ${expenses.length === 1 ? "gasto" : "gastos"}`,
        },
        {
          label: TOTALS[2],
          value: formatUsd(resultUsd),
          hint: `${resultUsd >= 0n ? "Ganancia" : "Pérdida"} · ${formatBs(inBs - outBs)}`,
          alert: resultUsd < 0n,
        },
      ]}
    />
  );
}

/**
 * Money that actually came in and went out in each currency. Cashea's
 * financed part is not cash in hand yet, so it is shown on its own.
 */
async function ByCurrency({ searchParams }: { searchParams: SearchParams }) {
  const { monday } = await readWeek(searchParams);
  const { payments, expenses } = await getWeek(monday);
  const received = payments.filter((p) => !PAYMENT_METHODS[p.method].financed);
  const financed = sumCents(payments.filter((p) => PAYMENT_METHODS[p.method].financed).map((p) => p.amount_usd));
  const rows = [
    {
      label: "Dólares",
      format: formatUsd,
      inflow: sumCents(received.filter((p) => p.currency === "USD").map((p) => p.amount_usd)),
      outflow: sumCents(expenses.filter((e) => e.currency === "USD").map((e) => e.amount_usd)),
      hint: "Efectivo y Zelle",
    },
    {
      label: "Bolívares",
      format: formatBs,
      inflow: sumCents(received.filter((p) => p.currency === "VES").map((p) => p.amount_bs)),
      outflow: sumCents(expenses.filter((e) => e.currency === "VES").map((e) => e.amount_bs)),
      hint: "Pago móvil, punto, transferencia y efectivo",
    },
  ];

  return (
    <>
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Moneda</th>
            <th className={`${th} text-right`}>Entró</th>
            <th className={`${th} text-right`}>Salió</th>
            <th className={`${th} text-right`}>Queda</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const net = r.inflow - r.outflow;
            return (
              <tr key={r.label}>
                <td className={td}>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-[12px] text-muted">{r.hint}</p>
                </td>
                <td className={`${td} text-right font-mono whitespace-nowrap`}>{r.format(r.inflow)}</td>
                <td className={`${td} text-right font-mono whitespace-nowrap`}>{r.format(r.outflow)}</td>
                <td className={`${td} text-right font-mono font-medium whitespace-nowrap ${net < 0n ? "text-[#b03a36]" : ""}`}>
                  {r.format(net)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {financed > 0n && (
        <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
          Además, Cashea financió {formatUsd(financed)} que se cobran en cuotas; cuentan en los ingresos, no aquí.
        </p>
      )}
    </>
  );
}

async function NewExpense() {
  const today = await clinicToday();
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name, bank, document").order("name");
  const suppliers: SupplierOption[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    detail: [s.document, s.bank].filter(Boolean).join(" · ") || null,
  }));
  return <ExpenseForm today={today} suppliers={suppliers} />;
}

async function WeekExpenses({ searchParams }: { searchParams: SearchParams }) {
  const { monday } = await readWeek(searchParams);
  const { expenses } = await getWeek(monday);
  const days = [...new Set(expenses.map((e) => e.spent_on))];

  return (
    <>
      <CardHeader
        title="Gastos de la semana"
        hint={expenses.length ? `${expenses.length} ${expenses.length === 1 ? "gasto" : "gastos"}` : undefined}
      />
      {expenses.length ? (
        days.map((day) => {
          const list = expenses.filter((e) => e.spent_on === day);
          return (
            <section key={day} className="border-t border-line first:border-t-0">
              <h3 className="flex justify-between bg-cream/60 px-5 py-2 text-[13px] font-medium text-navy">
                <span className="first-letter:uppercase">{formatDay(day)}</span>
                <span className="font-mono font-normal text-muted">{formatUsd(sumCents(list.map((e) => e.amount_usd)))}</span>
              </h3>
              <ul className="divide-y divide-line">
                {list.map((e) => {
                  const method = expenseMethod(e.method as ExpenseMethod);
                  const usd = e.currency === "USD";
                  const paid = usd ? formatUsd(e.amount_usd) : formatBs(e.amount_bs);
                  return (
                    <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0 leading-tight">
                        <p className="font-medium">{e.description}</p>
                        <p className="mt-1 text-[13px] text-ink">{e.supplier?.name ?? "Sin proveedor"}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
                          <Icon name={method.icon} className="size-3.5 text-teal" />
                          {method.label}
                          {e.reference && <span>· ref. {e.reference}</span>}
                        </p>
                        {e.destination && <p className="mt-1 font-mono text-[12px] break-all text-muted">{e.destination}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="font-mono text-sm whitespace-nowrap">{paid}</p>
                        <p className="font-mono text-[12px] whitespace-nowrap text-muted">
                          {usd ? formatBs(e.amount_bs) : formatUsd(e.amount_usd)}
                        </p>
                        <DeleteExpense expenseId={e.id} summary={`${e.description} · ${paid}`} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      ) : (
        <EmptyState icon="ledger" title="No hay gastos esta semana">
          Registra arriba lo que se pagó, a quién y cómo.
        </EmptyState>
      )}
    </>
  );
}

async function Suppliers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, document, bank, account_number, pago_movil_phone, notes")
    .order("name");
  const suppliers = data ?? [];
  if (!suppliers.length) {
    return (
      <EmptyState icon="bank" title="Todavía no hay proveedores">
        Añade a quién le paga el centro, con su banco, número de cuenta y pago móvil.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {suppliers.map((s) => (
        <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 leading-tight">
            <p className="font-medium">
              {s.name}
              {s.document && <span className="ml-2 text-[13px] font-normal text-muted">{s.document}</span>}
            </p>
            <div className="mt-1 grid gap-0.5 text-[13px] text-muted">
              {s.bank && <div>{s.bank}</div>}
              {s.account_number && (
                <div>
                  Cuenta <span className="font-mono break-all text-ink">{formatAccount(s.account_number)}</span>
                </div>
              )}
              {s.pago_movil_phone && (
                <div>
                  Pago móvil <span className="font-mono text-ink">{s.pago_movil_phone}</span>
                </div>
              )}
              {s.notes && <div className="whitespace-pre-line">{s.notes}</div>}
            </div>
          </div>
          <SupplierModal supplier={s} />
        </li>
      ))}
    </ul>
  );
}
