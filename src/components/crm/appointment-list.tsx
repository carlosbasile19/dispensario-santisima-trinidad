import Link from "next/link";

import type { Appointment, Balance, Professional } from "@/lib/crm/data";
import {
  AREA_LABEL,
  STATUS_INFO,
  UNBILLED_STATUSES,
  endTime,
  formatDay,
  formatDocument,
  formatTime,
  localDay,
  patientName,
} from "@/lib/crm/clinic";
import { formatUsd } from "@/lib/crm/money";
import { Icon } from "./icons";
import { Badge } from "./ui";

/** Paid in full, part paid or nothing yet, for a visit that is charged. */
export function PaymentBadge({ balance, status }: { balance: Balance; status: Appointment["status"] }) {
  if (UNBILLED_STATUSES.includes(status) && balance.paid === 0) return null;
  if (balance.total > 0 && balance.balance <= 0) return <Badge tone="teal">Pagada</Badge>;
  if (balance.paid > 0) return <Badge tone="navy">Abono {formatUsd(balance.paid)}</Badge>;
  if (balance.total === 0) return null;
  return <Badge tone="coral">Por cobrar</Badge>;
}

/**
 * Appointments as rows: time, patient, each service with its professional,
 * status, and (for members who handle money) the total and what was paid.
 */
export function AppointmentList({
  appointments,
  professionals,
  balances,
  showDate = false,
  highlight,
}: {
  appointments: Appointment[];
  professionals: Map<string, Professional>;
  /** Only passed for members who see payments. */
  balances?: Map<string, Balance>;
  /** Show each row's day (for lists across days, like a patient's history). */
  showDate?: boolean;
  /** A professional whose services are marked as theirs. */
  highlight?: string;
}) {
  return (
    <ul className="divide-y divide-line">
      {appointments.map((a) => {
        const status = STATUS_INFO[a.status];
        const balance = balances?.get(a.id);
        const dim = UNBILLED_STATUSES.includes(a.status);
        const document = a.patient ? formatDocument(a.patient) : null;
        return (
          <li key={a.id}>
            <Link
              href={`/dashboard/agenda/${a.id}`}
              className={`grid gap-x-5 gap-y-2 px-5 py-4 transition-colors hover:bg-cream sm:grid-cols-[112px_1fr_auto] ${dim ? "opacity-60" : ""}`}
            >
              <div className="leading-tight">
                {showDate && <p className="mb-1 text-[13px] font-medium">{formatDay(localDay(a.starts_at), "short")}</p>}
                <p className="text-[15px] font-medium whitespace-nowrap">{formatTime(a.starts_at)}</p>
                <p className="mt-0.5 text-[12px] whitespace-nowrap text-stone">
                  hasta {endTime(a.starts_at, a.duration_minutes)}
                </p>
              </div>

              <div className="min-w-0">
                <p className="truncate font-medium">
                  {a.patient ? patientName(a.patient) : "Paciente"}
                  {document && <span className="ml-2 text-[13px] font-normal text-muted">{document}</span>}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.items.map((item) => {
                    const professional = item.professional_id ? professionals.get(item.professional_id) : null;
                    const mine = highlight && item.professional_id === highlight;
                    return (
                      <li
                        key={item.id}
                        className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-md px-2 py-1 text-[12px] ${
                          mine ? "bg-mint/30 text-[#135c62]" : "bg-sand text-ink"
                        }`}
                      >
                        <span className="font-medium">{item.service?.name ?? "Servicio"}</span>
                        <span className="shrink-0 text-stone">·</span>
                        <span>
                          {professional?.name ?? (item.service ? AREA_LABEL[item.service.area] : "Sin asignar")}
                          {!professional && item.service && " · sin asignar"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                <span className="flex items-center gap-2">
                  {a.source === "online" && (
                    <span title="Agendada en línea por el paciente" className="inline-flex items-center gap-1 text-[12px] text-teal">
                      <Icon name="globe" className="size-3.5" />
                      En línea
                    </span>
                  )}
                  <Badge tone={status.tone}>{status.label}</Badge>
                </span>
                {balance && (
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] whitespace-nowrap text-muted">{formatUsd(balance.total)}</span>
                    <PaymentBadge balance={balance} status={a.status} />
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
