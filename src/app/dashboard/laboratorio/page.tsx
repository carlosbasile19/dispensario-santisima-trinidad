import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { Pagination } from "@/components/crm/pagination";
import { SearchForm } from "@/components/crm/search-form";
import { Icon, type IconName } from "@/components/crm/icons";
import { inputClass } from "@/components/crm/styles";
import { Avatar, Badge, Card, CardHeader, EmptyState, FormSkeleton, PageHeader, RowsSkeleton, Skeleton, td, th } from "@/components/crm/ui";
import { formatDay, isUuid, localDay, param } from "@/lib/crm/clinic";
import { PAGE_SIZE, pageHref, pageNumber } from "@/lib/crm/pagination";
import { getViewer, type Viewer } from "@/lib/crm/viewer";
import { countLabReports, getLabSettings, listLabReports } from "@/lib/lab/data";
import { documentOf } from "@/lib/lab/format";
import { reportNumber } from "@/lib/lab/report";
import { SIGNATURE_BUCKET } from "@/lib/lab/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveLabSettings } from "./actions";
import { SignatureForm } from "./signature-form";

export const metadata: Metadata = { title: "Laboratorio" };

const TABS = [
  { key: "borradores", label: "Borradores", status: "draft" },
  { key: "validados", label: "Validados", status: "final" },
  { key: "todos", label: "Todos", status: undefined },
] as const;
type Tab = (typeof TABS)[number]["key"];

const DELIVERY_ICON: Record<string, { icon: IconName; label: string }> = {
  print: { icon: "printer", label: "Impreso" },
  download: { icon: "download", label: "Descargado" },
  share: { icon: "share", label: "Compartido" },
  whatsapp: { icon: "chat", label: "Enviado por WhatsApp" },
};

// Laboratorio: the lab's result reports. Doctors and administrators prepare
// and validate them; everyone who sees the patient prints and sends them.
export default async function LabPage({ searchParams }: PageProps<"/dashboard/laboratorio">) {
  const viewer = await getViewer();
  const builds = viewer.permissions.labReports;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bioanálisis"
        title="Laboratorio"
        description={
          builds
            ? "Prepara los informes de resultados, valídalos y entrégalos impresos o por WhatsApp."
            : "Los informes de resultados del laboratorio, listos para imprimir y enviar a los pacientes."
        }
        actions={
          builds && (
            <Link
              href="/dashboard/laboratorio/nuevo"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal"
            >
              <Icon name="plus" className="size-4" />
              Nuevo informe
            </Link>
          )
        }
      />

      <Suspense
        fallback={
          <Card>
            <CardHeader title={<Skeleton className="w-48" />} action={<span className="h-9 w-[244px] rounded-lg border border-line bg-white" />} />
            <RowsSkeleton rows={5} />
          </Card>
        }
      >
        <Reports searchParams={searchParams} viewer={viewer} />
      </Suspense>

      {viewer.role === "admin" && (
        <Suspense
          fallback={
            <Card>
              <CardHeader title="Firma de los informes" />
              <FormSkeleton fields={4} className="px-5 py-4 sm:grid-cols-2" />
            </Card>
          }
        >
          <SignerSettings />
        </Suspense>
      )}
    </div>
  );
}

