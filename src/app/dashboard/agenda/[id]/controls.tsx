"use client";

import { useState, type ReactNode } from "react";

import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Icon } from "@/components/crm/icons";
import { Modal } from "@/components/crm/modal";
import { Select, type SelectOption } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { PAYMENT_GROUPS, PAYMENT_METHODS, RECEIVED_METHODS, type Currency, type PaymentMethod } from "@/lib/crm/clinic";
import { bsToUsd, centsToInput, formatBs, formatRate, formatUsd, parseCents, toCents, toRate, usdToBs } from "@/lib/crm/money";
import { addAppointmentItem, recordCasheaPayment, recordPayment, removeAppointmentItem, updateAppointmentItem } from "../actions";
import { ServiceLines, professionalOptions, type ProfessionalOption, type ServiceOption } from "../service-lines";

/** An amount input with its currency in front ("$" or "Bs."). */
function MoneyInput({
  currency,
  value,
  onChange,
  name,
  required,
  placeholder,
  large,
}: {
  currency: Currency;
  value: string;
  onChange: (value: string) => void;
  name: string;
  required?: boolean;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone">
        {currency === "USD" ? "$" : "Bs."}
      </span>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} no-spin font-mono ${currency === "USD" ? "pl-7" : "pl-10"} ${large ? "h-11 text-base" : ""}`}
      />
    </div>
  );
}

/** The payment methods as tiles, in their groups (dollars, bolívares, financed). */
function MethodTiles({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-[13px] text-muted">Forma de pago</legend>
      {PAYMENT_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium tracking-[0.08em] text-stone uppercase">{group.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {group.methods.map((m) => {
              const info = PAYMENT_METHODS[m];
              const checked = value === m;
              return (
                <label
                  key={m}
                  className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border bg-white p-2.5 transition-[border-color,box-shadow,background-color] has-[:focus-visible]:shadow-[0_0_0_3px_rgba(30,126,134,0.2)] ${
                    info.financed ? "col-span-2" : ""
                  } ${checked ? "border-navy bg-frost/50 shadow-[inset_0_0_0_1px_var(--color-navy)]" : "border-line hover:border-outline"}`}
                >
                  <input
                    type="radio"
                    name="method_choice"
                    value={m}
                    checked={checked}
                    onChange={() => onChange(m)}
                    className="sr-only"
                  />
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                      checked ? "bg-navy text-white" : info.financed ? "bg-mint/30 text-[#135c62]" : "bg-frost text-navy"
                    }`}
                  >
                    <Icon name={info.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium">{info.short}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {info.financed ? "Inicial + cuotas · Cashea financia el resto" : info.currency === "USD" ? "Dólares" : "Bolívares"}
                    </span>
                  </span>
                  {checked && <Icon name="check" className="size-4 text-navy" />}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

/**
 * Takes a payment for a visit at today's BCV rate. Dollar methods take the
 * amount in dollars; bolívar methods in bolívares, starting from the balance
 * converted at the rate. Cashea takes the order and its inicial. The
 * preview uses the same arithmetic as the database.
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
  const [method, setMethod] = useState<PaymentMethod>("cash_usd");
  return (
    <div className="flex flex-col gap-5">
      <MethodTiles value={method} onChange={setMethod} />
      {PAYMENT_METHODS[method].financed ? (
        <CasheaFields appointmentId={appointmentId} balance={balance} rate={rate} />
      ) : (
        <ReceivedFields key={PAYMENT_METHODS[method].currency} method={method} appointmentId={appointmentId} balance={balance} rate={rate} />
      )}
    </div>
  );
}

function Preview({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-cream px-3.5 py-3 text-[13px] leading-relaxed">{children}</div>;
}

function ReceivedFields({
  method,
  appointmentId,
  balance,
  rate,
}: {
  method: PaymentMethod;
  appointmentId: string;
  balance: number;
  rate: number;
}) {
  const due = toCents(balance);
  const scaledRate = toRate(rate);
  const currency = PAYMENT_METHODS[method].currency;
  const [amount, setAmount] = useState(() => centsToInput(currency === "USD" ? due : usdToBs(due, scaledRate)));

  const typed = parseCents(amount);
  const credited = typed === null ? null : currency === "USD" ? typed : bsToUsd(typed, scaledRate);
  const equivalent = typed === null ? null : currency === "USD" ? usdToBs(typed, scaledRate) : typed;
  const tooMuch = credited !== null && credited > due;
  const left = credited !== null && !tooMuch ? due - credited : null;

  return (
    <ActionForm action={recordPayment} className="flex flex-col gap-4">
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="method" value={method} />
      <Field label={currency === "USD" ? "Monto recibido en dólares" : "Monto recibido en bolívares"}>
        <MoneyInput name="amount" currency={currency} value={amount} onChange={setAmount} required large />
      </Field>

      <Preview>
        {credited === null ? (
          <p className="text-muted">Escribe el monto con hasta 2 decimales.</p>
        ) : (
          <>
            <p>
              {currency === "USD" ? (
                <>
                  Equivale a <strong className="font-mono font-medium">{formatBs(equivalent!)}</strong>
                </>
              ) : (
                <>
                  Abona <strong className="font-mono font-medium">{formatUsd(credited)}</strong> al saldo
                </>
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
      </Preview>

      {PAYMENT_METHODS[method].reference && (
        <Field label="Referencia (opcional)">
          <input name="reference" maxLength={60} autoComplete="off" placeholder="Últimos dígitos o número de lote" className={inputClass} />
        </Field>
      )}

      <SubmitButton icon="cash" pendingLabel="Registrando…" disabled={credited === null || credited <= 0n || tooMuch}>
        Registrar cobro · {PAYMENT_METHODS[method].short}
      </SubmitButton>
    </ActionForm>
  );
}

const INITIAL_OPTIONS: SelectOption[] = RECEIVED_METHODS.map((m) => ({
  value: m,
  label: PAYMENT_METHODS[m].label,
  icon: PAYMENT_METHODS[m].icon,
  group: PAYMENT_METHODS[m].currency === "USD" ? "En dólares" : "En bolívares",
}));

/**
 * A Cashea sale: the order (number and total in dollars, as Cashea shows
 * it) and the inicial the patient paid here. Cashea finances the rest,
 * which is recorded as a separate "Cashea" line.
 */
function CasheaFields({ appointmentId, balance, rate }: { appointmentId: string; balance: number; rate: number }) {
  const due = toCents(balance);
  const scaledRate = toRate(rate);
  const [total, setTotal] = useState(() => centsToInput(due));
  const [initialMethod, setInitialMethod] = useState<PaymentMethod>("pago_movil");
  const [initial, setInitial] = useState("");
  const [order, setOrder] = useState("");
  const initialCurrency = PAYMENT_METHODS[initialMethod].currency;

  const totalCents = parseCents(total);
  const initialTyped = initial.trim() ? parseCents(initial) : 0n;
  const initialUsd =
    initialTyped === null ? null : initialCurrency === "USD" ? initialTyped : bsToUsd(initialTyped, scaledRate);
  const financed = totalCents !== null && initialUsd !== null ? totalCents - initialUsd : null;
  const orderOk = order.toUpperCase().replace(/[^0-9A-Z-]/g, "").length >= 3;
  const problem =
    totalCents === null || totalCents <= 0n
      ? "Escribe el total de la orden."
      : totalCents > due
        ? `La orden supera el saldo de ${formatUsd(due)}.`
        : initialUsd === null
          ? "Escribe la inicial con hasta 2 decimales."
          : financed !== null && financed <= 0n
            ? "La inicial cubre toda la orden: regístrala como un cobro normal."
            : null;

  return (
    <ActionForm action={recordCasheaPayment} className="flex flex-col gap-4">
      <input type="hidden" name="appointment" value={appointmentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="N.º de orden Cashea">
          <input
            name="cashea_order"
            required
            maxLength={40}
            autoComplete="off"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="Del portal de aliados"
            className={`${inputClass} font-mono uppercase`}
          />
        </Field>
        <Field label="Total de la orden">
          <MoneyInput name="order_total" currency="USD" value={total} onChange={setTotal} required />
        </Field>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
        <p className="text-[13px] font-medium">Inicial pagada en el centro</p>
        <div className="grid gap-3">
          <Field label="Cómo la pagó">
            <Select
              name="initial_method"
              options={INITIAL_OPTIONS}
              value={initialMethod}
              onValueChange={(next) => {
                if (PAYMENT_METHODS[next as PaymentMethod].currency !== initialCurrency) setInitial("");
                setInitialMethod(next as PaymentMethod);
              }}
              searchable={false}
            />
          </Field>
          <Field label="Monto">
            <MoneyInput name="initial_amount" currency={initialCurrency} value={initial} onChange={setInitial} placeholder="0,00" />
          </Field>
        </div>
        {PAYMENT_METHODS[initialMethod].reference && (
          <Field label="Referencia de la inicial (opcional)">
            <input name="initial_reference" maxLength={60} autoComplete="off" className={inputClass} />
          </Field>
        )}
        <p className="text-[12px] text-stone">Déjala vacía si la orden no tuvo inicial.</p>
      </div>

      <Preview>
        {problem ? (
          <p className={totalCents !== null && totalCents > due ? "text-[#b03a36]" : "text-muted"}>{problem}</p>
        ) : (
          <dl className="grid gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Inicial · {PAYMENT_METHODS[initialMethod].short}</dt>
              <dd className="flex flex-col items-end font-mono">
                {formatUsd(initialUsd!)}
                {initialCurrency === "VES" && initialTyped! > 0n && <span className="text-[12px] text-stone">{formatBs(initialTyped!)}</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Financia Cashea</dt>
              <dd className="font-mono font-medium">{formatUsd(financed!)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-3 border-t border-line pt-1.5 text-muted">
              <dt>{due - totalCents! === 0n ? "La cita queda pagada" : "Saldo que queda"}</dt>
              <dd className="font-mono">{formatUsd(due - totalCents!)}</dd>
            </div>
            <p className="mt-1 text-[12px] text-stone">
              Tasa {formatRate(rate)}. El centro cobra las cuotas del paciente; si se atrasa, Cashea responde.
            </p>
          </dl>
        )}
      </Preview>

      <SubmitButton icon="installments" pendingLabel="Registrando…" disabled={Boolean(problem) || !orderOk}>
        Registrar venta Cashea
      </SubmitButton>
    </ActionForm>
  );
}

/** Change the professional or the price of a booked service, or remove it. */
export function ItemControls({
  itemId,
  appointmentId,
  serviceName,
  professionalId,
  price,
  listPrice,
  professionals,
  canRemove,
}: {
  itemId: string;
  appointmentId: string;
  serviceName: string;
  professionalId: string | null;
  price: number;
  listPrice: number;
  professionals: ProfessionalOption[];
  canRemove: boolean;
}) {
  return (
    <Modal
      trigger="Editar"
      triggerLabel={`Editar ${serviceName}`}
      title="Editar servicio"
      description={serviceName}
      icon="tag"
    >
      <ActionForm
        action={(state, formData) =>
          formData.get("intent") === "remove" ? removeAppointmentItem(state, formData) : updateAppointmentItem(state, formData)
        }
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="item" value={itemId} />
        <input type="hidden" name="appointment" value={appointmentId} />
        <Field label="Profesional">
          <Select name="professional" defaultValue={professionalId ?? ""} options={professionalOptions(professionals, professionalId)} />
        </Field>
        <Field label="Precio de esta cita (USD)" hint={`Precio del centro: ${formatUsd(listPrice)}`}>
          <MoneyPrice defaultValue={centsToInput(toCents(price))} />
        </Field>
        {canRemove && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-coral/25 bg-coral/5 px-3.5 py-2.5">
            <p className="text-[13px] text-ink">¿No va este servicio? Quítalo de la cita.</p>
            <SubmitButton size="sm" variant="danger" icon="x" name="intent" value="remove">
              Quitar
            </SubmitButton>
          </div>
        )}
        <ModalActions>
          <SubmitButton icon="check" pendingLabel="Guardando…">
            Guardar cambios
          </SubmitButton>
        </ModalActions>
      </ActionForm>
    </Modal>
  );
}

function MoneyPrice({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return <MoneyInput name="price" currency="USD" value={value} onChange={setValue} required />;
}

/** Adds one more service, with its professional and price, to a visit. */
export function AddItemModal({
  appointmentId,
  services,
  professionals,
}: {
  appointmentId: string;
  services: ServiceOption[];
  professionals: ProfessionalOption[];
}) {
  return (
    <Modal
      trigger="Añadir un servicio"
      triggerIcon="plus"
      triggerVariant="secondary"
      title="Añadir un servicio"
      description="Con su profesional y su precio. Cambia el total de la cita."
      icon="plus"
      size="lg"
    >
      <ActionForm action={addAppointmentItem} className="flex flex-col">
        <input type="hidden" name="appointment" value={appointmentId} />
        <ServiceLines services={services} professionals={professionals} single />
        <ModalActions>
          <SubmitButton icon="plus" pendingLabel="Añadiendo…">
            Añadir a la cita
          </SubmitButton>
        </ModalActions>
      </ActionForm>
    </Modal>
  );
}
