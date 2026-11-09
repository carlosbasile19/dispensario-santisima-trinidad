import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardHeader, EmptyState, PageHeader } from "@/components/crm/ui";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Inicio" };

const INTRO = {
  doctor: "Aquí verás tu agenda del día y los pacientes que te esperan.",
  director: "Aquí verás cómo va el día en todos los consultorios del centro.",
  staff: "Aquí verás las llegadas, confirmaciones y cobros del día.",
  admin: "Aquí verás el resumen de la operación y los ingresos del día.",
} as const;

// Inicio: the day at a glance. The agenda has no data model yet, so the page
// greets the member and says what it will show.
export default async function DashboardHome() {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`Buen día, ${viewer.firstName}`} description={INTRO[viewer.role]} />

      <Card>
        <CardHeader title={own ? "Mi agenda de hoy" : "Agenda de hoy"} />
        <EmptyState
          icon="calendar"
          title="Todavía no hay citas"
          action={
            viewer.permissions.members ? (
              <Link href="/dashboard/miembros" className="text-sm font-medium text-teal hover:text-navy">
                Mientras tanto, crea las cuentas del equipo en Miembros
              </Link>
            ) : undefined
          }
        >
          La agenda se habilitará en una próxima etapa de la plataforma.
        </EmptyState>
      </Card>
    </div>
  );
}
