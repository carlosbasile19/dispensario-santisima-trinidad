import type { Metadata } from "next";

import { Icon } from "@/components/crm/icons";
import { Avatar, Badge, Button, Card, CardHeader, NoAccess, PageHeader, RoleBadge, td, th } from "@/components/crm/ui";
import { PERMISSION_MATRIX, ROLES, ROLE_INFO } from "@/lib/crm/roles";
import { MEMBERS } from "@/lib/crm/sample-data";
import { getViewer } from "@/lib/crm/viewer";

export const metadata: Metadata = { title: "Miembros" };

const LEVEL = {
  full: { label: "Completo", className: "text-[#135c62]", icon: "check" },
  own: { label: "Solo propios", className: "text-navy", icon: "check" },
  read: { label: "Solo lectura", className: "text-navy", icon: "eye" },
  none: { label: "Sin acceso", className: "text-stone", icon: "lock" },
} as const;

// Miembros (administrators only): who has an account, with which role, and
// exactly what each role can see. The matrix is generated from lib/crm/roles.
export default async function MembersPage() {
  const viewer = await getViewer();
  if (!viewer.permissions.members) return <NoAccess role={viewer.role} section="Miembros" />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administración"
        title="Miembros"
        description="Las personas con acceso a la plataforma y lo que puede ver cada perfil."
        actions={<Button icon="plus">Invitar miembro</Button>}
      />

      <Card className="overflow-x-auto">
        <CardHeader title="Equipo" hint={`${MEMBERS.length} personas`} />
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Miembro</th>
              <th className={th}>Perfil</th>
              <th className={th}>Área</th>
              <th className={th}>Estado</th>
              <th className={th}>Último acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MEMBERS.map((m) => (
              <tr key={m.email}>
                <td className={td}>
                  <span className="flex items-center gap-3">
                    <Avatar name={m.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block truncate text-[13px] text-muted">{m.email}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <RoleBadge role={m.role} />
                </td>
                <td className={`${td} text-ink whitespace-nowrap`}>{m.area}</td>
                <td className={td}>
                  <Badge tone={m.status === "activo" ? "teal" : "outline"}>
                    {m.status === "activo" ? "Activo" : "Invitado"}
                  </Badge>
                </td>
                <td className={`${td} text-ink whitespace-nowrap`}>{m.lastSeen}</td>
              </tr>
            ))}
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
