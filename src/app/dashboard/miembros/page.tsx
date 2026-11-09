import type { Metadata } from "next";

import { Icon } from "@/components/crm/icons";
import { Avatar, Badge, Card, CardHeader, NoAccess, PageHeader, RoleBadge, td, th } from "@/components/crm/ui";
import { PERMISSION_MATRIX, ROLES, ROLE_INFO } from "@/lib/crm/roles";
import { getCurrentProfile } from "@/lib/auth";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";
import { setMemberRole } from "../actions";

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
export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.members) return <NoAccess role={viewer.role} section="Miembros" />;

  const supabase = await createClient();
  const [self, { data }] = await Promise.all([
    getCurrentProfile(),
    supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at"),
  ]);
  const members = data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Miembros"
        description="Las personas del centro con cuenta en la plataforma y lo que puede ver cada perfil. Los pacientes no tienen acceso."
      />

      <Card className="overflow-x-auto">
        <CardHeader title="Equipo" hint={`${members.length} ${members.length === 1 ? "persona" : "personas"}`} />
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Miembro</th>
              <th className={th}>Perfil</th>
              <th className={th}>Estado</th>
              <th className={th}>Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
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
                    {m.id === self?.id ? (
                      <span className="flex items-center gap-2">
                        {m.role && <RoleBadge role={m.role} />}
                        <span className="text-[13px] text-stone">Tú</span>
                      </span>
                    ) : (
                      <form action={setMemberRole} className="flex items-center gap-2">
                        <input type="hidden" name="member" value={m.id} />
                        <select
                          name="role"
                          defaultValue={m.role ?? ""}
                          aria-label={`Perfil de ${name}`}
                          className="h-9 rounded-lg border border-outline bg-white px-2 text-sm"
                        >
                          {!m.role && (
                            <option value="" disabled>
                              Sin perfil
                            </option>
                          )}
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_INFO[role].label}
                            </option>
                          ))}
                        </select>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

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
