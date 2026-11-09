import type { Metadata } from "next";

import { signOut } from "@/app/(auth)/login/actions";

export const metadata: Metadata = { title: "Acceso pendiente", robots: { index: false } };

// Shown to a signed-in account that has no platform profile assigned yet.
export default function PendingAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-16">
      <h1 className="font-serif text-4xl leading-tight">Tu acceso está pendiente</h1>
      <p className="text-[15px] text-muted">
        Tu cuenta existe, pero todavía no tiene un perfil asignado en la plataforma. Pídele a un
        administrador del centro que te lo asigne y vuelve a entrar.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium hover:border-navy"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
