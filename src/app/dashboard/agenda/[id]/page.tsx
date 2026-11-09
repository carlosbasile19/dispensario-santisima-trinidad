import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentBadge } from "@/components/crm/appointment-list";
import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { RateForm } from "@/components/crm/rate-form";
import { Badge, Card, CardHeader, PageHeader, td, th } from "@/components/crm/ui";
import {
  AREA_LABEL,
  DURATIONS,
  PAYMENT_METHODS,
  STATUS_ACTIONS,
  STATUS_INFO,
  UNBILLED_STATUSES,
  ageOn,
  clinicToday,
  endTime,
  formatDay,
  formatDocument,
  formatDuration,
  formatTime,
  isUuid,
  localDay,
  localTime,
  patientName,
} from "@/lib/crm/clinic";
import { getAppointment, getBalances, getProfessionals, getRate, getRecentRates, getServices } from "@/lib/crm/data";
import { formatBs, formatRate, formatUsd, toCents, toRate, usdToBs } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { VoidPayment } from "../../contabilidad/void-payment";
import { rescheduleAppointment, saveAppointmentNotes, setAppointmentStatus } from "../actions";
import { AddItemForm, ItemControls, PaymentForm } from "./controls";

export const metadata: Metadata = { title: "Cita" };

const paidAt = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", hour: "numeric", minute: "2-digit" });

