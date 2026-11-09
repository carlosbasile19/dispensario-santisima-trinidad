"use client";

import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Modal } from "@/components/crm/modal";
import { inputClass } from "@/components/crm/styles";
import { voidPayment } from "./actions";

/** Contabilidad only: voids a payment with a reason. It stays on record. */
export function VoidPayment({ paymentId, summary }: { paymentId: string; summary: string }) {
  return (
    <Modal
      trigger="Anular"
      triggerVariant="quiet"
      triggerLabel={`Anular ${summary}`}
      title="Anular cobro"
      description={
        <>
          <span className="font-medium text-navy">{summary}</span>. Queda en el registro, tachado, y deja de contar en el
          saldo de la cita y en los totales del día.
        </>
      }
      icon="alert"
      tone="coral"
      size="sm"
    >
      <ActionForm action={voidPayment} className="flex flex-col gap-4">
        <input type="hidden" name="payment" value={paymentId} />
        <Field label="Motivo">
          <textarea
            name="reason"
            required
            maxLength={200}
            rows={3}
            autoFocus
            placeholder="Por ejemplo: monto equivocado, se registró dos veces"
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
        <ModalActions>
          <SubmitButton variant="destructive" pendingLabel="Anulando…">
            Anular cobro
          </SubmitButton>
        </ModalActions>
      </ActionForm>
    </Modal>
  );
}
