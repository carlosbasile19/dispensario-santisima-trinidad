import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { RateForm } from "@/components/crm/rate-form";
import { Card, CardHeader, EmptyState, NoAccess, PageHeader, td, th } from "@/components/crm/ui";
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
import { getRate, getRecentRates } from "@/lib/crm/data";
import { formatBs, formatRate, formatUsd, sumCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { AccountingTabs } from "./tabs";
import { VoidPayment } from "./void-payment";

export const metadata: Metadata = { title: "Contabilidad" };

const navButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";

// Contabilidad (administrators only): a day's payments with their BCV rate
// and totals in both currencies, the rate of any day, and what patients
// still owe.
export default async function AccountingPage({ searchParams }: PageProps<"/dashboard/contabilidad">) {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  const today = await clinicToday();
  const requested = param((await searchParams).fecha);
  const day = isIsoDate(requested) ? requested : today;
  const supabase = await createClient();

  const [rate, recentRates, { data: paymentRows }, { data: dueRows }] = await Promise.all([
    getRate(day),
    getRecentRates(today, 10),
    supabase
      .from("payments")
      .select(
        "id, method, currency, amount_usd, amount_bs, rate, reference, created_at, voided_at, void_reason, appointment:appointments(id, patient:patients(first_name, last_name)), receiver:profiles!payments_received_by_fkey(full_name, email)",
      )
      .eq("paid_on", day)
      .order("created_at"),
    supabase
      .from("appointment_balances")
      .select("appointment_id, patient_id, starts_at, starts_on, status, total_usd, paid_usd, balance_usd")
      .gt("balance_usd", 0)
      .lte("starts_on", today)
      .not("status", "in", `(${UNBILLED_STATUSES.join(",")})`)
      .order("starts_at")
      .limit(200),
  ]);
  const payments = paymentRows ?? [];
  const valid = payments.filter((p) => !p.voided_at);
  const due = dueRows ?? [];

  const patientIds = [...new Set(due.map((d) => d.patient_id).filter((id): id is string => Boolean(id)))];
  const { data: duePatients } = patientIds.length
    ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
    : { data: [] };
  const names = new Map((duePatients ?? []).map((p) => [p.id, patientName(p)]));

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
  const totalUsd = sumCents(valid.map((p) => p.amount_usd));
  const totalBs = sumCents(valid.map((p) => p.amount_bs));
  const cashUsd = sumCents(valid.filter((p) => p.currency === "USD").map((p) => p.amount_usd));
  const cashBs = sumCents(valid.filter((p) => p.currency === "VES").map((p) => p.amount_bs));
  const totalDue = sumCents(due.map((d) => d.balance_usd ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Cobros del día en dólares y en bolívares a la tasa BCV, y cuentas por cobrar."
      />
      <AccountingTabs active="cobros" />

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
        <form action="/dashboard/contabilidad" className="flex gap-2">
          <input type="date" name="fecha" defaultValue={day} aria-label="Ir al día" className="h-10 rounded-lg border border-outline bg-white px-3 text-sm" />
          <button type="submit" className={navButton}>
            Ver
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total del día", formatUsd(totalUsd), `${formatBs(totalBs)} a tasa BCV`],
          ["Recibido en dólares", formatUsd(cashUsd), "Efectivo y Zelle"],
          ["Recibido en bolívares", formatBs(cashBs), "Pago móvil, punto, transferencia y efectivo"],
          ["Tasa BCV del día", rate ? `Bs. ${formatRate(rate.bs_per_usd)}` : "Sin cargar", "Bolívares por dólar"],
        ].map(([label, value, hint]) => (
          <Card key={label} className="px-5 py-4">
            <p className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</p>
            <p className="mt-1.5 font-mono text-xl">{value}</p>
            <p className="mt-1 text-[13px] text-muted">{hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tasa BCV" hint={`Del ${formatDay(day, "short")}`} />
          <div className="px-5 py-4">
            <RateForm
              day={day}
              current={rate?.bs_per_usd ?? null}
              suggestion={recentRates.find((r) => r.rate_date < day)?.bs_per_usd ?? null}
              hasPayments={payments.length > 0}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Últimas tasas" />
          {recentRates.length ? (
            <ul className="divide-y divide-line">
              {recentRates.map((r) => (
                <li key={r.rate_date}>
                  <Link
                    href={`/dashboard/contabilidad?fecha=${r.rate_date}`}
                    className={`flex justify-between px-5 py-2.5 text-sm hover:bg-cream ${r.rate_date === day ? "font-medium" : ""}`}
                  >
                    <span>{formatDay(r.rate_date, "short")}</span>
                    <span className="font-mono">Bs. {formatRate(r.bs_per_usd)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Todavía no se ha cargado ninguna tasa.</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <CardHeader
          title="Cobros del día"
          hint={`${valid.length} ${valid.length === 1 ? "cobro" : "cobros"}${payments.length > valid.length ? ` · ${payments.length - valid.length} anulado(s)` : ""}`}
        />
        {payments.length ? (
          <table className="w-full min-w-[820px] border-collapse">
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
                      {PAYMENT_METHODS[p.method].label}
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
                    <td className={td}>{!voided && <VoidPayment paymentId={p.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      </Card>

      <Card className="overflow-x-auto">
        <CardHeader
          title="Cuentas por cobrar"
          hint={due.length ? `${due.length} ${due.length === 1 ? "cita" : "citas"} hasta hoy · ${formatUsd(totalDue)}` : "Citas hasta hoy con saldo pendiente"}
        />
        {due.length ? (
          <table className="w-full min-w-[620px] border-collapse">
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
        ) : (
          <EmptyState icon="check" title="Nada pendiente">
            Todas las citas hasta hoy están pagadas.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
