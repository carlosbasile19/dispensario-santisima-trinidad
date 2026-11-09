import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { Icon } from "@/components/crm/icons";
import { Avatar, Badge, Card, CardHeader, NoAccess, PageHeader, RoleBadge, td, th } from "@/components/crm/ui";
import { Select } from "@/components/crm/select";
import { PERMISSION_MATRIX, ROLES, ROLE_INFO, roleOptions } from "@/lib/crm/roles";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { setMemberRole } from "../actions";
import { InviteMember, ResetPassword } from "./member-access";

export const metadata: Metadata = { title: "Miembros" };

const LEVEL = {
  full: { label: "Completo", className: "text-[#135c62]", icon: "check" },
  own: { label: "Solo propios", className: "text-navy", icon: "check" },
  read: { label: "Solo lectura", className: "text-navy", icon: "eye" },
  none: { label: "Sin acceso", className: "text-stone", icon: "lock" },
} as const;

const joined = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", year: "numeric" });

// Miembros (administrators only): the real accounts of the platform, with the
// profile of each, and exactly what each profile can see. RLS lets only
// administrators read other members; the matrix comes from lib/crm/roles.
//
// Everything but the member list depends only on the viewer, so it can render
// in the App Shell. The list streams into its own <Suspense>: the one around
// {children} in the dashboard layout sits above what a navigation between
// dashboard pages re-renders, so it doesn't cover this page then.
export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.members) return <NoAccess role={viewer.role} section="Miembros" />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Miembros"
        description="Las personas del centro con cuenta en la plataforma y lo que puede ver cada perfil. Los pacientes no tienen acceso."
      />

      <Card>
        <CardHeader title="Crear cuenta" hint="La cuenta queda activa con una contraseña temporal que se muestra una sola vez" />
        <InviteMember />
      </Card>

      <Suspense fallback={<TeamLoading />}>
        <Team selfId={viewer.id} />
      </Suspense>

      <Card className="overflow-x-auto">
        <CardHeader title="Perfiles y permisos" hint="Qué puede ver y hacer cada nivel de acceso" />
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-line align-top">
              <th className={`${th} w-[30%]`}>
                <span className="sr-only">Permiso</span>
              </th>
              {ROLES.map((role) => (
                <th key={role} className="px-5 py-4 text-left align-top font-normal">
                  <RoleBadge role={role} />
                  <p className="mt-2 text-[13px] leading-snug text-muted">{ROLE_INFO[role].description}</p>
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_MATRIX.map((section) => (
            <tbody key={section.group} className="divide-y divide-line border-b border-line last:border-b-0">
              <tr className="bg-cream">
                <th colSpan={ROLES.length + 1} scope="colgroup" className={`${th} py-2.5`}>
                  {section.group}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {row.label}
                  </th>
                  {ROLES.map((role) => {
                    const level = LEVEL[row.level(role)];
                    return (
                      <td key={role} className={td}>
                        <span className={`flex items-center gap-1.5 whitespace-nowrap ${level.className}`}>
                          <Icon name={level.icon} className="size-4" />
                          {level.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Card>
    </div>
  );
}

// The member list, read fresh on every request (not cached) so it reflects
// setMemberRole and inviteMember as soon as they call refresh().
async function Team({ selfId }: { selfId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at");
  const members = data ?? [];

  return (
    <TeamCard hint={`${members.length} ${members.length === 1 ? "persona" : "personas"}`}>
      {members.map((m) => {
        const name = m.full_name?.trim() || m.email || "Sin nombre";
        return (
          <tr key={m.id}>
            <td className={td}>
              <span className="flex items-center gap-3">
                <Avatar name={name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="block truncate text-[13px] text-muted">{m.email}</span>
                </span>
              </span>
            </td>
            <td className={td}>
              {m.id === selfId ? (
                <span className="flex items-center gap-2">
                  {m.role && <RoleBadge role={m.role} />}
                  <span className="text-[13px] text-stone">Tú</span>
                </span>
              ) : (
                <form action={setMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="member" value={m.id} />
                  <Select
                    name="role"
                    size="sm"
                    defaultValue={m.role ?? ""}
                    required
                    placeholder="Sin perfil"
                    aria-label={`Perfil de ${name}`}
                    options={roleOptions()}
                    searchable={false}
                    className="w-[190px]"
                    panelMinWidth={340}
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg border border-outline px-3 text-[13px] font-medium hover:border-navy"
                  >
                    Guardar
                  </button>
                </form>
              )}
            </td>
            <td className={td}>
              <Badge tone={m.role ? "teal" : "outline"}>{m.role ? "Activo" : "Sin acceso"}</Badge>
            </td>
            <td className={`${td} text-ink whitespace-nowrap`}>{joined.format(new Date(m.created_at))}</td>
            <td className={td}>{m.id !== selfId && <ResetPassword memberId={m.id} />}</td>
          </tr>
        );
      })}
    </TeamCard>
  );
}

// Frame of the "Equipo" card, shared by the list and its loading state so the
// title and column headings show while the rows stream in.
function TeamCard({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto">
      <CardHeader title="Equipo" hint={hint} />
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Miembro</th>
            <th className={th}>Perfil</th>
            <th className={th}>Estado</th>
            <th className={th}>Alta</th>
            <th className={th}>Acceso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </Card>
  );
}

// Placeholder rows shaped like member rows: the name and email bars sit in
// lines set like the real ones, so rows keep their height, and the controls
// are their real size, so the columns barely move when the list arrives.
function TeamLoading() {
  const bar = "block rounded bg-sand";
  const line = "inline-block rounded bg-sand align-middle";
  return (
    <TeamCard hint="Cargando…">
      {[0, 1, 2].map((row) => (
        <tr key={row} aria-hidden="true" className="animate-pulse">
          <td className={td}>
            <span className="flex items-center gap-3">
              <span className="size-9 shrink-0 rounded-full bg-sand" />
              <span>
                <span className="block">
                  <span className={`${line} h-3.5 w-36`} />
                </span>
                <span className="block text-[13px]">
                  <span className={`${line} h-3 w-44`} />
                </span>
              </span>
            </span>
          </td>
          <td className={td}>
            <span className="flex gap-2">
              <span className={`${bar} h-9 w-40 rounded-lg`} />
              <span className={`${bar} h-9 w-19 rounded-lg`} />
            </span>
          </td>
          <td className={td}>
            <span className={`${bar} h-6 w-16 rounded-full`} />
          </td>
          <td className={td}>
            <span className={`${bar} h-3.5 w-20`} />
          </td>
          <td className={td}>
            <span className={`${bar} h-9 w-34 rounded-lg`} />
          </td>
        </tr>
      ))}
    </TeamCard>
  );
}
