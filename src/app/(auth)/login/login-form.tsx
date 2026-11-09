"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";
import { signIn, type AuthFormState } from "./actions";

const input =
  "h-11 rounded-lg border border-outline bg-white px-3 text-[15px] text-navy outline-none focus:border-navy";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);

  async function signInWithPasskey() {
    setPasskeyError(null);
    if (!window.PublicKeyCredential) {
      setPasskeyError("Este navegador no admite passkeys. Entra con tu contraseña.");
      return;
    }
    setPasskeyPending(true);
    const { data, error } = await createClient().auth.signInWithPasskey();
    if (error || !data?.session) {
      setPasskeyPending(false);
      setPasskeyError("No se pudo entrar con la passkey. Inténtalo de nuevo o usa tu contraseña.");
      return;
    }
    // Full navigation so the server reads the new session cookie.
    window.location.assign(safeNext(next));
  }

  const error = state?.error ?? passkeyError;

  return (
    <div className="flex w-full flex-col gap-5">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Correo
          <input name="email" type="email" required autoComplete="username webauthn" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>

        {error && (
          <p role="alert" className="text-sm text-[#b03a36]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-navy text-[15px] font-medium text-white transition-colors hover:bg-teal disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[12px] tracking-[0.08em] text-stone uppercase">
        <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={signInWithPasskey}
        disabled={passkeyPending}
        className="h-11 rounded-lg border border-outline bg-white text-[15px] font-medium text-navy transition-colors hover:border-navy disabled:opacity-60"
      >
        {passkeyPending ? "Esperando tu passkey…" : "Entrar con passkey"}
      </button>
    </div>
  );
}
