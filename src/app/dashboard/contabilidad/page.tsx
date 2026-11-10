import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense, cache } from "react";

import { DatePicker } from "@/components/crm/date-picker";
import { Icon } from "@/components/crm/icons";
import { RateForm } from "@/components/crm/rate-form";
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
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LIST,
  UNBILLED_STATUSES,
  addDays,
  clinicToday,
  formatDay,
  formatTime,
  isIsoDate,
  param,
  patientName,
} from "@/lib/crm/clinic";
import { getRate, getRecentRates, getTodayRate } from "@/lib/crm/data";
import { formatBs, formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { AccountingTabs } from "./tabs";
import { VoidPayment } from "./void-payment";

export const metadata: Metadata = { title: "Contabilidad" };

type SearchParams = PageProps<"/dashboard/contabilidad">["searchParams"];

const navButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";

const TOTALS = [
  "Total cobrado",
  "Recibido en dólares",
  "Recibido en bolívares",
  "Financiado con Cashea",
  "Tasa BCV del día",
] as const;

// Contabilidad (administrators only): a day's payments with their BCV rate
// and totals in both currencies, the rate of any day, and what patients
// still owe. The header, tabs and card frames are static; the day (from the
// URL or the clinic clock) and each card's figures stream in separately.
export default async function AccountingPage({ searchParams }: PageProps<"/dashboard/contabilidad">) {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Cobros del día en dólares y en bolívares a la tasa BCV, y cuentas por cobrar."
      />
      <AccountingTabs active="cobros" />

      <Suspense fallback={<DayBarSkeleton />}>
        <DayBar searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<StatGridSkeleton labels={TOTALS} />}>
        <DayTotals searchParams={searchParams} />
      </Suspense>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <Suspense
            fallback={
              <>
                <CardHeader title="Tasa BCV" hint={<Skeleton className="w-20" />} />
                <FormSkeleton className="px-5 py-4" />
              </>
            }
          >
            <DayRate searchParams={searchParams} />
          </Suspense>
        </Card>
        <Card>
          <CardHeader title="Últimas tasas" />
          <Suspense fallback={<RowsSkeleton rows={5} dense />}>
            <RecentRates searchParams={searchParams} />
          </Suspense>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <Suspense
          fallback={
            <>
              <CardHeader title="Cobros del día" hint={<Skeleton className="w-24" />} />
              <RowsSkeleton />
            </>
          }
        >
          <DayPayments searchParams={searchParams} />
        </Suspense>
      </Card>

      <Card className="overflow-x-auto">
        <Suspense
          fallback={
            <>
              <CardHeader title="Cuentas por cobrar" hint={<Skeleton className="w-52" />} />
              <RowsSkeleton />
            </>
          }
        >
          <Receivables />
        </Suspense>
      </Card>
    </div>
  );
}

/** The day on screen: ?fecha=, or today in the clinic. */
async function readDay(searchParams: SearchParams) {
  const [params, today] = await Promise.all([searchParams, clinicToday()]);
  const requested = param(params.fecha);
  return { today, day: isIsoDate(requested) ? requested : today };
}

/** The day's rate; today's is fetched from the BCV when it is missing (see getTodayRate). */
const dayRate = (day: string, today: string) => (day === today ? getTodayRate(today) : getRate(day));

/** A day's payments, voided ones included. The totals, the rate card and the table share one read per request. */
const getPayments = cache(async (day: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "id, method, currency, amount_usd, amount_bs, rate, reference, cashea_order, created_at, voided_at, void_reason, appointment:appointments(id, patient:patients(first_name, last_name)), receiver:profiles!payments_received_by_fkey(full_name, email)",
    )
    .eq("paid_on", day)
    .order("created_at");
  return data ?? [];
});

