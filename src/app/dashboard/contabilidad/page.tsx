import type { Metadata } from "next";

import { Badge, Button, Card, CardHeader, NoAccess, PageHeader, Stat, td, th, usd } from "@/components/crm/ui";
import { APPOINTMENTS, LAST_WEEK_INCOME, MOVEMENTS, WEEK_INCOME, patientById } from "@/lib/crm/sample-data";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Contabilidad" };

// Contabilidad (administrators only): what came in today, how, and what is
// still owed. Amounts in USD, the centre's reference currency.
export default async function AccountingPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return <NoAccess role={viewer.role} section="Contabilidad" />;

  const paid = MOVEMENTS.filter((m) => m.status === "cobrado");
  const collected = paid.reduce((sum, m) => sum + m.amount, 0);
  const pending = APPOINTMENTS.filter((a) => a.payment === "por_cobrar" && a.status !== "no_asistio").reduce(
    (sum, a) => sum + a.price,
    0,
  );
  const lastWeek = LAST_WEEK_INCOME.reduce((sum, d) => sum + d.amount, 0);

  const byMethod = Object.entries(
    paid.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.method]: (acc[m.method] ?? 0) + m.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const peak = Math.max(...LAST_WEEK_INCOME.map((d) => d.amount));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Contabilidad"
        description="Ingresos, métodos de pago y cuentas por cobrar del centro."
        actions={
          <>
            <Button variant="secondary">Exportar</Button>
            <Button icon="plus">Registrar cobro</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Ingresos de hoy" value={usd(collected)} hint={`${paid.length} cobros`} />
        <Stat label="Por cobrar" value={usd(pending)} hint="Citas de hoy sin pagar" />
        <Stat label="Ticket promedio" value={usd(collected / paid.length)} hint="Por cobro" />
        <Stat label="Semana pasada" value={usd(lastWeek)} hint="Lunes a viernes" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Ingresos por día" hint="Esta semana frente a la semana pasada" />
          <div className="px-5 pt-6 pb-5">
            <div className="grid h-[200px] grid-cols-5 items-end gap-4 border-b border-line">
              {LAST_WEEK_INCOME.map((last, i) => {
                const current = WEEK_INCOME[i];
                return (
                  <div key={last.day} className="flex h-full items-end justify-center gap-1.5">
                    <div
                      title={`Semana pasada: ${usd(last.amount)}`}
                      className="w-full max-w-9 rounded-t-[4px] bg-mist/60"
                      style={{ height: `${(last.amount / peak) * 100}%` }}
                    />
                    <div
                      title={`Esta semana: ${usd(current.amount)}`}
                      className="w-full max-w-9 rounded-t-[4px] bg-teal"
                      style={{ height: `${(current.amount / peak) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-5 gap-4 text-center text-[13px] text-muted">
              {WEEK_INCOME.map((d) => (
                <span key={d.day} className={d.today ? "font-medium text-navy" : ""}>
                  {d.day}
                </span>
              ))}
            </div>
            <ul className="mt-5 flex gap-5 text-[13px] text-muted">
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-[4px] bg-teal" /> Esta semana
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-[4px] bg-mist/60" /> Semana pasada
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Por método de pago" hint="Hoy" />
          <ul className="flex flex-col gap-4 px-5 py-5">
            {byMethod.map(([method, amount]) => (
              <li key={method}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{method}</span>
                  <span className="tabular-nums">{usd(amount)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-sand">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${(amount / collected) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <CardHeader title="Movimientos de hoy" hint={`${MOVEMENTS.length} registros`} />
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Recibo</th>
              <th className={th}>Hora</th>
              <th className={th}>Paciente</th>
              <th className={th}>Concepto</th>
              <th className={th}>Método</th>
              <th className={th}>Estado</th>
              <th className={`${th} text-right`}>Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MOVEMENTS.map((m) => (
              <tr key={m.id}>
                <td className={`${td} font-mono text-[13px] text-muted`}>{m.id}</td>
                <td className={`${td} text-ink tabular-nums whitespace-nowrap`}>{m.time}</td>
                <td className={`${td} font-medium whitespace-nowrap`}>{patientById(m.patientId)?.name}</td>
                <td className={`${td} text-ink`}>{m.concept}</td>
                <td className={`${td} text-ink whitespace-nowrap`}>{m.method}</td>
                <td className={td}>
                  <Badge tone={m.status === "cobrado" ? "teal" : "coral"}>
                    {m.status === "cobrado" ? "Cobrado" : "Por cobrar"}
                  </Badge>
                </td>
                <td className={`${td} text-right tabular-nums`}>{usd(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