// One visit: its services (each with professional and price), status, time,
// patient and, for those who handle money, the charge and its payments.
export default async function AppointmentPage({ params }: PageProps<"/dashboard/agenda/[id]">) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const appointment = await getAppointment(id);
  if (!appointment) notFound();

  const p = viewer.permissions;
  const money = p.collectPayments || p.accounting;
  const manage = p.manageSchedule;
  const today = await clinicToday();
  const day = localDay(appointment.starts_at);
  const supabase = await createClient();

  const [professionals, services, balances, todayRate, recentRates, paymentsResult] = await Promise.all([
    getProfessionals(),
    manage ? getServices() : [],
    money ? getBalances([id]) : null,
    money ? getRate(today) : null,
    p.collectPayments ? getRecentRates(today, 2) : [],
    money
      ? supabase
          .from("payments")
          .select("id, method, currency, amount_usd, amount_bs, rate, reference, paid_on, created_at, voided_at, void_reason")
          .eq("appointment_id", id)
          .order("created_at")
      : null,
  ]);
  const balance = balances?.get(id) ?? { total: 0, paid: 0, balance: 0 };
  const payments = paymentsResult?.data ?? [];
  const offered = services.filter((s) => s.active);
  const status = STATUS_INFO[appointment.status];
  const patient = appointment.patient;
  const unbilled = UNBILLED_STATUSES.includes(appointment.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`Agenda · ${formatDay(day, "full")}`}
        title={patient ? patientName(patient) : "Cita"}
        description={`${formatTime(appointment.starts_at)} – ${endTime(appointment.starts_at, appointment.duration_minutes)} · ${formatDuration(appointment.duration_minutes)}`}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {money && <PaymentBadge balance={balance} status={appointment.status} />}
            <Link
              href={`/dashboard/agenda?fecha=${day}`}
              className="inline-flex h-10 items-center rounded-lg border border-outline bg-white px-4 text-sm font-medium hover:border-navy"
            >
              Volver a la agenda
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="overflow-x-auto">
            <CardHeader
              title="Servicios"
              hint={`${appointment.items.length} ${appointment.items.length === 1 ? "servicio" : "servicios"}${money ? ` · total ${formatUsd(balance.total)}` : ""}`}
            />
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Servicio</th>
                  <th className={th}>Profesional</th>
                  {money && <th className={`${th} text-right`}>Precio</th>}
                  {manage && <th className={th}><span className="sr-only">Editar</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {appointment.items.map((item) => {
                  const professional = item.professional_id ? professionals.byId.get(item.professional_id) : null;
                  const changed = toCents(item.price_usd) !== toCents(item.list_price_usd);
                  return (
                    <tr key={item.id} className="align-top">
                      <td className={td}>
                        <p className="font-medium">{item.service?.name ?? "Servicio"}</p>
                        {item.service && <p className="text-[13px] text-muted">{AREA_LABEL[item.service.area]}</p>}
                      </td>
                      <td className={td}>
                        {professional ? (
                          <span className={professional.id === viewer.id ? "font-medium text-[#135c62]" : ""}>
                            {professional.name}
                            {professional.id === viewer.id && " (tú)"}
                          </span>
                        ) : (
                          <span className="text-stone">Sin asignar</span>
                        )}
                      </td>
                      {money && (
                        <td className={`${td} text-right font-mono whitespace-nowrap`}>
                          {formatUsd(item.price_usd)}
                          {changed && (
                            <p className="font-sans text-[12px] text-stone">
                              Centro: <s>{formatUsd(item.list_price_usd)}</s>
                            </p>
                          )}
                        </td>
                      )}
                      {manage && (
                        <td className={`${td} w-[1%] min-w-[90px]`}>
                          <ItemControls
                            itemId={item.id}
                            appointmentId={id}
                            professionalId={item.professional_id}
                            price={item.price_usd}
                            professionals={professionals.list}
                            canRemove={appointment.items.length > 1}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {money && (
                <tfoot>
                  <tr className="border-t border-line">
                    <td className={`${td} font-medium`} colSpan={2}>
                      Total
                    </td>
                    <td className={`${td} text-right font-mono font-medium`}>{formatUsd(balance.total)}</td>
                    {manage && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
            {manage && offered.length > 0 && (
              <details className="border-t border-line px-5 py-4">
                <summary className="cursor-pointer text-sm font-medium text-teal hover:text-navy">Añadir un servicio</summary>
                <div className="mt-4">
                  <AddItemForm appointmentId={id} services={offered} professionals={professionals.list} />
                </div>
              </details>
            )}
          </Card>

          {manage && (
            <Card>
              <CardHeader title="Estado y horario" hint={`Ahora: ${status.label.toLowerCase()}`} />
              <div className="flex flex-col gap-5 px-5 py-5">
                <ActionForm action={setAppointmentStatus} className="flex flex-col gap-2">
                  <input type="hidden" name="appointment" value={id} />
                  <div className="flex flex-wrap gap-2">
                    {STATUS_ACTIONS[appointment.status].map(([target, label]) => (
                      <SubmitButton
                        key={target}
                        name="status"
                        value={target}
                        size="sm"
                        variant={target === "cancelled" || target === "no_show" ? "danger" : "secondary"}
                      >
                        {label}
                      </SubmitButton>
                    ))}
                  </div>
                </ActionForm>

                <ActionForm action={rescheduleAppointment} className="flex flex-col gap-3 border-t border-line pt-5">
                  <input type="hidden" name="appointment" value={id} />
                  <p className="text-[13px] font-medium">Mover la cita</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                    <Field label="Día">
                      <input type="date" name="date" required defaultValue={day} className={inputClass} />
                    </Field>
                    <Field label="Hora">
                      <input
                        type="time"
                        name="time"
                        required
                        step={300}
                        defaultValue={localTime(appointment.starts_at)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Duración">
                      <select name="duration" defaultValue={String(appointment.duration_minutes)} className={inputClass}>
                        {[...new Set([...DURATIONS, appointment.duration_minutes])]
                          .sort((a, b) => a - b)
                          .map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {formatDuration(minutes)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <SubmitButton variant="secondary" pendingLabel="Moviendo…">
                      Mover
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Nota" hint="Para el equipo del centro; no es historia clínica" />
            {manage ? (
              <ActionForm action={saveAppointmentNotes} className="flex flex-col gap-3 px-5 py-4">
                <input type="hidden" name="appointment" value={id} />
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={1000}
                  defaultValue={appointment.notes ?? ""}
                  aria-label="Nota"
                  className={`${inputClass} h-auto py-2`}
                />
                <div>
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
                    Guardar nota
                  </SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <p className="px-5 py-4 text-sm whitespace-pre-line text-ink">{appointment.notes || "Sin nota."}</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {patient && (
            <Card>
              <CardHeader
                title="Paciente"
                action={
                  <Link href={`/dashboard/pacientes/${patient.id}`} className="text-sm font-medium text-teal hover:text-navy">
                    Ver ficha
                  </Link>
                }
              />
              <dl className="grid gap-3 px-5 py-4 text-sm">
                {[
                  ["Documento", formatDocument(patient) ?? "Sin cédula"],
                  ["Edad", patient.birth_date ? `${ageOn(patient.birth_date, today)} años` : "—"],
                  ["Teléfono", patient.phone ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {money && (
            <Card>
              <CardHeader title="Cobro" hint="En dólares o en bolívares a la tasa BCV del día" />
              <dl className="grid gap-2 px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Total</dt>
                  <dd className="font-mono">{formatUsd(balance.total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Pagado</dt>
                  <dd className="font-mono">{formatUsd(balance.paid)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
                  <dt>{balance.balance < 0 ? "Saldo a favor" : "Saldo"}</dt>
                  <dd className="font-mono">{formatUsd(Math.abs(balance.balance))}</dd>
                </div>
                {todayRate && balance.balance > 0 && (
                  <p className="text-right text-[13px] text-muted">
                    Hoy en bolívares:{" "}
                    <span className="font-mono">{formatBs(usdToBs(toCents(balance.balance), toRate(todayRate.bs_per_usd)))}</span>
                  </p>
                )}
              </dl>

              {payments.length > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                  {payments.map((pay) => {
                    const voided = Boolean(pay.voided_at);
                    const usd = pay.currency === "USD";
                    return (
                      <li key={pay.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <div className={voided ? "text-stone line-through" : ""}>
                            <p className="font-medium">{PAYMENT_METHODS[pay.method].label}</p>
                            <p className="text-[12px] text-muted">
                              {formatDay(pay.paid_on, "short")} · {paidAt.format(new Date(pay.created_at))} · tasa{" "}
                              {formatRate(pay.rate)}
                              {pay.reference && ` · ref. ${pay.reference}`}
                            </p>
                          </div>
                          {voided && <p className="text-[12px] text-[#b03a36]">Anulado: {pay.void_reason}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <p className={`font-mono ${voided ? "text-stone line-through" : ""}`}>
                            {usd ? formatUsd(pay.amount_usd) : formatBs(pay.amount_bs)}
                          </p>
                          <p className="font-mono text-[12px] text-muted">
                            {usd ? formatBs(pay.amount_bs) : formatUsd(pay.amount_usd)}
                          </p>
                          {p.accounting && !voided && <VoidPayment paymentId={pay.id} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {p.collectPayments && balance.balance > 0 && !unbilled && (
                <div className="border-t border-line px-5 py-5">
                  {todayRate ? (
                    <PaymentForm
                      key={`${balance.balance}-${todayRate.bs_per_usd}`}
                      appointmentId={id}
                      balance={balance.balance}
                      rate={todayRate.bs_per_usd}
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium">Antes de cobrar, carga la tasa BCV de hoy</p>
                      <RateForm
                        day={today}
                        current={null}
                        suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null}
                      />
                    </div>
                  )}
                </div>
              )}
              {unbilled && balance.balance > 0 && (
                <p className="border-t border-line px-5 py-3.5 text-[13px] text-muted">
                  La cita está {status.label.toLowerCase()}: no se cobra. Reactívala para registrar un cobro.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