async function DayBar({ searchParams }: { searchParams: SearchParams }) {
  const { today, day } = await readDay(searchParams);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/contabilidad?fecha=${addDays(day, -1)}`} className={navButton} aria-label="Día anterior">
        <Icon name="chevron-left" className="size-4" />
      </Link>
      <Link href={`/dashboard/contabilidad?fecha=${addDays(day, 1)}`} className={navButton} aria-label="Día siguiente">
        <Icon name="chevron-right" className="size-4" />
      </Link>
      <h2 className="mr-auto px-2 text-lg font-medium first-letter:uppercase">
        {formatDay(day)}
        {day === today && <span className="ml-2 text-[13px] font-normal text-teal">Hoy</span>}
      </h2>
      <Form action="/dashboard/contabilidad" className="flex gap-2">
        <DatePicker name="fecha" defaultValue={day} aria-label="Ir al día" submitOnChange className="w-[200px]" />
        {day !== today && (
          <Link href="/dashboard/contabilidad" className={navButton}>
            Hoy
          </Link>
        )}
      </Form>
    </div>
  );
}

async function DayTotals({ searchParams }: { searchParams: SearchParams }) {
  const { today, day } = await readDay(searchParams);
  const [payments, rate] = await Promise.all([getPayments(day), dayRate(day, today)]);
  const valid = payments.filter((p) => !p.voided_at);
  const totalUsd = sumCents(valid.map((p) => p.amount_usd));
  const totalBs = sumCents(valid.map((p) => p.amount_bs));
  const received = valid.filter((p) => !PAYMENT_METHODS[p.method].financed);
  const cashUsd = sumCents(received.filter((p) => p.currency === "USD").map((p) => p.amount_usd));
  const cashBs = sumCents(received.filter((p) => p.currency === "VES").map((p) => p.amount_bs));
  const cashea = valid.filter((p) => PAYMENT_METHODS[p.method].financed);
  const casheaUsd = sumCents(cashea.map((p) => p.amount_usd));

  return (
    <StatGrid
      stats={[
        { label: TOTALS[0], value: formatUsd(totalUsd), hint: `${formatBs(totalBs)} a tasa BCV` },
        { label: TOTALS[1], value: formatUsd(cashUsd), hint: "Efectivo y Zelle" },
        { label: TOTALS[2], value: formatBs(cashBs), hint: "Pago móvil, punto, transferencia y efectivo" },
        {
          label: TOTALS[3],
          value: formatUsd(casheaUsd),
          hint: cashea.length ? `${cashea.length} ${cashea.length === 1 ? "orden" : "órdenes"} · se cobra en cuotas` : "Sin órdenes este día",
        },
        rate
          ? {
              label: TOTALS[4],
              value: `Bs. ${formatRate(rate.bs_per_usd)}`,
              hint: rate.source === "manual" ? "Cargada a mano" : "Automática, del BCV",
            }
          : { label: TOTALS[4], value: "Sin cargar", hint: "Bolívares por dólar", alert: true },
      ]}
    />
  );
}

async function DayRate({ searchParams }: { searchParams: SearchParams }) {
  const { today, day } = await readDay(searchParams);
  const [rate, recentRates, payments] = await Promise.all([dayRate(day, today), getRecentRates(today, 10), getPayments(day)]);
  return (
    <>
      <CardHeader title="Tasa BCV" hint={`Del ${formatDay(day, "short")}`} />
      <div className="px-5 py-4">
        <RateForm
          day={day}
          current={rate}
          suggestion={recentRates.find((r) => r.rate_date < day)?.bs_per_usd ?? null}
          hasPayments={payments.length > 0}
          canFetch={day === today}
        />
      </div>
    </>
  );
}

async function RecentRates({ searchParams }: { searchParams: SearchParams }) {
  const { today, day } = await readDay(searchParams);
  const recentRates = await getRecentRates(today, 10);
  if (!recentRates.length) return <p className="px-5 py-4 text-sm text-muted">Todavía no se ha cargado ninguna tasa.</p>;
  return (
    <ul className="divide-y divide-line">
      {recentRates.map((r) => (
        <li key={r.rate_date}>
          <Link
            href={`/dashboard/contabilidad?fecha=${r.rate_date}`}
            className={`flex justify-between px-5 py-2.5 text-sm hover:bg-cream ${r.rate_date === day ? "font-medium" : ""}`}
          >
            <span className="flex items-center gap-2">
              {formatDay(r.rate_date, "short")}
              {r.source !== "manual" ? (
                <Icon name="bolt" className="size-3.5 text-teal" />
              ) : (
                <span className="text-[11px] text-stone">a mano</span>
              )}
            </span>
            <span className="font-mono">Bs. {formatRate(r.bs_per_usd)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function DayPayments({ searchParams }: { searchParams: SearchParams }) {
  const { day } = await readDay(searchParams);
  const payments = await getPayments(day);
  const valid = payments.filter((p) => !p.voided_at);
  const byMethod = PAYMENT_METHOD_LIST.map((method) => {
    const rows = valid.filter((p) => p.method === method);
    const usd = PAYMENT_METHODS[method].currency === "USD";
    return {
      method,
      count: rows.length,
      received: sumCents(rows.map((p) => (usd ? p.amount_usd : p.amount_bs))),
      usd,
    };
  }).filter((m) => m.count > 0);

  return (
    <>
      <CardHeader
        title="Cobros del día"
        hint={`${valid.length} ${valid.length === 1 ? "cobro" : "cobros"}${payments.length > valid.length ? ` · ${payments.length - valid.length} anulado(s)` : ""}`}
      />
      {payments.length ? (
        <>
        {/* Phones and upright tablets: one row per payment, the amount on the right. */}
        <ul className="divide-y divide-line lg:hidden">
          {payments.map((p) => {
            const voided = Boolean(p.voided_at);
            const usd = p.currency === "USD";
            const strike = voided ? "text-stone line-through" : "";
            const patient = p.appointment?.patient ? patientName(p.appointment.patient) : "Cita";
            return (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 leading-tight">
                  {p.appointment ? (
                    <Link href={`/dashboard/agenda/${p.appointment.id}`} className={`block truncate font-medium ${strike}`}>
                      {patient}
                    </Link>
                  ) : (
                    <p className="font-medium">—</p>
                  )}
                  <p className={`mt-1 flex items-center gap-1.5 text-[13px] text-ink ${strike}`}>
                    <Icon name={PAYMENT_METHODS[p.method].icon} className="size-3.5 text-teal" />
                    {PAYMENT_METHODS[p.method].label}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {formatTime(p.created_at)}
                    {p.cashea_order && ` · ${PAYMENT_METHODS[p.method].financed ? "financiado" : "inicial"} · orden ${p.cashea_order}`}
                    {p.reference && ` · ref. ${p.reference}`}
                    {` · recibió ${p.receiver?.full_name?.trim() || p.receiver?.email || "—"}`}
                  </p>
                  {voided && <p className="mt-1 text-[12px] text-[#b03a36]">Anulado: {p.void_reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className={`font-mono text-sm whitespace-nowrap ${strike}`}>{usd ? formatUsd(p.amount_usd) : formatBs(p.amount_bs)}</p>
                  <p className={`font-mono text-[12px] whitespace-nowrap text-muted ${strike}`}>{usd ? formatBs(p.amount_bs) : formatUsd(p.amount_usd)}</p>
                  {!voided && (
                    <VoidPayment
                      paymentId={p.id}
                      summary={`${PAYMENT_METHODS[p.method].label} · ${usd ? formatUsd(p.amount_usd) : formatBs(p.amount_bs)}${
                        p.appointment?.patient ? ` · ${patient}` : ""
                      }`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <table className="hidden w-full min-w-[820px] border-collapse lg:table">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Hora</th>
              <th className={th}>Paciente</th>
              <th className={th}>Forma de pago</th>
              <th className={`${th} text-right`}>Recibido</th>
              <th className={`${th} text-right`}>Equivale</th>
              <th className={th}>Recibió</th>
              <th className={th}>
                <span className="sr-only">Anular</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((p) => {
              const voided = Boolean(p.voided_at);
              const usd = p.currency === "USD";
              const strike = voided ? "text-stone line-through" : "";
              return (
                <tr key={p.id} className="align-top">
                  <td className={`${td} whitespace-nowrap ${strike}`}>{formatTime(p.created_at)}</td>
                  <td className={td}>
                    {p.appointment ? (
                      <Link href={`/dashboard/agenda/${p.appointment.id}`} className={`font-medium whitespace-nowrap hover:text-teal ${strike}`}>
                        {p.appointment.patient ? patientName(p.appointment.patient) : "Cita"}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {voided && <p className="text-[12px] text-[#b03a36]">Anulado: {p.void_reason}</p>}
                  </td>
                  <td className={`${td} ${strike}`}>
                    <span className="flex items-center gap-1.5">
                      <Icon name={PAYMENT_METHODS[p.method].icon} className="size-3.5 text-teal" />
                      {PAYMENT_METHODS[p.method].label}
                    </span>
                    {p.cashea_order && (
                      <p className="text-[12px] text-muted">
                        {PAYMENT_METHODS[p.method].financed ? "Financiado" : "Inicial"} · orden {p.cashea_order}
                      </p>
                    )}
                    {p.reference && <p className="text-[12px] text-muted">Ref. {p.reference}</p>}
                  </td>
                  <td className={`${td} text-right font-mono whitespace-nowrap ${strike}`}>
                    {usd ? formatUsd(p.amount_usd) : formatBs(p.amount_bs)}
                  </td>
                  <td className={`${td} text-right font-mono whitespace-nowrap text-muted ${strike}`}>
                    {usd ? formatBs(p.amount_bs) : formatUsd(p.amount_usd)}
                  </td>
                  <td className={`${td} text-[13px] text-muted`}>
                    {p.receiver?.full_name?.trim() || p.receiver?.email || "—"}
                  </td>
                  <td className={td}>
                    {!voided && (
                      <VoidPayment
                        paymentId={p.id}
                        summary={`${PAYMENT_METHODS[p.method].label} · ${usd ? formatUsd(p.amount_usd) : formatBs(p.amount_bs)}${
                          p.appointment?.patient ? ` · ${patientName(p.appointment.patient)}` : ""
                        }`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </>
      ) : (
        <EmptyState icon="ledger" title="No hay cobros este día">
          Los cobros se registran en cada cita de la agenda.
        </EmptyState>
      )}
      {byMethod.length > 0 && (
        <dl className="grid gap-2 border-t border-line px-5 py-4 text-sm sm:grid-cols-2">
          {byMethod.map((m) => (
            <div key={m.method} className="flex justify-between gap-4">
              <dt className="text-muted">
                {PAYMENT_METHODS[m.method].label} ({m.count})
              </dt>
              <dd className="font-mono">{m.usd ? formatUsd(m.received) : formatBs(m.received)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/** Visits up to today with a balance, whatever day is on screen. */
async function Receivables() {
  const today = await clinicToday();
  const supabase = await createClient();
  const { data: dueRows } = await supabase
    .from("appointment_balances")
    .select("appointment_id, patient_id, starts_at, starts_on, status, total_usd, paid_usd, balance_usd")
    .gt("balance_usd", 0)
    .lte("starts_on", today)
    .not("status", "in", `(${UNBILLED_STATUSES.join(",")})`)
    .order("starts_at")
    .limit(200);
  const due = dueRows ?? [];

  const patientIds = [...new Set(due.map((d) => d.patient_id).filter((id): id is string => Boolean(id)))];
  const { data: duePatients } = patientIds.length
    ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
    : { data: [] };
  const names = new Map((duePatients ?? []).map((p) => [p.id, patientName(p)]));
  const totalDue = sumCents(due.map((d) => d.balance_usd ?? 0));

  return (
    <>
      <CardHeader
        title="Cuentas por cobrar"
        hint={due.length ? `${due.length} ${due.length === 1 ? "cita" : "citas"} hasta hoy · ${formatUsd(totalDue)}` : "Citas hasta hoy con saldo pendiente"}
      />
      {due.length ? (
        <>
        {/* Phones: one row per visit, what is still owed on the right. */}
        <ul className="divide-y divide-line sm:hidden">
          {due.map((d) => (
            <li key={d.appointment_id}>
              <Link href={`/dashboard/agenda/${d.appointment_id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 active:bg-cream">
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-medium">{(d.patient_id && names.get(d.patient_id)) || "—"}</span>
                  <span className="mt-1 block text-[13px] text-muted">
                    {d.starts_on ? formatDay(d.starts_on, "short") : "—"} · pagó {formatUsd(d.paid_usd ?? 0)} de {formatUsd(d.total_usd ?? 0)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-medium">{formatUsd(d.balance_usd ?? 0)}</span>
                  <Icon name="chevron-right" className="size-4 text-stone" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <table className="hidden w-full min-w-[620px] border-collapse sm:table">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Cita</th>
              <th className={th}>Paciente</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Pagado</th>
              <th className={`${th} text-right`}>Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {due.map((d) => (
              <tr key={d.appointment_id}>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/dashboard/agenda/${d.appointment_id}`} className="font-medium hover:text-teal">
                    {d.starts_on ? formatDay(d.starts_on, "short") : "—"}
                  </Link>
                </td>
                <td className={td}>{(d.patient_id && names.get(d.patient_id)) || "—"}</td>
                <td className={`${td} text-right font-mono`}>{formatUsd(d.total_usd ?? 0)}</td>
                <td className={`${td} text-right font-mono`}>{formatUsd(d.paid_usd ?? 0)}</td>
                <td className={`${td} text-right font-mono font-medium`}>{formatUsd(d.balance_usd ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      ) : (
        <EmptyState icon="check" title="Nada pendiente">
          Todas las citas hasta hoy están pagadas.
        </EmptyState>
      )}
    </>
  );
}
