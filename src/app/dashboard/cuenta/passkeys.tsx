"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/crm/icons";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

const day = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

// Passkeys of the signed-in member: fingerprint, face or device PIN instead
// of the password. Registered and removed straight against Supabase Auth.
export function Passkeys() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await createClient().auth.passkey.list();
    if (error) {
      setPasskeys([]);
      setMessage("No se pudieron cargar tus passkeys. Puede que todavía no estén activadas en el centro.");
      return;
    }
    setPasskeys(data ?? []);
  }

  useEffect(() => {
    let active = true;
    createClient()
      .auth.passkey.list()
      .then(({ data, error }) => {
        if (!active) return;
        setPasskeys(error ? [] : (data ?? []));
        if (error) {
          setMessage("No se pudieron cargar tus passkeys. Puede que todavía no estén activadas en el centro.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function add() {
    setMessage(null);
    if (!window.PublicKeyCredential) {
      setMessage("Este navegador o dispositivo no admite passkeys.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.registerPasskey();
    setBusy(false);
    if (error) {
      setMessage("No se pudo crear la passkey. Si cancelaste, puedes intentarlo de nuevo.");
      return;
    }
    setMessage("Passkey creada. Ya puedes entrar con ella.");
    await load();
  }

  async function remove(passkey: Passkey) {
    setMessage(null);
    setBusy(true);
    const { error } = await createClient().auth.passkey.delete({ passkeyId: passkey.id });
    setBusy(false);
    setMessage(error ? "No se pudo eliminar la passkey." : "Passkey eliminada.");
    await load();
  }

  return (
    <div className="flex flex-col">
      {passkeys === null ? (
        <p className="px-5 py-5 text-sm text-muted">Cargando…</p>
      ) : passkeys.length ? (
        <ul className="divide-y divide-line">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frost text-navy">
                <Icon name="key" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{passkey.friendly_name || "Passkey"}</p>
                <p className="truncate text-[13px] text-muted">
                  Creada el {day(passkey.created_at)}
                  {passkey.last_used_at && ` · último uso ${day(passkey.last_used_at)}`}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(passkey)}
                className="h-9 rounded-lg border border-outline px-3 text-[13px] font-medium hover:border-navy disabled:opacity-60"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-5 text-sm text-muted">
          Todavía no tienes passkeys. Agrega una para entrar con tu huella, tu rostro o el PIN de este
          dispositivo, sin escribir la contraseña.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={add}
          className="flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white transition-colors hover:bg-teal disabled:opacity-60"
        >
          <Icon name="plus" className="size-4" />
          {busy ? "Esperando…" : "Agregar passkey"}
        </button>
        {message && (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
