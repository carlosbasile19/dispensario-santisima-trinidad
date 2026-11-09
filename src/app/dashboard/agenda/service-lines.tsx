"use client";

import { useState } from "react";

import { Icon } from "@/components/crm/icons";
import { Select, type SelectOption } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { AREA_ICON, AREA_LABEL, SERVICE_AREAS } from "@/lib/crm/clinic";
import { centsToInput, formatUsd, parseCents, toCents } from "@/lib/crm/money";
import { ROLE_INFO, type Role } from "@/lib/crm/roles";
import type { ServiceArea } from "@/lib/crm/clinic";

export type ServiceOption = { id: string; area: ServiceArea; name: string; price_usd: number };
export type ProfessionalOption = { id: string; name: string; role: Role | null };

/** Doctors and the medical director as picker options (plus one already assigned). */
export function professionalOptions(professionals: ProfessionalOption[], keep?: string | null): SelectOption[] {
  return [
    { value: "", label: "Sin asignar", description: "Se puede asignar después", icon: "team" },
    ...professionals
      .filter((p) => p.role === "doctor" || p.role === "director" || p.id === keep)
      .map((p) => ({
        value: p.id,
        label: p.name,
        avatar: p.name,
        description: p.role ? ROLE_INFO[p.role].label : "Sin perfil",
      })),
  ];
}

/** The price list as picker options, grouped by area, with the centre's price. */
export function serviceOptions(services: ServiceOption[]): SelectOption[] {
  return SERVICE_AREAS.flatMap((area) =>
    services
      .filter((s) => s.area === area)
      .map((s) => ({
        value: s.id,
        label: s.name,
        meta: formatUsd(s.price_usd),
        icon: AREA_ICON[area],
        group: AREA_LABEL[area],
      })),
  );
}

type Line = { key: number; serviceId: string; professionalId: string; price: string; edited: boolean };

const newLine = (key: number): Line => ({ key, serviceId: "", professionalId: "", price: "", edited: false });

/**
 * The services of a visit. Each line is a service with its own professional
 * and price: the centre's price unless the front desk types another one.
 * The lines travel to the Server Action as JSON in a hidden "items" field.
 */
export function ServiceLines({
  services,
  professionals,
  single = false,
}: {
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  /** Exactly one line (adding a service to an existing visit). */
  single?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([newLine(0)]);
  const byId = new Map(services.map((s) => [s.id, s]));
  const serviceChoices = serviceOptions(services);
  const professionalChoices = professionalOptions(professionals);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const chooseService = (line: Line, serviceId: string) => {
    const service = byId.get(serviceId);
    update(line.key, {
      serviceId,
      // A new service brings its own price unless the price was typed by hand.
      price: line.edited || !service ? line.price : centsToInput(toCents(service.price_usd)),
    });
  };

  const total = lines.reduce((sum, line) => sum + (parseCents(line.price) ?? 0n), 0n);
  const payload = lines
    .filter((line) => line.serviceId)
    .map((line) => ({ service_id: line.serviceId, professional_id: line.professionalId || null, price_usd: line.price }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const service = byId.get(line.serviceId);
          const listCents = service ? toCents(service.price_usd) : null;
          const typed = parseCents(line.price);
          const changed = listCents !== null && typed !== null && typed !== listCents;
          return (
            <li
              key={line.key}
              className={
                single
                  ? "grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px] sm:items-start"
                  : "grid gap-3 rounded-xl border border-line bg-cream/60 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_auto] md:items-start"
              }
            >
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
                {single ? "Servicio" : `Servicio ${index + 1}`}
                <Select
                  required
                  value={line.serviceId}
                  onValueChange={(value) => chooseService(line, value)}
                  options={serviceChoices}
                  placeholder="Elige un servicio"
                  searchPlaceholder="Buscar en el tarifario…"
                  panelMinWidth={320}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
                Profesional
                <Select
                  value={line.professionalId}
                  onValueChange={(value) => update(line.key, { professionalId: value })}
                  options={professionalChoices}
                  searchPlaceholder="Buscar profesional…"
                  panelMinWidth={260}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-muted">
                Precio (USD)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  required
                  value={line.price}
                  onChange={(e) => update(line.key, { price: e.target.value, edited: true })}
                  className={`${inputClass} font-mono`}
                />
                {listCents !== null && (
                  <span className={`text-[12px] ${changed ? "text-[#b03a36]" : "text-stone"}`}>
                    {changed ? "Cambiado · " : ""}Centro: {formatUsd(listCents)}
                    {changed && (
                      <button
                        type="button"
                        onClick={() => update(line.key, { price: centsToInput(listCents), edited: false })}
                        className="ml-1.5 font-medium text-teal underline-offset-2 hover:underline"
                      >
                        Restablecer
                      </button>
                    )}
                  </span>
                )}
              </label>

              {!single && (
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  disabled={lines.length === 1}
                  aria-label={`Quitar servicio ${index + 1}`}
                  className="grid size-10 place-items-center self-end rounded-lg text-stone hover:bg-white hover:text-[#b03a36] disabled:invisible md:mt-[22px] md:self-start"
                >
                  <Icon name="x" className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!single && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLines((current) => [...current, newLine(Math.max(...current.map((l) => l.key)) + 1)])}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-outline px-3 text-[13px] font-medium text-navy hover:border-navy"
          >
            <Icon name="plus" className="size-4" />
            Añadir otro servicio
          </button>
          <p className="text-sm">
            Total <span className="ml-2 font-mono text-base font-medium">{formatUsd(total)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
