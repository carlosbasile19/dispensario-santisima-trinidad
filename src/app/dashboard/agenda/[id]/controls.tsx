"use client";

import { useState } from "react";

import { ActionForm, Field, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { PAYMENT_METHODS, PAYMENT_METHOD_LIST, type PaymentMethod } from "@/lib/crm/clinic";
import { bsToUsd, centsToInput, formatBs, formatRate, formatUsd, parseCents, toCents, toRate, usdToBs } from "@/lib/crm/money";
import { ROLE_INFO } from "@/lib/crm/roles";
import { addAppointmentItem, recordPayment, removeAppointmentItem, updateAppointmentItem } from "../actions";
import { ServiceLines, type ProfessionalOption, type ServiceOption } from "../service-lines";

/**
 * Takes a payment for a visit at today's BCV rate. Dollar methods take the
 * amount in dollars; bolívar methods in bolívares, starting from the balance
 * converted at the rate. The preview uses the same arithmetic as the database.
 */
export function PaymentForm({
  appointmentId,
  balance,
  rate,
}: {
  appointmentId: string;
  /** Balance due in dollars. */
  balance: number;
  /** Today's rate, Bs per dollar. */
  rate: number;
}) {
  const due = toCents(balance);
  const scaledRate = toRate(rate);
  const dueIn = (method: PaymentMethod) =>
    centsToInput(PAYMENT_METHODS[method].currency === "USD" ? due : usdToBs(due, scaledRate));

  const [method, setMethod] = useState<PaymentMethod>("cash_usd");
  const [amount, setAmount] = useState(() => dueIn("cash_usd"));
  const currency = PAYMENT_METHODS[method].currency;

  const typed = parseCents(amount);
  const credited = typed === null ? null : currency === "USD" ? typed : bsToUsd(typed, scaledRate);
  const equivalent = typed === null ? null : currency === "USD" ? usdToBs(typed, scaledRate) : typed;
  const tooMuch = credited !== null && credited > due;
  const left = credited !== null && !tooMuch ? due - credited : null;

  return (
    <ActionForm action={recordPayment} className="flex flex-col gap-4">
      <input type="hidden" name="appointment" value={appointmentId} />
      <Field label="Forma de pago">
        <select
          name="method"
          value={method}
          onChange={(e) => {
            const next = e.target.value as PaymentMethod;
            if (PAYMENT_METHODS[next].currency !== currency) setAmount(dueIn(next));
            setMethod(next);
          }}
          className={inputClass}
        >
          <optgroup label="En dólares">
            {PAYMENT_METHOD_LIST.filter((m) => PAYMENT_METHODS[m].currency === "USD").map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHODS[m].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="En bolívares (tasa BCV)">
            {PAYMENT_METHOD_LIST.filter((m) => PAYMENT_METHODS[m].currency === "VES").map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHODS[m].label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field label={currency === "USD" ? "Monto recibido (USD)" : "Monto recibido (Bs.)"}>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} font-mono text-base`}
        />
      </Field>

      <div className="rounded-lg bg-cream px-3 py-2.5 text-[13px] leading-relaxed">
        {credited === null ? (
          <p className="text-muted">Escribe el monto con hasta 2 decimales.</p>
        ) : (
          <>
            <p>
              {currency === "USD" ? (
                <>Equivale a <strong className="font-mono font-medium">{formatBs(equivalent!)}</strong></>
              ) : (
                <>Abona <strong className="font-mono font-medium">{formatUsd(credited)}</strong> al saldo</>
              )}
              <span className="text-stone"> · tasa {formatRate(rate)}</span>
            </p>
            {tooMuch ? (
              <p className="mt-1 text-[#b03a36]">Supera el saldo de {formatUsd(due)}. Registra solo lo que cubre la cita.</p>
            ) : (
              left !== null && (
                <p className="mt-1 text-muted">
                  {left === 0n ? "Con este cobro la cita queda pagada." : `Quedará un saldo de ${formatUsd(left)}.`}
                </p>
              )
            )}
          </>
        )}
      </div>

      {method !== "cash_usd" && method !== "cash_bs" && (
        <Field label="Referencia (opcional)">
          <input name="reference" maxLength={60} autoComplete="off" className={inputClass} />
        </Field>
      )}

      <SubmitButton icon="cash" pendingLabel="Registrando…" disabled={credited === null || credited <= 0n || tooMuch}>
        Registrar cobro
      </SubmitButton>
    </ActionForm>
  );
}

/** Change the professional or the price of a booked service, or remove it. */
export function ItemControls({
  itemId,
  appointmentId,
  professionalId,
  price,
  professionals,
  canRemove,
}: {
  itemId: string;
  appointmentId: string;
  professionalId: string | null;
  price: number;
  professionals: ProfessionalOption[];
  canRemove: boolean;
}) {
  const assignable = professionals.filter(
    (p) => p.role === "doctor" || p.role === "director" || p.id === professionalId,
  );
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-teal hover:text-navy">
        <span className="group-open:hidden">Editar</span>
        <span className="hidden group-open:inline">Cerrar</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-cream/60 p-3">
        <ActionForm action={updateAppointmentItem} className="flex flex-col gap-3">
          <input type="hidden" name="item" value={itemId} />
          <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
            <Field label="Profesional">
              <select name="professional" defaultValue={professionalId ?? ""} className={inputClass}>
                <option value="">Sin asignar</option>
                {assignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.role === "director" ? ` (${ROLE_INFO.director.short})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Precio (USD)">
              <input
                name="price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                defaultValue={centsToInput(toCents(price))}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
          <div>
            <SubmitButton size="sm" pendingLabel="Guardando…">
              Guardar
            </SubmitButton>
          </div>
        </ActionForm>
        {canRemove && (
          <ActionForm action={removeAppointmentItem} className="flex flex-col gap-2 border-t border-line pt-3">
            <input type="hidden" name="item" value={itemId} />
            <input type="hidden" name="appointment" value={appointmentId} />
            <div>
              <SubmitButton size="sm" variant="danger" icon="x" pendingLabel="Quitando…">
                Quitar este servicio
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </div>
    </details>
  );
}

/** Adds one more service, with its professional and price, to a visit. */
export function AddItemForm({
  appointmentId,
  services,
  professionals,
}: {
  appointmentId: string;
  services: ServiceOption[];
  professionals: ProfessionalOption[];
}) {
  // Remount after each save so the line starts empty again.
  const [round, setRound] = useState(0);
  return (
    <ActionForm
      key={round}
      action={async (state, formData) => {
        const result = await addAppointmentItem(state, formData);
        if (result?.message) setRound((n) => n + 1);
        return result;
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="appointment" value={appointmentId} />
      <ServiceLines services={services} professionals={professionals} single />
      <div>
        <SubmitButton size="sm" icon="plus" pendingLabel="Añadiendo…">
          Añadir a la cita
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
