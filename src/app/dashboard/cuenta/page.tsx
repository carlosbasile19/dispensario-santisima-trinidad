import type { Metadata } from "next";

import { signOut } from "@/app/(auth)/login/actions";
import { Avatar, Card, CardHeader, PageHeader, RoleBadge } from "@/components/crm/ui";
import { ROLE_INFO } from "@/lib/crm/roles";
import { getCurrentProfile } from "@/lib/auth";
import { getViewer } from "@/lib/crm/viewer";
import { Passkeys } from "./passkeys";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

// Mi cuenta: the member's own profile and how they sign in (password and
// passkeys).
export default async function AccountPage() {
  const [viewer, profile] = await Promise.all([getViewer(), getCurrentProfile()]);
  const name = profile?.full_name?.trim() || profile?.email || "Miembro";

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <PageHeader title="Mi cuenta" description="Tus datos y la forma en que entras a la plataforma." />

      <Card>
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1 basis-[200px]">
            <p className="truncate text-lg font-medium">{name}</p>
            <p className="truncate text-sm text-muted">{profile?.email}</p>
          </div>
          <RoleBadge role={viewer.role} />
          <form action={signOut}>
            <button
              type="submit"
              className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium hover:border-navy"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
        <p className="border-t border-line px-5 py-3.5 text-[13px] text-muted">
          {ROLE_INFO[viewer.role].description} Solo un administrador puede cambiar tu perfil.
        </p>
      </Card>

      <Card>
        <CardHeader title="Passkeys" hint="Entra con tu huella, tu rostro o el PIN del dispositivo" />
        <Passkeys />
      </Card>

      <Card>
        <CardHeader title="Contraseña" hint="Mínimo 10 caracteres. Cámbiala si recibiste una temporal." />
        <PasswordForm />
      </Card>
    </div>
  );
}
