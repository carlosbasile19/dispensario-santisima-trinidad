import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardHeader, EmptyState, NoAccess, PageHeader } from "@/components/crm/ui";
import { AREA_LABEL, SERVICE_AREAS } from "@/lib/crm/clinic";
import { getServices } from "@/lib/crm/data";
import { getViewer } from "@/lib/crm/viewer";
import { ADDRESS_SHORT, HOURS, LEGAL_NAME, PHONE_DISPLAY, RIF } from "@/lib/site-config";

export const metadata: Metadata = { title: "Gestión" };

// Gestión (administrators only): how the centre is set up. The legal details
// come from the site config; services and prices live in Contabilidad.
export default async function ManagementPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return <NoAccess role={viewer.role} section="Gestión" />;
  const services = await getServices();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Gestión del centro"
        description="Los datos del centro y sus servicios."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Servicios"
            hint="Sus precios se administran en Contabilidad"
            action={
              viewer.permissions.accounting && (
                <Link href="/dashboard/contabilidad/tarifas" className="text-sm font-medium text-teal hover:text-navy">
                  Ir a Tarifas
                </Link>
              )
            }
          />
          {services.length ? (
            <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-3">
              {SERVICE_AREAS.map((area) => {
                const list = services.filter((s) => s.area === area && s.active);
                return (
                  <div key={area}>
                    <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">{AREA_LABEL[area]}</dt>
                    <dd className="mt-1">
                      {list.length} {list.length === 1 ? "servicio activo" : "servicios activos"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <EmptyState icon="building" title="Todavía no hay servicios cargados">
              Carga los servicios y sus precios en Contabilidad, en la pestaña Tarifas.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader title="Datos del centro" />
          <dl className="grid gap-4 px-5 py-4 text-sm">
            {[
              ["Razón social", LEGAL_NAME],
              ["RIF", RIF],
              ["Dirección", ADDRESS_SHORT],
              ["Teléfono", PHONE_DISPLAY],
              ["Horario", HOURS],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] tracking-[0.04em] text-stone uppercase">{label}</dt>
                <dd className="mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
