"use client";

import { useRef, useState } from "react";

import { fetchBcvRate, setExchangeRate } from "@/app/dashboard/agenda/actions";
import { formatDay } from "@/lib/crm/clinic";
import { formatRate } from "@/lib/crm/money";
import { ActionForm, SubmitButton } from "./forms";
import { Icon } from "./icons";
import { inputClass } from "./styles";

const BCV_URL = "https://www.bcv.org.ve/";

/** A day's rate as the pages read it (lib/crm/data getRate). */
export type RateInfo = {
  rate_date: string;
  bs_per_usd: number;
  source: string;
  fecha_valor: string | null;
  official_bs_per_usd: number | null;
};

/** Where a rate came from, in words. */
export function rateOrigin(rate: RateInfo) {
  if (rate.source === "manual") return "Cargada a mano";
  const from = rate.source === "bcv" ? "bcv.org.ve" : "espejo de la tasa BCV";
  if (rate.fecha_valor && rate.fecha_valor < rate.rate_date) {
    return `Automática · ${from} · la del ${formatDay(rate.fecha_valor, "short")} (sin tasa propia: fin de semana o feriado)`;
  }
  return `Automática · ${from}`;
}

/**
 * A day's BCV rate. Normally it arrives by itself (the scheduled job, or
 * "Traer del BCV"); it can still be typed or corrected by hand, and a typed
 * rate that differs from the official one is pointed out. Correcting a rate
 * recalculates that day's payments.
 */
export function RateForm({
  day,
  current,
  suggestion,
  hasPayments = false,
  canFetch = false,
}: {
  day: string;
  /** The rate already set for the day. */
  current: RateInfo | null;
  /** Last rate set before this day, shown as a hint (never saved unless typed). */
  suggestion?: number | null;
  hasPayments?: boolean;
  /** Offer "Traer del BCV" (for today). */
  canFetch?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(!current);
  const official = current?.official_bs_per_usd ?? null;
  const differs = current?.source === "manual" && official !== null && official !== current.bs_per_usd;

  return (
    <div className="flex flex-col gap-4">
      {current && (
        <div className="flex items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              current.source === "manual" ? "bg-sand text-ink" : "bg-mint/30 text-[#135c62]"
            }`}
          >
            <Icon name={current.source === "manual" ? "ledger" : "bolt"} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xl leading-tight">Bs. {formatRate(current.bs_per_usd)}</p>
            <p className="mt-1 text-[12px] leading-snug text-muted">{rateOrigin(current)}</p>
          </div>
        </div>
      )}

      {differs && (
        <div className="flex gap-2.5 rounded-lg border border-coral/30 bg-coral/5 px-3 py-2.5 text-[13px] leading-snug">
          <Icon name="alert" className="mt-0.5 size-4 text-[#b03a36]" />
          <p className="min-w-0 flex-1">
            El BCV publicó <strong className="font-mono font-medium">Bs. {formatRate(official)}</strong> para este día.
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                requestAnimationFrame(() => {
                  if (!input.current) return;
                  input.current.value = String(official);
                  input.current.focus();
                });
              }}
              className="ml-1.5 font-medium text-teal underline-offset-2 hover:underline"
            >
              Usar la del BCV
            </button>
          </p>
        </div>
      )}

      {canFetch && (
        <ActionForm action={fetchBcvRate} className="flex flex-col gap-2">
          <SubmitButton variant={current ? "secondary" : "primary"} icon="refresh" pendingLabel="Consultando el BCV…">
            {current ? "Volver a consultar el BCV" : "Traer la tasa del BCV"}
          </SubmitButton>
        </ActionForm>
      )}

      {editing ? (
        <ActionForm action={setExchangeRate} resetOnSuccess className="flex flex-col gap-3">
          <input type="hidden" name="day" value={day} />
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] text-muted">
              {current ? "Corregir a mano (Bs. por dólar)" : "O escríbela a mano (Bs. por dólar)"}
              <input
                ref={input}
                name="rate"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                required
                placeholder={current ? String(current.bs_per_usd) : suggestion ? String(suggestion) : "0.00"}
                className={`${inputClass} font-mono`}
              />
            </label>
            <SubmitButton pendingLabel="Guardando…" variant="secondary">
              {current ? "Corregir" : "Guardar"}
            </SubmitButton>
          </div>
          <p className="text-[12px] leading-relaxed text-stone">
            {current && hasPayments && "Si la corriges, se recalculan todos los cobros de ese día. "}
            {!current && suggestion ? <>La última tasa cargada fue Bs. {formatRate(suggestion)}. </> : null}
            Tasa oficial en{" "}
            <a href={BCV_URL} target="_blank" rel="noreferrer" className="font-medium text-teal hover:text-navy">
              bcv.org.ve
            </a>
            .
          </p>
        </ActionForm>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-[13px] font-medium text-teal hover:text-navy"
        >
          Corregir a mano
        </button>
      )}
    </div>
  );
}