async function Reports({ searchParams, viewer }: { searchParams: PageProps<"/dashboard/laboratorio">["searchParams"]; viewer: Viewer }) {
  const params = await searchParams;
  const query = param(params.q).trim().slice(0, 80);
  const page = pageNumber(params.pagina);
  const patientId = isUuid(param(params.paciente)) ? param(params.paciente) : undefined;
  const requested = param(params.estado) as Tab;
  const explicitTab = TABS.find((t) => t.key === requested);
  const listOptions = { patientId, search: query, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE };
  const [counts, requestedReports] = await Promise.all([
    countLabReports(),
    explicitTab ? listLabReports({ ...listOptions, status: explicitTab.status }) : Promise.resolve(null),
  ]);
  const tab: Tab = explicitTab?.key ?? (viewer.permissions.labReports && counts.drafts ? "borradores" : "validados");
  const rows = requestedReports ?? await listLabReports({ ...listOptions, status: TABS.find((t) => t.key === tab)?.status });
  const reports = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  const tabCount = { borradores: counts.drafts, validados: counts.finals, todos: counts.drafts + counts.finals };
  const filters = { estado: tab, q: query, paciente: patientId ?? "" };
  const href = (key: Tab) => pageHref("/dashboard/laboratorio", { ...filters, estado: key }, 1);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-3 sm:px-5">
        <nav aria-label="Estado" className="-mb-px flex gap-5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium ${tab === t.key ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"}`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === t.key ? "bg-navy text-white" : "bg-sand text-ink"}`}>{tabCount[t.key]}</span>
            </Link>
          ))}
        </nav>
        <div className="mb-3 w-full sm:w-auto">
          <SearchForm path="/dashboard/laboratorio" query={query} filters={{ estado: tab, paciente: patientId ?? "" }} placeholder="Paciente o cédula" label="Buscar por paciente" />
        </div>
      </div>

      {reports.length ? (
        <>
        {/* Phones and upright tablets: one row per report, the whole row opens it. */}
        <ul className="divide-y divide-line lg:hidden">
          {reports.map((r) => {
            const shown = r.summary.slice(0, 3);
            return (
              <li key={r.id}>
                <Link href={`/dashboard/laboratorio/${r.id}`} className="flex items-start gap-3.5 px-4 py-3.5 active:bg-cream sm:px-5">
                  <Avatar name={r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "P"} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{r.patient ? `${r.patient.last_name}, ${r.patient.first_name}` : "Paciente"}</span>
                      {r.status === "final" ? <Badge tone="teal">Validado</Badge> : <Badge tone="outline">Borrador</Badge>}
                    </span>
                    <span className="mt-1 block truncate text-[13px] text-muted">
                      Nº {reportNumber(r.number)} · {formatDay(localDay(r.sampledAt), "short")}
                      {r.revision > 1 && ` · rev. ${r.revision}`}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1">
                      {shown.length ? (
                        shown.map((title) => (
                          <span key={title} className="rounded-md bg-sand px-2 py-0.5 text-[12px] text-ink">
                            {title}
                          </span>
                        ))
                      ) : (
                        <span className="text-[13px] text-stone">Sin exámenes</span>
                      )}
                      {r.summary.length > shown.length && <span className="px-1 text-[12px] text-muted">+{r.summary.length - shown.length}</span>}
                      {r.delivered.length > 0 && (
                        <span className="ml-auto flex gap-1 text-teal">
                          {r.delivered.map((channel) => (
                            <span key={channel} className="grid size-6 place-items-center rounded-md bg-mint/20">
                              <Icon name={DELIVERY_ICON[channel]?.icon ?? "send"} className="size-3.5" />
                              <span className="sr-only">{DELIVERY_ICON[channel]?.label}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Nº</th>
                <th className={th}>Paciente</th>
                <th className={th}>Exámenes</th>
                <th className={th}>Muestra</th>
                <th className={th}>Estado</th>
                <th className={th}>Entregado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.map((r) => {
                const name = r.patient ? `${r.patient.last_name}, ${r.patient.first_name}` : "Paciente";
                const shown = r.summary.slice(0, 3);
                return (
                  <tr key={r.id} className="group hover:bg-cream">
                    <td className={`${td} font-mono text-[13px] text-muted`}>
                      <Link href={`/dashboard/laboratorio/${r.id}`} className="hover:text-navy">
                        {reportNumber(r.number)}
                      </Link>
                    </td>
                    <td className={td}>
                      <Link href={`/dashboard/laboratorio/${r.id}`} className="flex items-center gap-3 font-medium group-hover:text-teal">
                        <Avatar name={r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "P"} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate">{name}</span>
                          {r.patient && <span className="block text-[12px] font-normal text-muted">{documentOf(r.patient) ?? "Sin cédula"}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {shown.length ? (
                          shown.map((title) => (
                            <span key={title} className="rounded-md bg-sand px-2 py-0.5 text-[12px] text-ink">
                              {title}
                            </span>
                          ))
                        ) : (
                          <span className="text-[13px] text-stone">Sin exámenes</span>
                        )}
                        {r.summary.length > shown.length && <span className="px-1 text-[12px] text-muted">+{r.summary.length - shown.length}</span>}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{formatDay(localDay(r.sampledAt), "short")}</td>
                    <td className={td}>
                      {r.status === "final" ? (
                        <Badge tone="teal">Validado{r.revision > 1 ? ` · rev. ${r.revision}` : ""}</Badge>
                      ) : (
                        <Badge tone="outline">Borrador{r.revision > 1 ? ` · rev. ${r.revision}` : ""}</Badge>
                      )}
                    </td>
                    <td className={td}>
                      <span className="flex gap-1.5 text-teal">
                        {r.delivered.length
                          ? r.delivered.map((channel) => (
                              <span key={channel} title={DELIVERY_ICON[channel]?.label} className="grid size-7 place-items-center rounded-lg bg-mint/20">
                                <Icon name={DELIVERY_ICON[channel]?.icon ?? "send"} className="size-4" />
                                <span className="sr-only">{DELIVERY_ICON[channel]?.label}</span>
                              </span>
                            ))
                          : <span className="text-[13px] text-stone">—</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <EmptyState
          icon="flask"
          title={query ? "Ningún informe coincide con esa búsqueda" : tab === "borradores" ? "No hay borradores pendientes" : "Todavía no hay informes"}
          action={
            viewer.permissions.labReports && !query ? (
              <Link href="/dashboard/laboratorio/nuevo" className="text-sm font-medium text-teal hover:text-navy">
                Preparar un informe
              </Link>
            ) : undefined
          }
        >
          {query
            ? "Busca por nombre, apellido o número de cédula."
            : viewer.permissions.labReports
              ? "Elige al paciente, agrega sus exámenes y carga los resultados: el informe se guarda solo mientras escribes."
              : "Aquí aparecerán los informes cuando el laboratorio los prepare."}
        </EmptyState>
      )}
      <Pagination path="/dashboard/laboratorio" filters={filters} page={page} hasNext={hasNext} />
    </Card>
  );
}

/** A link to the stored signature image for the preview, valid for an hour. */
async function signatureLink(path: string | null | undefined) {
  const admin = path ? createAdminClient() : null;
  if (!path || !admin) return null;
  const { data } = await admin.storage.from(SIGNATURE_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function SignerSettings() {
  const settings = await getLabSettings();
  const signature = await signatureLink(settings?.signer_signature);
  return (
    <Card>
      <CardHeader title="Firma de los informes" hint="El bioanalista cuyo nombre y registros firman cada informe validado. Los informes ya validados no cambian." />
      <ActionForm action={saveLabSettings} className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre, como se imprime">
          <input name="signer_name" required maxLength={120} defaultValue={settings?.signer_name ?? ""} className={inputClass} />
        </Field>
        <Field label="Título">
          <input name="signer_title" required maxLength={80} defaultValue={settings?.signer_title ?? "Licenciado en Bioanálisis"} className={inputClass} />
        </Field>
        <Field label="Cédula" hint="Ej.: C.I. 11.171.135">
          <input name="signer_id_number" maxLength={40} defaultValue={settings?.signer_id_number ?? ""} className={inputClass} />
        </Field>
        <Field label="Registro del Ministerio" hint="Ej.: M.S.A.S. 9577 o M.P.P.S. …">
          <input name="signer_registry" maxLength={80} defaultValue={settings?.signer_registry ?? ""} className={inputClass} />
        </Field>
        <Field label="Colegio de Bioanalistas" hint="Ej.: Colegio 05-451">
          <input name="signer_college" maxLength={80} defaultValue={settings?.signer_college ?? ""} className={inputClass} />
        </Field>
        <div className="flex items-end">
          <SubmitButton icon="check" pendingLabel="Guardando…">
            Guardar datos
          </SubmitButton>
        </div>
      </ActionForm>
      <div className="border-t border-line">
        <p className="px-5 pt-4 text-[13px] font-medium text-ink">Firma manuscrita para el PDF</p>
        <SignatureForm src={signature} signer={settings?.signer_name ?? "Bioanalista"} />
      </div>
    </Card>
  );
}
