import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { Avatar, Badge, Button, Card, PageHeader, SearchField, td, th } from "@/components/crm/ui";
import { PATIENTS, doctorById } from "@/lib/crm/sample-data";
import { canReadClinical, getViewer, inScope, showCedula } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Pacientes" };

// Patient list. Doctors see their own patients. Staff see every patient but
// with the identity document masked and no clinical column.
export default async function PatientsPage() {
  const viewer = await getViewer();
  const patients = PATIENTS.filter((p) => inScope(viewer, p.doctorId));
  const own = viewer.permissions.schedule === "own";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={own ? "Mis pacientes" : "Pacientes"}
        description={`${patients.length} pacientes${own ? " a tu cargo" : " registrados"}`}
        actions={
          <>
            <SearchField placeholder="Buscar por nombre o cédula" />
            {viewer.permissions.manageSchedule && <Button icon="plus">Nuevo paciente</Button>}
          </>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Paciente</th>
              <th className={th}>Edad</th>
              <th className={th}>Teléfono</th>
              {!own && <th className={th}>Médico tratante</th>}
              <th className={th}>Condiciones</th>
              <th className={th}>Próxima cita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {patients.map((p) => (
              <tr key={p.id} className="relative hover:bg-cream">
                <td className={td}>
                  <Link href={`/dashboard/pacientes/${p.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                    <Avatar name={p.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block font-mono text-[12px] text-muted">{showCedula(viewer, p.cedula)}</span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} text-ink tabular-nums`}>{p.age}</td>
                <td className={`${td} text-ink tabular-nums whitespace-nowrap`}>{p.phone}</td>
                {!own && <td className={`${td} text-ink whitespace-nowrap`}>{doctorById(p.doctorId).name}</td>}
                <td className={td}>
                  {canReadClinical(viewer, p) ? (
                    <span className="flex flex-wrap gap-1.5">
                      {p.conditions.length ? (
                        p.conditions.map((c) => <Badge key={c}>{c}</Badge>)
                      ) : (
                        <span className="text-stone">Sin registrar</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[13px] text-stone">
                      <Icon name="lock" className="size-3.5" /> Protegido
                    </span>
                  )}
                </td>
                <td className={`${td} text-ink whitespace-nowrap`}>{p.nextVisit ?? "Sin cita"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
