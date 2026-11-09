import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { Badge, Card, CardHeader, EmptyState, NoAccess, PageHeader, RowsSkeleton, Skeleton } from "@/components/crm/ui";
import { AREA_LABEL, SERVICE_AREAS } from "@/lib/crm/clinic";
import { getServices } from "@/lib/crm/data";
import { centsToInput, toCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { saveService } from "../actions";
import { AccountingTabs } from "../tabs";

export const metadata: Metadata = { title: "Tarifas" };

// Tarifas (administrators only): the centre's services and their price in
// dollars. Booking a service copies its price; the front desk may change it
// for one visit. A new price applies from the next booking on. The form to
// add a service is static; the list streams in.
export default async function PriceListPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Los precios del centro en dólares. Al agendar se usa este precio; recepción puede ajustarlo en una cita."
      />
      <AccountingTabs active="tarifas" />

      <Card>
        <CardHeader title="Nuevo servicio" />
        <ActionForm action={saveService} resetOnSuccess className="flex flex-col gap-3 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr_160px_auto] sm:items-end">
            <Field label="Área">
              <select name="area" defaultValue="medicina" className={inputClass}>
                {SERVICE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {AREA_LABEL[area]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Servicio">
              <input name="name" required minLength={2} maxLength={120} placeholder="Consulta de medicina general" className={inputClass} />
            </Field>
            <Field label="Precio (USD)">
              <input name="price" type="number" inputMode="decimal" step="0.01" min="0" required className={`${inputClass} font-mono`} />
            </Field>
            <SubmitButton icon="plus" pendingLabel="Añadiendo…">
              Añadir
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Suspense
        fallback={
          <Card>
            <CardHeader title={<Skeleton className="w-28" />} hint={<Skeleton className="w-40" />} />
            <RowsSkeleton rows={4} dense />
          </Card>
        }
      >
        <PriceList />
      </Suspense>
    </div>
  );
}

/** One card per area, each service with its price and whether it is offered. */
async function PriceList() {
  const services = await getServices();

  if (services.length === 0) {
    return (
      <Card>
        <EmptyState icon="tag" title="El tarifario está vacío">
          Añade los servicios de medicina, odontología y bioanálisis con su precio. Sin servicios no se pueden agendar
          citas.
        </EmptyState>
      </Card>
    );
  }
  return SERVICE_AREAS.map((area) => {
    const list = services.filter((s) => s.area === area);
    if (!list.length) return null;
    const active = list.filter((s) => s.active).length;
    return (
      <Card key={area}>
        <CardHeader
          title={AREA_LABEL[area]}
          hint={`${active} ${active === 1 ? "activo" : "activos"} de ${list.length} ${list.length === 1 ? "servicio" : "servicios"}`}
        />
        <ul className="divide-y divide-line">
          {list.map((s) => (
            <li key={s.id}>
              <ActionForm action={saveService} className="flex flex-col gap-2 px-5 py-3">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="area" value={s.area} />
                <div className="grid gap-3 sm:grid-cols-[1fr_150px_180px_auto] sm:items-center">
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={s.name}
                    aria-label="Nombre del servicio"
                    className={`${inputClass} ${s.active ? "" : "text-stone"}`}
                  />
                  <label className="flex items-center gap-2 text-sm text-muted">
                    $
                    <input
                      name="price"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={centsToInput(toCents(s.price_usd))}
                      aria-label={`Precio de ${s.name}`}
                      className={`${inputClass} font-mono`}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input type="checkbox" name="active" defaultChecked={s.active} className="size-4 accent-teal" />
                    Se ofrece
                    {!s.active && <Badge tone="outline">Inactivo</Badge>}
                  </label>
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
                    Guardar
                  </SubmitButton>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    );
  });
}
