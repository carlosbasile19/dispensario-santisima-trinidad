import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Icon, type IconName } from "@/components/crm/icons";
import { Modal } from "@/components/crm/modal";
import { inputClass } from "@/components/crm/styles";
import { Badge, Card, CardHeader, PageHeader, RowsSkeleton, Skeleton } from "@/components/crm/ui";
import { DeliveryActions } from "@/components/lab/delivery-actions";
import { ForgetParam } from "@/components/lab/forget-param";
import { ReportEditor } from "@/components/lab/report-editor";
import { ResultsTable } from "@/components/lab/results-table";
import { formatDay, isUuid, localDay, param } from "@/lib/crm/clinic";
import { getProfessionals } from "@/lib/crm/data";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { pdfFileName } from "@/lib/lab/config";
import { getDeliveries, getLabReport, getLabSettings, signerOf, type Delivery, type LabReport } from "@/lib/lab/data";
import { dictationReady } from "@/lib/lab/dictation-config";
import { dayLong, documentOf, fullName, sexLabel, stampLong, clockTime } from "@/lib/lab/format";
import { FLAG_INFO, formatAge } from "@/lib/lab/reference";
import { PATIENT_TYPE_LABEL, reportNumber, tally } from "@/lib/lab/report";
import { suggestPanels } from "@/lib/lab/search";
import { automaticSend, whatsAppReadiness } from "@/lib/lab/whatsapp";
import { createClient } from "@/lib/supabase/server";
import { failureLabel } from "@/lib/whatsapp/labels";
import { reopenLabReport } from "../actions";

export const metadata: Metadata = { title: "Informe de laboratorio" };

// One report. A draft opens in the builder for doctors and administrators;
// a validated report (or a draft for anyone else) shows how to hand it out
// (printed, PDF, WhatsApp) with its results, deliveries and versions. Right
// after validating (?validado=1) it says so, and what went out by WhatsApp.
export default async function LabReportPage({ params, searchParams }: PageProps<"/dashboard/laboratorio/[id]">) {
  const viewer = await getViewer();
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Report params={params} searchParams={searchParams} viewer={viewer} />
    </Suspense>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Laboratorio" title={<Skeleton className="w-72" />} description={<Skeleton className="w-48" />} />
      <Card>
        <RowsSkeleton rows={4} />
      </Card>
    </div>
  );
}

