import type { Metadata } from "next";

import { Avatar, Badge, Button, Card, CardHeader, NoAccess, PageHeader, td, th, usd } from "@/components/crm/ui";
import { DOCTORS, SERVICES } from "@/lib/crm/sample-data";
import { getViewer } from "@/lib/crm/viewer";
import { ADDRESS_SHORT, HOURS, LEGAL_NAME, PHONE_DISPLAY, RIF } from "@/lib/site-config";

export const metadata: Metadata = { title: "Gestión" };

// Gestión (administrators only): how the centre is set up. Services and
// prices, consulting rooms and hours, and the centre's legal details.
export default async function ManagementPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.management) return <NoAccess role={viewer.role} section="Gestión" />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Gestión del centro"
        description="Servicios, precios, consultorios y horarios. Lo que cambies aquí es lo que ve recepción al agendar."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-x-auto">
          <CardHeader
            title="Servicios y precios"
            hint={`${SERVICES.length} servicios activos`}
            action={<Button variant="secondary" icon="plus">Nuevo servicio</Button>}
          />
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Servicio</th>
                <th className={th}>Área</th>
                <th className={th}>Duración</th>
                <th className={`${th} text-right`}>Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SERVICES.map((s) => (
                <tr key={s.name}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={td}>
                    <Badge>{s.area}</Badge>
                  </td>
                  <td className={`${td} text-ink tabular-nums`}>{s.minutes} min</td>
                  <td className={`${td} text-right tabular-nums`}>{usd(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Consultorios y horarios" />
            <ul className="divide-y divide-line">
              {DOCTORS.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-5 py-3.5">
                  <Avatar name={d.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-[13px] text-muted">
                      {d.room} · {d.specialty}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink">{d.hours}</p>
                  </div>
                </li>
              ))}
            </ul>
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
    </div>
  );
}
