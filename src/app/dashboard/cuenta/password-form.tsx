"use client";

import { useActionState } from "react";
import { changePassword, type PasswordFormState } from "../actions";

const input =
  "h-10 rounded-lg border border-outline bg-white px-3 text-sm text-navy outline-none focus:border-navy";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(changePassword, undefined);

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4 px-5 py-5">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Nueva contraseña
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Repite la nueva contraseña
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-[#b03a36]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-[#135c62]">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-lg bg-navy px-4 text-sm font-medium text-white transition-colors hover:bg-teal disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