async function Report({
  params,
  searchParams,
  viewer,
}: {
  params: PageProps<"/dashboard/laboratorio/[id]">["params"];
  searchParams: PageProps<"/dashboard/laboratorio/[id]">["searchParams"];
  viewer: Viewer;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const report = await getLabReport(id);
  if (!report) notFound();

  if (report.status === "draft" && viewer.permissions.labReports) return <Builder report={report} />;
  const justValidated = param(query.validado) === "1" && validatedJustNow(report);
  return <Delivered report={report} viewer={viewer} justValidated={justValidated} />;
}

/** The greeting is only for right after the validation, not for the link reopened later. */
const validatedJustNow = (report: LabReport) =>
  report.status === "final" && Boolean(report.finalizedAt) && Date.now() - Date.parse(report.finalizedAt!) < 10 * 60_000;

async function visitServices(appointmentId: string | null) {
  if (!appointmentId) return { names: [] as string[], label: null as string | null };
  const supabase = await createClient();
  const [{ data: items }, { data: visit }] = await Promise.all([
    supabase.from("appointment_items").select("services(name, area)").eq("appointment_id", appointmentId),
    supabase.from("appointments").select("starts_at").eq("id", appointmentId).maybeSingle(),
  ]);
  const names = (items ?? []).map((item) => item.services).filter((s) => s?.area === "bioanalisis").map((s) => s!.name);
  return { names, label: visit ? `Cita del ${formatDay(localDay(visit.starts_at), "short")}` : null };
}

async function Builder({ report }: { report: LabReport }) {
  const [settings, visit, autoSend] = await Promise.all([getLabSettings(), visitServices(report.appointmentId), automaticSend(report)]);
  return (
    <ReportEditor
      id={report.id}
      number={report.number}
      revision={report.revision}
      updatedAt={report.updatedAt}
      patient={{ ...report.patient, id: report.patientId }}
      content={report.content}
      signer={signerOf(settings)}
      suggested={suggestPanels(visit.names)}
      visit={visit.label}
      reopenReason={report.reopenReason}
      canDiscard={!report.reopenedAt}
      autoSend={autoSend}
      dictation={dictationReady()}
    />
  );
}

const CHANNEL: Record<string, { label: string; icon: IconName }> = {
  print: { label: "Boleta impresa", icon: "printer" },
  share: { label: "Compartido desde un dispositivo", icon: "share" },
  download: { label: "PDF descargado", icon: "download" },
  whatsapp: { label: "Enviado por WhatsApp", icon: "chat" },
};

/** A WhatsApp send, as far as Meta has told us (the webhook moves it on). */
const WHATSAPP_STATE: Record<string, string> = {
  sending: "Enviando por WhatsApp…",
  sent: "Enviado por WhatsApp",
  delivered: "Entregado por WhatsApp",
  read: "Leído en WhatsApp",
};

async function Delivered({ report, viewer, justValidated = false }: { report: LabReport; viewer: Viewer; justValidated?: boolean }) {
  const supabase = await createClient();
  const [deliveries, professionals, { data: versions }, readiness] = await Promise.all([
    getDeliveries(report.id),
    getProfessionals(),
    supabase.from("lab_report_versions").select("revision, finalized_at").eq("report_id", report.id).order("revision", { ascending: false }),
    whatsAppReadiness(report),
  ]);
  const name = fullName(report.patient);
  const number = reportNumber(report.number);
  const final = report.status === "final";
  const { results, flagged } = tally(report.content.sections, report.facts);
  // The newest WhatsApp send of this revision that did not fail (deliveries come newest first).
  const onWhatsApp = deliveries.find((d) => d.channel === "whatsapp" && d.revision === report.revision && d.status !== "failed");
  const validatedBy = report.finalizedBy ? professionals.byId.get(report.finalizedBy)?.name : null;
  const phone = report.livePatient?.phone_e164 ?? null;
  const signerName = report.signer?.name ?? "el bioanalista";
  const message = `Hola, ${report.patient.first_name.split(" ")[0]}. Te enviamos tus resultados de laboratorio de la muestra del ${dayLong(report.content.sampledDay)}, validados por ${signerName}, del Centro Médico Integral Santísima Trinidad. Si tienes dudas, consúltalos con tu médico.`;

  const facts: [string, string][] = [
    ["Documento", documentOf(report.patient) ?? "Sin documento"],
    ["Edad · sexo", [formatAge(report.patient.birth_date, report.content.sampledDay), sexLabel(report.patient.sex)].filter(Boolean).join(" · ") || "—"],
    ["Muestra", `${dayLong(report.content.sampledDay)}, ${clockTime(report.content.sampledTime)}`],
    ["Tipo", PATIENT_TYPE_LABEL[report.content.patientType]],
    ["Solicitado por", report.content.requestedBy || "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link href="/dashboard/laboratorio" className="hover:text-navy">
              Laboratorio
            </Link>
            · Informe Nº {number}
          </span>
        }
        title={name}
        description={
          final
            ? `Validado el ${stampLong(report.finalizedAt!)}${validatedBy ? ` por ${validatedBy}` : ""} · ${results} resultados${flagged.length ? `, ${flagged.length} fuera de rango` : ""}`
            : "Borrador: todavía no está validado por el laboratorio."
        }
        actions={
          <>
            {final ? <Badge tone="teal">Validado</Badge> : <Badge tone="outline">Borrador</Badge>}
            {report.revision > 1 && <Badge tone="navy">Revisión {report.revision}</Badge>}
            {onWhatsApp && <Badge tone={onWhatsApp.status === "read" ? "teal" : "solid"}>{WHATSAPP_STATE[onWhatsApp.status] ?? "Enviado por WhatsApp"}</Badge>}
          </>
        }
      />

      {justValidated && (
        <section className="validated-hero flex items-start gap-4 overflow-hidden rounded-2xl border border-teal/30 bg-gradient-to-br from-mint/30 via-white to-white px-5 py-4 sm:px-6">
          <ForgetParam name="validado" />
          <span className="booking-pop grid size-12 shrink-0 place-items-center rounded-full bg-teal text-white shadow-[0_10px_24px_-10px_rgba(30,126,134,0.9)]">
            <Icon name="check" className="size-6" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-serif text-[22px] leading-tight">Informe validado y firmado</p>
            <p className="mt-1 text-sm text-muted">
              {onWhatsApp
                ? `El PDF salió por WhatsApp${onWhatsApp.to_phone ? ` al ${onWhatsApp.to_phone}` : ""}, protegido con la clave del paciente. También puedes imprimir la boleta.`
                : "Ya puedes entregarlo: imprime la boleta, descarga el PDF o envíalo por WhatsApp."}
            </p>
          </div>
        </section>
      )}

      {final ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Entregar resultados</h2>
          <DeliveryActions
            id={report.id}
            pdfUrl={`/dashboard/laboratorio/${report.id}/pdf`}
            printUrl={`/imprimir/laboratorio/${report.id}`}
            fileName={pdfFileName(number)}
            phoneDigits={phone ? phone.replace(/^\+/, "") : null}
            message={message}
            whatsApp={readiness}
            sentBefore={Boolean(onWhatsApp)}
            patientHref={`/dashboard/pacientes/${report.patientId}`}
            canConfigure={viewer.permissions.management}
          />
        </section>
      ) : (
        <p className="flex gap-3 rounded-xl bg-[#fff8e6] px-4 py-3 text-sm text-[#7a5300]">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          Este informe está en preparación. Cuando un médico o un administrador lo valide, aquí podrás imprimirlo y enviarlo.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {flagged.length > 0 && (
            <div className="rounded-xl border border-coral/30 bg-coral/[0.05] px-5 py-4">
              <p className="text-[12px] font-medium tracking-[0.08em] text-[#b03a36] uppercase">Fuera del rango de referencia</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {flagged.map(({ row, flag }) => (
                  <li key={row.id} className="rounded-full bg-white px-3 py-1 text-[13px] shadow-[0_0_0_1px_rgba(217,83,79,0.25)]">
                    <span className="text-navy">{row.label}</span>{" "}
                    <span className="font-medium text-[#b03a36]">
                      {FLAG_INFO[flag].arrow} {row.value}
                      {row.unit ? ` ${row.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ResultsTable sections={report.content.sections} facts={report.facts} />
          {report.content.notes && (
            <Card className="px-5 py-4">
              <p className="text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Observaciones</p>
              <p className="mt-1 text-sm whitespace-pre-line">{report.content.notes}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Datos del informe" />
            <dl className="grid gap-3 px-5 py-4 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
              {report.signer && (
                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <dt className="text-muted">Firma</dt>
                  <dd className="min-w-0">
                    {report.signer.name}
                    <span className="block text-[12px] text-muted">
                      {[report.signer.id_number, report.signer.registry, report.signer.college].filter(Boolean).join(" · ")}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-5 py-3.5">
              <Link href={`/dashboard/pacientes/${report.patientId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-navy">
                <Icon name="patients" className="size-4" />
                Ficha del paciente
              </Link>
              {final && viewer.permissions.labReports && (
                <Modal trigger="Corregir informe" triggerIcon="refresh" title="Corregir el informe" description={`Nº ${number} · ${name}`} icon="refresh" tone="coral">
                  <ActionForm action={reopenLabReport}>
                    <input type="hidden" name="report" value={report.id} />
                    <p className="mb-4 text-sm text-muted">
                      El informe vuelve a borrador como revisión {report.revision + 1}. La versión ya entregada queda guardada y el nuevo PDF dirá que la reemplaza.
                    </p>
                    <Field label="¿Qué se corrige?">
                      <textarea name="reason" required minLength={3} maxLength={300} rows={3} className={`${inputClass} h-auto py-2`} placeholder="Ej.: Se corrige el valor de hemoglobina." />
                    </Field>
                    <ModalActions>
                      <SubmitButton variant="destructive" icon="refresh" pendingLabel="Reabriendo…">
                        Reabrir para corregir
                      </SubmitButton>
                    </ModalActions>
                  </ActionForm>
                </Modal>
              )}
              {!final && viewer.permissions.labReports && (
                <Link href={`/dashboard/laboratorio/${report.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-navy">
                  Continuar editando
                </Link>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Entregas" hint="Impresiones, descargas y envíos de este informe" />
            {deliveries.length ? (
              <ul className="divide-y divide-line">
                {deliveries.map((d) => (
                  <DeliveryRow key={d.id} delivery={d} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Todavía no se ha entregado.</p>
            )}
          </Card>

          {(versions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Versiones" hint={report.reopenReason ? `Última corrección: ${report.reopenReason}` : undefined} />
              <ul className="divide-y divide-line">
                {versions!.map((v) => (
                  <li key={v.revision} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>Revisión {v.revision}</span>
                    <span className="text-[13px] text-muted">{stampLong(v.finalized_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const channel = CHANNEL[delivery.channel] ?? { label: delivery.channel, icon: "send" as IconName };
  const whatsApp = delivery.channel === "whatsapp";
  const failed = delivery.status === "failed";
  // Accepted by WhatsApp and failed later (the webhook), or refused at once.
  const title = failed
    ? delivery.error_code === "interrupted"
      ? "Envío por WhatsApp interrumpido"
      : delivery.wamid
        ? "No llegó por WhatsApp"
        : "No se envió por WhatsApp"
    : whatsApp
      ? (WHATSAPP_STATE[delivery.status] ?? channel.label)
      : channel.label;
  const progress = [
    delivery.delivered_at && `Entregado: ${stampLong(delivery.delivered_at)}`,
    delivery.read_at && `Leído: ${stampLong(delivery.read_at)}`,
  ].filter(Boolean);
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          failed ? "bg-coral/10 text-[#b03a36]" : delivery.status === "read" ? "bg-mint/30 text-[#135c62]" : "bg-frost text-navy"
        }`}
      >
        <Icon name={channel.icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className={failed ? "text-[#b03a36]" : ""}>
          {title}
          {delivery.automatic && <span className="text-muted"> · automático al validar</span>}
          {delivery.revision > 1 && <span className="text-muted"> · rev. {delivery.revision}</span>}
        </p>
        <p className="text-[12px] text-muted">
          {stampLong(delivery.created_at)}
          {delivery.to_phone ? ` · ${delivery.to_phone}` : ""}
        </p>
        {progress.length > 0 && <p className="text-[12px] text-[#135c62]">{progress.join(" · ")}</p>}
        {failed && <p className="text-[12px] text-[#b03a36]">{failureLabel(delivery.error_code, delivery.error)}</p>}
      </div>
    </li>
  );
}
