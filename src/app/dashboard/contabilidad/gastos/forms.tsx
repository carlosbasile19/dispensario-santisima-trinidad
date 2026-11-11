"use client";

import { useState } from "react";

import { DatePicker } from "@/components/crm/date-picker";
import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Modal } from "@/components/crm/modal";
import { Select } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { EXPENSE_METHODS, VENEZUELAN_BANKS, expenseMethod, type ExpenseMethod } from "@/lib/crm/expenses";
import { addExpense, deleteExpense, saveSupplier } from "./actions";

export type SupplierOption = { id: string; name: string; detail: string | null };

const METHOD_OPTIONS = EXPENSE_METHODS.map((method) => ({
  value: method,
  label: expenseMethod(method).label,
  icon: expenseMethod(method).icon,
  group: expenseMethod(method).currency === "USD" ? "En dólares" : "En bolívares · tasa BCV",
}));

/** A payment out: the day, what for, to whom, how and how much (in the method's currency). */
export function ExpenseForm({ today, suppliers }: { today: string; suppliers: SupplierOption[] }) {
  const [method, setMethod] = useState<ExpenseMethod>("pago_movil");
  const usd = expenseMethod(method).currency === "USD";

  return (
    <ActionForm action={addExpense} resetOnSuccess className="flex flex-col gap-4 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Día">
          <DatePicker name="spent_on" defaultValue={today} max={today} required />
        </Field>
        <Field label="Proveedor" hint={suppliers.length ? undefined : "Añade proveedores abajo para elegirlos aquí."}>
          <Select
            name="supplier"
            placeholder="Sin proveedor"
            options={[
              { value: "", label: "Sin proveedor" },
              ...suppliers.map((s) => ({ value: s.id, label: s.name, description: s.detail ?? undefined })),
            ]}
          />
        </Field>
      </div>
      <Field label="Concepto">
        <input name="description" required minLength={2} maxLength={200} placeholder="Reactivos de laboratorio, alquiler, nómina…" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Forma de pago">
          <Select
            name="method"
            value={method}
            onValueChange={(value) => setMethod(value as ExpenseMethod)}
            searchable={false}
            options={METHOD_OPTIONS}
          />
        </Field>
        <Field label={usd ? "Monto (USD)" : "Monto (Bs.)"} hint={usd ? "Se guarda también en bolívares a la tasa BCV." : "Se guarda también en dólares a la tasa BCV."}>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Referencia" hint="Opcional">
          <input name="reference" maxLength={60} className={`${inputClass} font-mono`} />
        </Field>
      </div>
      <div>
        <SubmitButton icon="plus" pendingLabel="Registrando…">
          Registrar gasto
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export type Supplier = {
  id: string;
  name: string;
  document: string | null;
  bank: string | null;
  account_number: string | null;
  pago_movil_phone: string | null;
  notes: string | null;
};

/** Adds a supplier, or edits one when `supplier` is given, in a modal. */
export function SupplierModal({ supplier }: { supplier?: Supplier }) {
  const listId = supplier ? `banks-${supplier.id}` : "banks-new";
  return (
    <Modal
      trigger={supplier ? "Editar" : "Nuevo proveedor"}
      triggerVariant={supplier ? "link" : "secondary"}
      triggerIcon={supplier ? undefined : "plus"}
      triggerLabel={supplier ? `Editar ${supplier.name}` : undefined}
      title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
      description="A quién se le paga y a qué cuentas se le envía el dinero."
      icon="bank"
    >
      <ActionForm action={saveSupplier} className="flex flex-col gap-4">
        {supplier && <input type="hidden" name="id" value={supplier.id} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Nombre">
            <input name="name" required minLength={2} maxLength={120} defaultValue={supplier?.name} autoFocus className={inputClass} />
          </Field>
          <Field label="RIF o cédula">
            <input name="document" maxLength={30} defaultValue={supplier?.document ?? ""} placeholder="J-12345678-9" className={inputClass} />
          </Field>
        </div>
        <Field label="Banco">
          <input name="bank" maxLength={80} list={listId} defaultValue={supplier?.bank ?? ""} className={inputClass} />
          <datalist id={listId}>
            {VENEZUELAN_BANKS.map((bank) => (
              <option key={bank} value={bank} />
            ))}
          </datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de cuenta" hint="Para transferencias, 20 dígitos">
            <input
              name="account_number"
              maxLength={30}
              inputMode="numeric"
              defaultValue={supplier?.account_number ?? ""}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Teléfono de pago móvil">
            <input
              name="pago_movil_phone"
              maxLength={20}
              inputMode="tel"
              defaultValue={supplier?.pago_movil_phone ?? ""}
              placeholder="0414-1234567"
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>
        <Field label="Notas" hint="Correo de Zelle, otra cuenta, persona de contacto…">
          <textarea name="notes" maxLength={300} rows={2} defaultValue={supplier?.notes ?? ""} className={`${inputClass} h-auto py-2`} />
        </Field>
        <ModalActions>
          <SubmitButton pendingLabel="Guardando…">{supplier ? "Guardar" : "Añadir proveedor"}</SubmitButton>
        </ModalActions>
      </ActionForm>
    </Modal>
  );
}

/** Deletes an expense entered by mistake, after confirming. */
export function DeleteExpense({ expenseId, summary }: { expenseId: string; summary: string }) {
  return (
    <Modal
      trigger="Borrar"
      triggerVariant="quiet"
      triggerLabel={`Borrar ${summary}`}
      title="Borrar gasto"
      description={
        <>
          <span className="font-medium text-navy">{summary}</span>. Deja de contar en los totales de la semana. Si el monto
          estaba mal, bórralo y regístralo de nuevo.
        </>
      }
      icon="trash"
      tone="coral"
      size="sm"
    >
      <ActionForm action={deleteExpense} className="flex flex-col">
        <input type="hidden" name="expense" value={expenseId} />
        <ModalActions>
          <SubmitButton variant="destructive" pendingLabel="Borrando…">
            Borrar gasto
          </SubmitButton>
        </ModalActions>
      </ActionForm>
    </Modal>
  );
}
