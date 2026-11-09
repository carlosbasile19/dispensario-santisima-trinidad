import type { Metadata } from "next";

import { Card, CardHeader, EmptyState, NoAccess, PageHeader } from "@/components/crm/ui";
import { getViewer } from "@/lib/crm/viewer";
import { ADDRESS_SHORT, HOURS, LEGAL_NAME, PHONE_DISPLAY, RIF } from "@/lib/site-config";

export const metadata: Metadata = { title: "Gestión" };

// Gestión (administrators only): how the centre is set up. The legal details
// come from the site config; services, prices and rooms are not loaded yet.
export default async function ManagementPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return <NoAccess role={viewer.role} section="Gestión" />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Gestión del centro"
        description="Servicios, precios, consultorios y horarios del centro."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Servicios y consultorios" />
          <EmptyState icon="building" title="Todavía no hay servicios cargados">
            Los servicios, precios, consultorios y horarios se configurarán en una próxima etapa de la plataforma.
          </EmptyState>
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
