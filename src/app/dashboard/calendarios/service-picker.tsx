"use client";

import { useState } from "react";

import { Icon } from "@/components/crm/icons";
import { AREA_ICON, AREA_LABEL, SERVICE_AREAS, type ServiceArea } from "@/lib/crm/clinic";
import { formatUsd } from "@/lib/crm/money";
import { SLOT_LENGTHS, slotLabel, type SlotLength } from "@/lib/crm/schedule";

export type PickerService = { id: string; area: ServiceArea; name: string; price_usd: number };
export type Offered = { service_id: string; minutes: SlotLength };

/**
 * The services patients can book on a calendar, from the price list, each
 * with the length of its slots: 30 minutes or 1 hour. The choice travels as
 * JSON in a hidden "services" field, in the order of the list.
 */
export function ServicePicker({ services, initial = [] }: { services: PickerService[]; initial?: Offered[] }) {
  const [chosen, setChosen] = useState(() => new Map(initial.map((o) => [o.service_id, o.minutes])));
  const ordered = SERVICE_AREAS.flatMap((area) => services.filter((s) => s.area === area));
  const payload: Offered[] = ordered.filter((s) => chosen.has(s.id)).map((s) => ({ service_id: s.id, minutes: chosen.get(s.id)! }));

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => {
      const next = new Map(current);
      if (on) next.set(id, current.get(id) ?? 30);
      else next.delete(id);
      return next;
    });
  const setMinutes = (id: string, minutes: SlotLength) => setChosen((current) => new Map(current).set(id, minutes));

  if (!services.length) {
    return <p className="text-sm text-muted">El tarifario no tiene servicios activos. Se cargan en Contabilidad › Tarifas.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="services" value={JSON.stringify(payload)} />
      {SERVICE_AREAS.map((area) => {
        const list = ordered.filter((s) => s.area === area);
        if (!list.length) return null;
        return (
          <div key={area}>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] tracking-[0.14em] text-stone uppercase">
              <Icon name={AREA_ICON[area]} className="size-3.5" />
              {AREA_LABEL[area]}
            </p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {list.map((s) => {
                const on = chosen.has(s.id);
                const minutes = chosen.get(s.id) ?? 30;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggle(s.id, e.target.checked)}
                        className="size-4 shrink-0 accent-teal"
                      />
                      <span className="min-w-0">
                        <span className={`block text-sm leading-snug ${on ? "font-medium text-navy" : "text-ink"}`}>{s.name}</span>
                        <span className="block text-[12px] text-stone">{formatUsd(s.price_usd)}</span>
                      </span>
                    </label>
                    <div
                      role="radiogroup"
                      aria-label={`Duración de los cupos de ${s.name}`}
                      className={`inline-flex rounded-lg border border-outline bg-white p-0.5 transition-opacity ${on ? "" : "pointer-events-none opacity-40"}`}
                    >
                      {SLOT_LENGTHS.map((length) => (
                        <button
                          key={length}
                          type="button"
                          role="radio"
                          aria-checked={on && minutes === length}
                          tabIndex={on ? 0 : -1}
                          onClick={() => setMinutes(s.id, length)}
                          className={`h-7 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                            minutes === length ? "bg-navy text-white" : "text-muted hover:text-navy"
                          }`}
                        >
                          {slotLabel(length)}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="text-[12px] leading-relaxed text-stone">
        Cada servicio divide el horario en cupos de su duración: los de 30 min cada media hora y los de 1 hora cada hora,
        desde el inicio de cada franja.
      </p>
    </div>
  );
}
