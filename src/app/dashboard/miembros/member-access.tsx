"use client";

import { useActionState } from "react";
import { Icon } from "@/components/crm/icons";
import { Select } from "@/components/crm/select";
import { roleOptions } from "@/lib/crm/roles";
import { inviteMember, resetMemberPassword, type MemberAccessState } from "../actions";

const input =
  "h-10 w-full rounded-lg border border-outline bg-white px-3 text-sm text-navy outline-none focus:border-navy";

// The temporary password is shown once, here, and stored nowhere else.
function TemporaryPassword({ created }: { created: NonNullable<NonNullable<MemberAccessState>["created"]> }) {
  return (
    <div role="status" className="rounded-lg border border-line bg-cream px-4 py-3 text-sm">
      <p className="font-medium">Contraseña temporal de {created.email}</p>
      <p className="mt-1.5 font-mono text-[15px] break-all select-all">{created.password}</p>
      <p className="mt-1.5 text-[13px] text-muted">
        Cópiala ahora y entrégasela en persona: no se vuelve a mostrar. Debe cambiarla en Mi cuenta al entrar.
      </p>
    </div>
  );
}

export function InviteMember() {
  const [state, action, pending] = useActionState<MemberAccessState, FormData>(inviteMember, undefined);

  return (
    <form action={action} className="flex flex-col gap-4 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_220px_auto] xl:items-end">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Nombre y apellido
          <input name="name" required autoComplete="off" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Correo
          <input name="email" type="email" required autoComplete="off" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Perfil
          <Select name="role" defaultValue="staff" options={roleOptions()} searchable={false} panelMinWidth={340} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-teal disabled:opacity-60"
        >
          <Icon name="plus" className="size-4" />
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-[#b03a36]">
          {state.error}
        </p>
      )}
      {state?.created && <TemporaryPassword created={state.created} />}
    </form>
  );
}

export function ResetPassword({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState<MemberAccessState, FormData>(resetMemberPassword, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="member" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg border border-outline px-3 text-[13px] font-medium whitespace-nowrap hover:border-navy disabled:opacity-60"
      >
        {pending ? "Generando…" : "Nueva contraseña"}
      </button>
      {state?.error && (
        <p role="alert" className="text-[13px] text-[#b03a36]">
          {state.error}
        </p>
      )}
      {state?.created && <TemporaryPassword created={state.created} />}
    </form>
  );
}
