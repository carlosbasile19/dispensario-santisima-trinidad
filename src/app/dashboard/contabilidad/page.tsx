import type { Metadata } from "next";

import { Card, EmptyState, NoAccess, PageHeader } from "@/components/crm/ui";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Contabilidad" };

// Contabilidad (administrators only): what came in, how, and what is still
// owed. No payments are recorded yet.
export default async function AccountingPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Ingresos, métodos de pago y cuentas por cobrar del centro."
      />

      <Card>
        <EmptyState icon="ledger" title="Todavía no hay cobros">
          El registro de cobros se habilitará en una próxima etapa de la plataforma.
        </EmptyState>
      </Card>
    </div>
  );
}
