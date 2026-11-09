import type { Metadata } from "next";

import { Card, EmptyState, PageHeader } from "@/components/crm/ui";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Agenda" };

// Agenda: a doctor will see only their own appointments; the director, staff
// and admins every consulting room. No appointments exist yet.
export default async function AgendaPage() {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={own ? "Mi agenda" : "Agenda"}
        description={own ? "Tus citas con los pacientes." : "Las citas de todos los consultorios."}
      />

      <Card>
        <EmptyState icon="calendar" title="Todavía no hay citas">
          La agenda se habilitará en una próxima etapa de la plataforma.
        </EmptyState>
      </Card>
    </div>
  );
}
