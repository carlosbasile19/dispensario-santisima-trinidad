"use client";

import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { inputClass } from "@/components/crm/styles";
import { voidPayment } from "./actions";

/** Contabilidad only: voids a payment with a reason. It stays on record. */
export function VoidPayment({ paymentId }: { paymentId: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-stone hover:text-[#b03a36]">
        <span className="group-open:hidden">Anular</span>
        <span className="hidden group-open:inline">Cerrar</span>
      </summary>
      <ActionForm action={voidPayment} className="mt-2 flex min-w-[220px] flex-col gap-2">
        <input type="hidden" name="payment" value={paymentId} />
        <input name="reason" required maxLength={200} placeholder="Motivo" aria-label="Motivo de la anulación" className={inputClass} />
        <div>
          <SubmitButton size="sm" variant="danger" pendingLabel="Anulando…">
            Anular cobro
          </SubmitButton>
        </div>
      </ActionForm>
    </details>
  );
}
