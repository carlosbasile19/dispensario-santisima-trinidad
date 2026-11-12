import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { AREA_LABEL, PAYMENT_METHODS } from "@/lib/crm/clinic";
import { slotName, slotsOf } from "@/lib/crm/reports";
import { getReport, readPeriod } from "../data";

// The report on screen as a CSV for Excel or Google Sheets: the detail table,
// then the totals and the breakdowns. Spanish spreadsheets split on ";" and
// read "1234,50" as a number, so that is how it is written; the BOM tells
// Excel the file is UTF-8 (accents). accounting_report itself refuses anyone
// who is not an administrator.
export async function GET(request: Request) {
  await connection();
  if (!(await getCurrentUser())) return new Response("Inicia sesión para descargar el reporte.", { status: 401 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { period } = await readPeriod(Promise.resolve(params));
  const report = await getReport(period.from, period.to, period.bucket);
  if (!report) return new Response("No se pudo generar el reporte.", { status: 403 });

  const money = (n: number) => n.toFixed(2).replace(".", ",");
  const cell = (value: string | number) => {
    // A name typed as "=…" (or +, @, a dash not starting a number) would run as a formula in Excel.
    const raw = String(value);
    const text = /^([=+@\t\r]|-(?!\d))/.test(raw) ? `'${raw}` : raw;
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines: (string | number)[][] = [];
  const t = report.totals;
  const names = slotsOf(period).map((s) => slotName(s, period.kind));

  lines.push(["Reporte del Centro Médico Integral Santísima Trinidad"], [`Período: ${period.label}`, `${period.from} a ${period.to}`], []);
  lines.push(["Período", "Desde", "Pacientes", "Pacientes nuevos", "Citas", "Facturado (USD)", "Cobrado (USD)", "Gastos (USD)", "Resultado (USD)"]);
  report.series.forEach((s, i) =>
    lines.push([
      names[i] ?? s.slot,
      s.slot,
      s.patients,
      s.new_patients,
      s.visits,
      money(s.billed_usd),
      money(s.collected_usd),
      money(s.expenses_usd),
      money(s.collected_usd - s.expenses_usd),
    ]),
  );
  lines.push([
    "Total",
    "",
    t.patients,
    t.new_patients,
    t.visits,
    money(t.billed_usd),
    money(t.collected_usd),
    money(t.expenses_usd),
    money(t.collected_usd - t.expenses_usd),
  ]);

  lines.push([], ["Resumen"]);
  lines.push(
    ["Citas atendidas", t.attended],
    ["Citas sin cerrar", t.unmarked],
    ["Citas por venir", t.upcoming],
    ["Citas canceladas", t.cancelled],
    ["No asistió", t.no_show],
    ["Citas reservadas en línea", t.online],
    ["Cobrado en dólares (USD)", money(t.received_usd)],
    ["Cobrado en bolívares (Bs.)", money(t.received_bs)],
    ["Financiado con Cashea (USD)", money(t.financed_usd)],
    ["Gastos en bolívares a tasa BCV (Bs.)", money(t.expenses_bs)],
    ["Por cobrar hasta hoy (USD)", money(t.owed_usd)],
  );

  lines.push([], ["Área", "Citas", "Pacientes", "Facturado (USD)"]);
  report.areas.forEach((a) => lines.push([AREA_LABEL[a.area], a.visits, a.patients, money(a.billed_usd)]));

  lines.push([], ["Forma de pago", "Cobros", "Monto (USD)", "Monto (Bs.)"]);
  report.methods.forEach((m) => lines.push([PAYMENT_METHODS[m.method].label, m.payments, money(m.amount_usd), money(m.amount_bs)]));

  lines.push([], ["Servicio", "Área", "Veces", "Facturado (USD)"]);
  report.services.forEach((s) => lines.push([s.service, AREA_LABEL[s.area], s.count, money(s.billed_usd)]));

  lines.push([], ["Profesional", "Citas", "Pacientes", "Facturado (USD)"]);
  report.professionals.forEach((p) => lines.push([p.name, p.visits, p.patients, money(p.billed_usd)]));

  lines.push([], ["Proveedor", "Pagos", "Monto (USD)"]);
  report.suppliers.forEach((s) => lines.push([s.name, s.expenses, money(s.amount_usd)]));

  const csv = "﻿" + lines.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${period.kind}-${period.from}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
