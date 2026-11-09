import type { Metadata } from "next";

import { Card, EmptyState, PageHeader } from "@/components/crm/ui";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Pacientes" };

// Patient list: doctors will see their own patients, every other profile all
// of them. No patients are registered yet.
export default async function PatientsPage() {
  const viewer = await getViewer();
  const own = viewer.permissions.schedule === "own";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={own ? "Mis pacientes" : "Pacientes"}
        description={own ? "Los pacientes a tu cargo." : "Los pacientes registrados en el centro."}
      />

      <Card>
        <EmptyState icon="patients" title="Todavía no hay pacientes">
          El registro de pacientes se habilitará en una próxima etapa de la plataforma.
        </EmptyState>
      </Card>
    </div>
  );
}
