import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PaymentBadge } from "@/components/crm/appointment-list";
import { DatePicker, TimePicker } from "@/components/crm/date-picker";
import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { RateForm } from "@/components/crm/rate-form";
import { Select } from "@/components/crm/select";
import { Icon } from "@/components/crm/icons";
import {
  Badge,
  Card,
  CardHeader,
  FormSkeleton,
  PageHeader,
  RowsSkeleton,
  Skeleton,
  td,
  th,
} from "@/components/crm/ui";
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
import { getAppointment, getBalances, getProfessionals, getRecentRates, getServices, getTodayRate } from "@/lib/crm/data";
import { formatBs, formatRate, formatUsd, toCents, toRate, usdToBs } from "@/lib/crm/money";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { VoidPayment } from "../../contabilidad/void-payment";
import { rescheduleAppointment, saveAppointmentNotes, setAppointmentStatus } from "../actions";
import { AddItemModal, ItemControls, PaymentForm } from "./controls";
import { WhatsAppCard } from "./whatsapp-card";

export const metadata: Metadata = { title: "Cita" };

const quickAction = "flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 active:bg-cream";

const paidAt = new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", hour: "numeric", minute: "2-digit" });

type Params = PageProps<"/dashboard/agenda/[id]">["params"];

// One visit: its services (each with professional and price), status, time,
// patient and, for those who handle money, the charge and its payments.
// Everything on it comes from the appointment, so the App Shell has only the
// frame of the cards this viewer gets; the visit streams in.
export default async function AppointmentPage({ params }: PageProps<"/dashboard/agenda/[id]">) {
  const viewer = await getViewer();
  return (
    <Suspense fallback={<AppointmentSkeleton viewer={viewer} />}>
      <Appointment params={params} viewer={viewer} />
    </Suspense>
  );
}

