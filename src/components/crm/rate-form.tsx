"use client";

import { setExchangeRate } from "@/app/dashboard/agenda/actions";
import { formatRate } from "@/lib/crm/money";
import { ActionForm, SubmitButton } from "./forms";
import { inputClass } from "./styles";

const BCV_URL = "https://www.bcv.org.ve/";

/**
 * Sets or corrects the BCV rate of one day. Shows the current value when
 * there is one; correcting it recalculates that day's payments.
 */
export function RateForm({
  day,
  current,
  suggestion,
  hasPayments = false,
}: {
  day: string;
  /** Bs per dollar already set for the day. */
  current: number | null;
  /** Last rate set before this day, shown as a hint (never saved unless typed). */
  suggestion?: number | null;
  hasPayments?: boolean;
}) {
  return (
    <ActionForm action={setExchangeRate} className="flex flex-col gap-3">
      <input type="hidden" name="day" value={day} />
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] text-muted">
          Bolívares por dólar
          <input
            key={`${day}-${current ?? ""}`}
            name="rate"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            required
            defaultValue={current ?? undefined}
            placeholder={suggestion ? String(suggestion) : "0.00"}
            className={`${inputClass} font-mono`}
          />
        </label>
        <SubmitButton pendingLabel="Guardando…" variant={current ? "secondary" : "primary"}>
          {current ? "Corregir" : "Guardar"}
        </SubmitButton>
      </div>
      <p className="text-[12px] leading-relaxed text-stone">
        {current ? (
          <>
            Tasa cargada: Bs. {formatRate(current)}.{" "}
            {hasPayments && "Si la corriges, se recalculan todos los cobros de ese día. "}
          </>
        ) : suggestion ? (
          <>La última tasa cargada fue Bs. {formatRate(suggestion)}. Escríbela aunque no haya cambiado. </>
        ) : null}
        Consulta la tasa oficial en{" "}
        <a href={BCV_URL} target="_blank" rel="noreferrer" className="font-medium text-teal hover:text-navy">
          bcv.org.ve
        </a>
        .
      </p>
    </ActionForm>
  );
}
