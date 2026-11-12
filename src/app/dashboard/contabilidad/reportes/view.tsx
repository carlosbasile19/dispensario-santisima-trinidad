import Link from "next/link";

import { Icon } from "@/components/crm/icons";
import { Card, CardHeader, td, th } from "@/components/crm/ui";
import { AREA_ICON, AREA_LABEL, PAYMENT_METHODS, SERVICE_AREAS } from "@/lib/crm/clinic";
import { formatBs, formatUsd } from "@/lib/crm/money";
import {
  AGE_BANDS,
  WEEKDAYS,
  formatCount,
  formatPercent,
  slotName,
  slotTick,
  slotsOf,
  type Period,
  type Report,
} from "@/lib/crm/reports";
import { ColumnChart, TrendExplorer, type Metric } from "./charts";
import { BarList, NoData, SegmentedBar, ShareRows } from "./figures";
import { CHART } from "./palette";

// The cards of a report, drawn from accounting_report's answer for the
// period and for the one before it. No data access here: page.tsx reads.

const control =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy";

/** Every card of a report, from the period's figures and the previous period's. */
export function ReportView({
  report,
  previous,
  period,
  previousPeriod,
  today,
  toDate,
}: {
  report: Report;
  previous: Report;
  period: Period;
  previousPeriod: Period;
  today: string;
  /** While the period is under way: it and the previous one up to the same day, for fair deltas. */
  toDate?: { current: Report; previous: Report; label: string };
}) {
  const slots = slotsOf(period);
  const previousSlots = slotsOf(previousPeriod);
  const ticks = slots.map((s) => slotTick(s, period.kind));
  const names = slots.map((s) => slotName(s, period.kind));
  const previousNames = previousSlots.map((s) => slotName(s, period.kind));
  // Money after today can only be zero, so its line stops at today's slot.
  const happened = slots.filter((s) => s <= today).length;

  const t = report.totals;
  const p = previous.totals;
  const net = (r: Report) => r.totals.collected_usd - r.totals.expenses_usd;
  const [now, before] = toDate ? [toDate.current, toDate.previous] : [report, previous];
  const compare = (pick: (r: Report) => number) => ({ current: pick(now), previous: pick(before) });
  const versus = toDate ? toDate.label : period.versus;
  const series = (r: Report, pick: (s: Report["series"][number]) => number) => r.series.map(pick);
  const metrics: Metric[] = [
    {
      key: "patients",
      compare: compare((r) => r.totals.patients),
      label: "Pacientes",
      money: false,
      total: t.patients,
      previousTotal: p.patients,
      upIsGood: true,
      hint: `${formatCount(t.new_patients)} nuevos · ${formatCount(t.patients - t.new_patients)} recurrentes`,
      current: series(report, (s) => s.patients),
      previous: series(previous, (s) => s.patients),
      cutoff: slots.length,
    },
    {
      key: "new",
      compare: compare((r) => r.totals.new_patients),
      label: "Pacientes nuevos",
      money: false,
      total: t.new_patients,
      previousTotal: p.new_patients,
      upIsGood: true,
      hint: t.patients ? `${formatPercent(t.new_patients / t.patients)} de los pacientes` : "Primera visita al centro",
      current: series(report, (s) => s.new_patients),
      previous: series(previous, (s) => s.new_patients),
      cutoff: slots.length,
    },
    {
      key: "visits",
      compare: compare((r) => r.totals.visits),
      label: "Citas",
      money: false,
      total: t.visits,
      previousTotal: p.visits,
      upIsGood: true,
      hint: t.upcoming ? `${formatCount(t.attended)} atendidas · ${formatCount(t.upcoming)} por venir` : `${formatCount(t.attended)} atendidas`,
      current: series(report, (s) => s.visits),
      previous: series(previous, (s) => s.visits),
      cutoff: slots.length,
    },
    {
      key: "income",
      compare: compare((r) => r.totals.collected_usd),
      label: "Ingresos",
      money: true,
      total: t.collected_usd,
      previousTotal: p.collected_usd,
      upIsGood: true,
      hint: `Facturado ${formatUsd(t.billed_usd)}`,
      current: series(report, (s) => s.collected_usd),
      previous: series(previous, (s) => s.collected_usd),
      cutoff: happened,
    },
    {
      key: "expenses",
      compare: compare((r) => r.totals.expenses_usd),
      label: "Gastos",
      money: true,
      total: t.expenses_usd,
      previousTotal: p.expenses_usd,
      upIsGood: false,
      hint: report.suppliers.length ? `${report.suppliers.length} ${report.suppliers.length === 1 ? "proveedor" : "proveedores"}` : "Sin gastos cargados",
      current: series(report, (s) => s.expenses_usd),
      previous: series(previous, (s) => s.expenses_usd),
      cutoff: happened,
    },
    {
      key: "net",
      compare: compare(net),
      label: "Resultado",
      money: true,
      total: net(report),
      previousTotal: net(previous),
      upIsGood: true,
      absoluteDelta: true,
      hint: t.collected_usd > 0 ? `Margen ${formatPercent(net(report) / t.collected_usd)}` : "Ingresos menos gastos",
      current: series(report, (s) => s.collected_usd - s.expenses_usd),
      previous: series(previous, (s) => s.collected_usd - s.expenses_usd),
      cutoff: happened,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <TrendExplorer
          metrics={metrics}
          ticks={ticks}
          names={names}
          previousNames={previousNames}
          currentLabel={period.label}
          previousLabel={previousPeriod.label}
          versus={versus}
        />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ingresos y gastos" hint="Lo cobrado y lo pagado a proveedores, en dólares a tasa BCV" />
          <div className="px-3 py-4 sm:px-5">
            <ColumnChart
              label="Ingresos y gastos por período"
              money
              ticks={ticks}
              names={names}
              series={[
                { name: "Ingresos", color: CHART.income, values: series(report, (s) => s.collected_usd) },
                { name: "Gastos", color: CHART.expense, values: series(report, (s) => s.expenses_usd) },
              ]}
            />
          </div>
        </Card>
        <Balance report={report} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Attendance report={report} />
        <Card>
          <CardHeader title="Por área" hint="Citas, pacientes y lo facturado en cada servicio del centro" />
          <div className="px-4 py-5 sm:px-5">
            {t.visits ? (
              <BarList
                rows={SERVICE_AREAS.map((area) => {
                  const row = report.areas.find((a) => a.area === area);
                  return {
                    key: area,
                    label: (
                      <span className="flex items-center gap-2">
                        <Icon name={AREA_ICON[area]} className="size-4 text-teal" />
                        {AREA_LABEL[area]}
                      </span>
                    ),
                    value: row?.billed_usd ?? 0,
                    text: formatUsd(row?.billed_usd ?? 0),
                    sub: `${formatCount(row?.visits ?? 0)} ${row?.visits === 1 ? "cita" : "citas"} · ${formatCount(row?.patients ?? 0)} ${row?.patients === 1 ? "paciente" : "pacientes"}`,
                  };
                })}
              />
            ) : (
              <NoData>No hubo citas en este período.</NoData>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Patients report={report} />
        <Card>
          <CardHeader title="Días con más citas" hint="Citas del período según el día de la semana" />
          <div className="px-3 py-4 sm:px-5">
            {t.visits ? (
              <ColumnChart
                label="Citas por día de la semana"
                money={false}
                ticks={[...WEEKDAYS]}
                names={["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]}
                series={[{ name: "Citas", color: CHART.current, values: report.weekdays }]}
              />
            ) : (
              <NoData>No hubo citas en este período.</NoData>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <CardHeader title="Servicios más solicitados" hint="Los 8 servicios que más se prestaron" />
          {report.services.length ? (
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Servicio</th>
                  <th className={`${th} text-right`}>Veces</th>
                  <th className={`${th} text-right`}>Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.services.map((s) => (
                  <tr key={`${s.area}-${s.service}`}>
                    <td className={td}>
                      <p className="font-medium">{s.service}</p>
                      <p className="text-[12px] text-muted">{AREA_LABEL[s.area]}</p>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatCount(s.count)}</td>
                    <td className={`${td} text-right font-mono`}>{formatUsd(s.billed_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <NoData>No se prestaron servicios en este período.</NoData>
          )}
        </Card>
        <Card className="overflow-x-auto">
          <CardHeader title="Profesionales" hint="Citas, pacientes y lo facturado por cada médico" />
          {report.professionals.length ? (
            <table className="w-full min-w-[460px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Profesional</th>
                  <th className={`${th} text-right`}>Citas</th>
                  <th className={`${th} text-right`}>Pacientes</th>
                  <th className={`${th} text-right`}>Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.professionals.map((pr) => (
                  <tr key={pr.name}>
                    <td className={`${td} font-medium`}>{pr.name}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatCount(pr.visits)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatCount(pr.patients)}</td>
                    <td className={`${td} text-right font-mono`}>{formatUsd(pr.billed_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <NoData>No hubo citas en este período.</NoData>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Formas de pago" hint="Cobros del período, en dólares a tasa BCV" />
          <div className="px-4 py-5 sm:px-5">
            {report.methods.length ? (
              <BarList
                rows={report.methods.map((m) => {
                  const info = PAYMENT_METHODS[m.method];
                  const count = `${formatCount(m.payments)} ${m.payments === 1 ? "cobro" : "cobros"}`;
                  return {
                    key: m.method,
                    label: (
                      <span className="flex items-center gap-2">
                        <Icon name={info.icon} className="size-4 text-teal" />
                        {info.label}
                      </span>
                    ),
                    value: m.amount_usd,
                    text: formatUsd(m.amount_usd),
                    sub: info.currency === "VES" ? `${formatBs(m.amount_bs)} · ${count}` : count,
                  };
                })}
              />
            ) : (
              <NoData>No hubo cobros en este período.</NoData>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Gastos por proveedor" hint="A quién se le pagó más en el período" />
          <div className="px-4 py-5 sm:px-5">
            {report.suppliers.length ? (
              <BarList
                color={CHART.expense}
                rows={report.suppliers.map((s) => ({
                  key: s.name,
                  label: s.name,
                  value: s.amount_usd,
                  text: formatUsd(s.amount_usd),
                  sub: `${formatCount(s.expenses)} ${s.expenses === 1 ? "pago" : "pagos"}`,
                }))}
              />
            ) : (
              <NoData>
                No hay gastos cargados en este período.{" "}
                <Link href="/dashboard/contabilidad/gastos" className="font-medium text-teal hover:text-navy">
                  Ir a Gastos
                </Link>
              </NoData>
            )}
          </div>
        </Card>
      </div>

      <Detail report={report} period={period} names={names} />
    </div>
  );
}

function Balance({ report }: { report: Report }) {
  const t = report.totals;
  const net = t.collected_usd - t.expenses_usd;
  const rows: { label: string; value: string; hint?: string; strong?: boolean }[] = [
    { label: "Cobrado en dólares", value: formatUsd(t.received_usd), hint: "Efectivo y Zelle" },
    { label: "Cobrado en bolívares", value: formatBs(t.received_bs), hint: "Pago móvil, punto, transferencia y efectivo" },
    { label: "Financiado con Cashea", value: formatUsd(t.financed_usd), hint: "Se cobra en cuotas" },
    { label: "Total cobrado", value: formatUsd(t.collected_usd), strong: true },
    { label: "Gastos", value: formatUsd(t.expenses_usd), hint: t.expenses_bs ? `${formatBs(t.expenses_bs)} a tasa BCV` : undefined },
    { label: "Resultado", value: formatUsd(net), strong: true },
  ];
  return (
    <Card>
      <CardHeader title="Balance del período" hint="Lo que entró y salió" />
      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 sm:px-5">
            <dt className={`text-sm ${row.strong ? "font-semibold text-navy" : "text-ink"}`}>
              {row.label}
              {row.hint && <span className="block text-[12px] font-normal text-stone">{row.hint}</span>}
            </dt>
            <dd className={`shrink-0 font-mono text-sm ${row.strong ? "font-semibold text-navy" : ""} ${row.label === "Resultado" && net < 0 ? "text-[#b03a36]" : ""}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between gap-4 rounded-b-xl border-t border-line bg-cream px-4 py-3 sm:px-5">
        <p className="text-sm text-ink">
          Por cobrar
          <span className="block text-[12px] text-stone">Saldo de las citas del período, hasta hoy</span>
        </p>
        <p className={`font-mono text-sm font-semibold ${t.owed_usd > 0 ? "text-[#b03a36]" : "text-navy"}`}>{formatUsd(t.owed_usd)}</p>
      </div>
    </Card>
  );
}

function Attendance({ report }: { report: Report }) {
  const t = report.totals;
  const booked = t.visits + t.cancelled + t.no_show;
  const settled = t.attended + t.no_show;
  return (
    <Card>
      <CardHeader title="Asistencia" hint="Qué pasó con las citas agendadas en el período" />
      {booked ? (
        <div className="px-4 py-5 sm:px-5">
          <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[12px] tracking-[0.04em] text-stone uppercase">Tasa de asistencia</p>
              <p className="mt-1 text-[32px] leading-none font-semibold text-navy">{settled ? formatPercent(t.attended / settled) : "—"}</p>
            </div>
            <p className="pb-0.5 text-[13px] text-muted">
              {settled ? `${formatCount(t.attended)} de ${formatCount(settled)} citas pasadas` : "Todavía no hay citas cerradas"}
              {t.visits > 0 && ` · ${formatPercent(t.online / t.visits)} reservadas en línea`}
            </p>
          </div>
          <ShareRows
            total={booked}
            rows={[
              { label: "Atendidas", value: t.attended },
              { label: "Sin cerrar", value: t.unmarked, hint: "ya pasaron y siguen agendadas" },
              { label: "Por venir", value: t.upcoming },
              { label: "Canceladas", value: t.cancelled },
              { label: "No asistió", value: t.no_show },
            ]}
          />
        </div>
      ) : (
        <NoData>No hubo citas agendadas en este período.</NoData>
      )}
    </Card>
  );
}

function Patients({ report }: { report: Report }) {
  const t = report.totals;
  const [women, men, unknownSex] = report.sex;
  const noBirthDate = report.ages[AGE_BANDS.length] ?? 0;
  return (
    <Card>
      <CardHeader title="Perfil de los pacientes" hint="Pacientes distintos que vinieron en el período" />
      {t.patients ? (
        <div className="flex flex-col gap-6 px-4 py-5 sm:px-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Nuevos y recurrentes</p>
            <SegmentedBar
              unit={["paciente", "pacientes"]}
              parts={[
                { label: "Nuevos", value: t.new_patients, color: CHART.current },
                { label: "Recurrentes", value: t.patients - t.new_patients, color: CHART.third },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Sexo</p>
            <SegmentedBar
              unit={["paciente", "pacientes"]}
              parts={[
                { label: "Mujeres", value: women, color: CHART.current },
                { label: "Hombres", value: men, color: CHART.third },
                ...(unknownSex ? [{ label: "Sin dato", value: unknownSex, color: CHART.muted }] : []),
              ]}
            />
          </div>
          <div>
            <p className="mb-1 text-[13px] font-medium text-ink">
              Edad
              {noBirthDate > 0 && (
                <span className="ml-1.5 text-[12px] font-normal text-stone">
                  {formatCount(noBirthDate)} sin fecha de nacimiento
                </span>
              )}
            </p>
            <ColumnChart
              label="Pacientes por grupo de edad"
              money={false}
              ticks={[...AGE_BANDS]}
              names={AGE_BANDS.map((band) => `${band} años`)}
              series={[{ name: "Pacientes", color: CHART.current, values: report.ages.slice(0, AGE_BANDS.length) }]}
            />
          </div>
        </div>
      ) : (
        <NoData>No vinieron pacientes en este período.</NoData>
      )}
    </Card>
  );
}

/** Every figure of the charts, slot by slot: the table view, and what the CSV holds. */
function Detail({ report, period, names }: { report: Report; period: Period; names: string[] }) {
  const t = report.totals;
  return (
    <Card className="overflow-x-auto">
      <CardHeader
        title="Detalle"
        hint={`Cada ${period.bucket === "day" ? "día" : period.bucket === "week" ? "semana" : "mes"} del período`}
        action={
          <a href={`/dashboard/contabilidad/reportes/csv?periodo=${period.kind}&fecha=${period.from}`} download className={control}>
            <Icon name="download" className="size-4" />
            CSV
          </a>
        }
      />
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>{period.bucket === "day" ? "Día" : period.bucket === "week" ? "Semana" : "Mes"}</th>
            <th className={`${th} text-right`}>Pacientes</th>
            <th className={`${th} text-right`}>Nuevos</th>
            <th className={`${th} text-right`}>Citas</th>
            <th className={`${th} text-right`}>Facturado</th>
            <th className={`${th} text-right`}>Cobrado</th>
            <th className={`${th} text-right`}>Gastos</th>
            <th className={`${th} text-right`}>Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {report.series.map((s, i) => {
            const net = s.collected_usd - s.expenses_usd;
            const empty = !s.visits && !s.collected_usd && !s.expenses_usd;
            return (
              <tr key={s.slot} className={empty ? "text-stone" : ""}>
                <td className={`${td} whitespace-nowrap first-letter:uppercase`}>{names[i] ?? s.slot}</td>
                <td className={`${td} text-right tabular-nums`}>{formatCount(s.patients)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatCount(s.new_patients)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatCount(s.visits)}</td>
                <td className={`${td} text-right font-mono`}>{formatUsd(s.billed_usd)}</td>
                <td className={`${td} text-right font-mono`}>{formatUsd(s.collected_usd)}</td>
                <td className={`${td} text-right font-mono`}>{formatUsd(s.expenses_usd)}</td>
                <td className={`${td} text-right font-mono ${net < 0 ? "text-[#b03a36]" : ""}`}>{formatUsd(net)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-cream font-semibold text-navy">
            <td className={td}>Total</td>
            <td className={`${td} text-right tabular-nums`} title="Pacientes distintos en todo el período">
              {formatCount(t.patients)}
            </td>
            <td className={`${td} text-right tabular-nums`}>{formatCount(t.new_patients)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatCount(t.visits)}</td>
            <td className={`${td} text-right font-mono`}>{formatUsd(t.billed_usd)}</td>
            <td className={`${td} text-right font-mono`}>{formatUsd(t.collected_usd)}</td>
            <td className={`${td} text-right font-mono`}>{formatUsd(t.expenses_usd)}</td>
            <td className={`${td} text-right font-mono`}>{formatUsd(t.collected_usd - t.expenses_usd)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="border-t border-line px-5 py-3 text-[12px] text-muted">
        El total de pacientes cuenta a cada persona una vez, aunque haya venido varios{" "}
        {period.bucket === "day" ? "días" : period.bucket === "week" ? "semanas" : "meses"}.
      </p>
    </Card>
  );
}