function AppointmentSkeleton({ viewer }: { viewer: Viewer }) {
  const p = viewer.permissions;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<Skeleton className="w-56" />}
        title={<Skeleton className="w-72" />}
        description={<Skeleton className="w-52" />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Servicios" hint={<Skeleton className="w-32" />} />
            <RowsSkeleton rows={2} />
          </Card>
          {p.manageSchedule && (
            <Card>
              <CardHeader title="Estado y horario" hint={<Skeleton className="w-28" />} />
              <FormSkeleton fields={3} className="px-5 py-5 sm:grid-cols-3" />
            </Card>
          )}
          <Card>
            <CardHeader title="Nota" hint="Para el equipo del centro; no es historia clínica" />
            <RowsSkeleton rows={1} dense />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Paciente" />
            <RowsSkeleton rows={3} dense />
          </Card>
          {(p.collectPayments || p.accounting) && (
            <Card>
              <CardHeader title="Cobro" hint="Dólares, bolívares a la tasa BCV del día, o Cashea" />
              <RowsSkeleton rows={3} dense />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

async function Appointment({ params, viewer }: { params: Params; viewer: Viewer }) {
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
    money ? getTodayRate(today) : null,
    p.collectPayments ? getRecentRates(today, 2) : [],
    money
      ? supabase
          .from("payments")
          .select("id, method, currency, amount_usd, amount_bs, rate, reference, cashea_order, paid_on, created_at, voided_at, void_reason")
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
            {appointment.source === "online" && <Badge tone="navy">En línea</Badge>}
            {money && <PaymentBadge balance={balance} status={appointment.status} />}
            {p.labReports && patient && appointment.items.some((item) => item.service?.area === "bioanalisis") && (
              <Link
                href={`/dashboard/laboratorio/nuevo?paciente=${patient.id}&cita=${appointment.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy"
              >
                <Icon name="flask" className="size-4" />
                Cargar resultados
              </Link>
            )}
            <Link
              href={`/dashboard/agenda?fecha=${day}`}
              className="inline-flex h-10 items-center rounded-lg border border-outline bg-white px-4 text-sm font-medium whitespace-nowrap hover:border-navy"
            >
              Volver a la agenda
            </Link>
          </>
        }
      />

      {/* Phones and upright tablets: what the front desk reaches for first. */}
      {patient && (
        <nav aria-label="Paciente" className="grid grid-cols-2 gap-3 lg:hidden">
          {patient.phone ? (
            <a href={`tel:${patient.phone.replace(/[^\d+]/g, "")}`} className={quickAction}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint/30 text-[#135c62]">
                <Icon name="phone" className="size-[18px]" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-medium">Llamar</span>
                <span className="block truncate text-[12px] text-muted">{patient.phone}</span>
              </span>
            </a>
          ) : (
            <span className={`${quickAction} text-stone`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand">
                <Icon name="phone" className="size-[18px]" />
              </span>
              <span className="text-sm">Sin teléfono</span>
            </span>
          )}
          <Link href={`/dashboard/pacientes/${patient.id}`} className={quickAction}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-frost text-navy">
              <Icon name="id-card" className="size-[18px]" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-medium">Ver ficha</span>
              <span className="block truncate text-[12px] text-muted">{formatDocument(patient) ?? "Sin cédula"}</span>
            </span>
          </Link>
        </nav>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="overflow-x-auto">
            <CardHeader
              title="Servicios"
              hint={`${appointment.items.length} ${appointment.items.length === 1 ? "servicio" : "servicios"}${money ? ` · total ${formatUsd(balance.total)}` : ""}`}
            />
            {/* Phones: each service as a row, its price on the right, "Editar" under it. */}
            <ul className="divide-y divide-line sm:hidden">
              {appointment.items.map((item) => {
                const professional = item.professional_id ? professionals.byId.get(item.professional_id) : null;
                const changed = toCents(item.price_usd) !== toCents(item.list_price_usd);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium">{item.service?.name ?? "Servicio"}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {professional ? (
                          <span className={professional.id === viewer.id ? "font-medium text-[#135c62]" : ""}>
                            {professional.name}
                            {professional.id === viewer.id && " (tú)"}
                          </span>
                        ) : (
                          <>{item.service ? `${AREA_LABEL[item.service.area]} · ` : ""}sin asignar</>
                        )}
                      </p>
                      {manage && (
                        <div className="mt-2">
                          <ItemControls
                            itemId={item.id}
                            appointmentId={id}
                            serviceName={item.service?.name ?? "Servicio"}
                            professionalId={item.professional_id}
                            price={item.price_usd}
                            listPrice={item.list_price_usd}
                            professionals={professionals.list}
                            canRemove={appointment.items.length > 1}
                          />
                        </div>
                      )}
                    </div>
                    {money && (
                      <p className="shrink-0 text-right font-mono text-sm whitespace-nowrap">
                        {formatUsd(item.price_usd)}
                        {changed && (
                          <span className="block font-sans text-[12px] text-stone">
                            Centro: <s>{formatUsd(item.list_price_usd)}</s>
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
              {money && (
                <li className="flex justify-between gap-3 px-4 py-3.5 text-sm font-medium">
                  <span>Total</span>
                  <span className="font-mono">{formatUsd(balance.total)}</span>
                </li>
              )}
            </ul>
            <table className="hidden w-full min-w-[560px] border-collapse sm:table">
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
                            serviceName={item.service?.name ?? "Servicio"}
                            professionalId={item.professional_id}
                            price={item.price_usd}
                            listPrice={item.list_price_usd}
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
              <div className="border-t border-line px-5 py-4">
                <AddItemModal appointmentId={id} services={offered} professionals={professionals.list} />
              </div>
            )}
          </Card>

          {manage && (
            <Card>
              <CardHeader title="Estado y horario" hint={`Ahora: ${status.label.toLowerCase()}`} />
              <div className="flex flex-col gap-5 px-5 py-5">
                <ActionForm action={setAppointmentStatus} className="flex flex-col gap-2">
                  <input type="hidden" name="appointment" value={id} />
                  <div className="flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
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
                      <DatePicker name="date" required defaultValue={day} />
                    </Field>
                    <Field label="Hora">
                      <TimePicker name="time" required defaultValue={localTime(appointment.starts_at)} />
                    </Field>
                    <Field label="Duración">
                      <Select
                        name="duration"
                        defaultValue={String(appointment.duration_minutes)}
                        triggerIcon="clock"
                        searchable={false}
                        options={[...new Set([...DURATIONS, appointment.duration_minutes])]
                          .sort((a, b) => a - b)
                          .map((minutes) => ({ value: String(minutes), label: formatDuration(minutes) }))}
                      />
                    </Field>
                    <SubmitButton variant="secondary" pendingLabel="Moviendo…">
                      Mover
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </Card>
          )}

          {appointment.source === "online" && (
            <Card>
              <CardHeader
                title="Agendada en línea"
                hint={
                  appointment.status === "scheduled"
                    ? "El paciente la reservó desde el enlace del calendario. Confírmala por WhatsApp o llamada."
                    : "El paciente la reservó desde el enlace del calendario."
                }
              />
              <div className="flex gap-3 px-5 py-4">
                <Icon name="note" className="mt-0.5 size-[18px] shrink-0 text-teal" />
                <div className="min-w-0">
                  <p className="text-[12px] tracking-[0.04em] text-stone uppercase">Nota del paciente</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-ink">
                    {appointment.patient_notes || "No dejó notas."}
                  </p>
                </div>
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

          {patient && (
            <Suspense
              fallback={
                <Card>
                  <CardHeader title="WhatsApp" />
                  <div className="px-5 py-4">
                    <Skeleton className="w-40" />
                  </div>
                </Card>
              }
            >
              <WhatsAppCard
                appointmentId={id}
                patientId={patient.id}
                startsAt={appointment.starts_at}
                status={appointment.status}
                canSend={manage}
              />
            </Suspense>
          )}

          {money && (
            <Card>
              <CardHeader title="Cobro" hint="Dólares, bolívares a la tasa BCV del día, o Cashea" />
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
                            <p className="flex items-center gap-1.5 font-medium">
                              <Icon name={PAYMENT_METHODS[pay.method].icon} className="size-3.5 text-teal" />
                              {PAYMENT_METHODS[pay.method].label}
                              {pay.cashea_order && !PAYMENT_METHODS[pay.method].financed && (
                                <span className="font-normal text-muted">· inicial Cashea</span>
                              )}
                            </p>
                            <p className="text-[12px] text-muted">
                              {formatDay(pay.paid_on, "short")} · {paidAt.format(new Date(pay.created_at))} · tasa{" "}
                              {formatRate(pay.rate)}
                              {pay.cashea_order && ` · orden ${pay.cashea_order}`}
                              {pay.reference && ` · ref. ${pay.reference}`}
                            </p>
                            {PAYMENT_METHODS[pay.method].financed && !voided && (
                              <p className="text-[12px] text-[#135c62]">Financiado: se cobra en cuotas, garantizadas por Cashea</p>
                            )}
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
                          {p.accounting && !voided && (
                            <VoidPayment
                              paymentId={pay.id}
                              summary={`${PAYMENT_METHODS[pay.method].label} · ${usd ? formatUsd(pay.amount_usd) : formatBs(pay.amount_bs)}`}
                            />
                          )}
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
                      <p className="text-sm font-medium">Antes de cobrar hace falta la tasa BCV de hoy</p>
                      <RateForm
                        day={today}
                        current={null}
                        suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null}
                        canFetch
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
