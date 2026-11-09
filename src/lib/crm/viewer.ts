import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { can, isRole, type Permissions, type Role } from "./roles";

export type Viewer = {
  /** The member's profile id (the auth user id). */
  id: string;
  /** The member's role, from their profile. */
  role: Role;
  permissions: Permissions;
  name: string;
  firstName: string;
  email: string | null;
};

/**
 * Signed-in member plus role. The role comes from `profiles.role`; a member
 * without one is sent to /acceso-pendiente. Reads cookies: call inside <Suspense>.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const role = profile?.role;
  if (!isRole(role)) redirect("/acceso-pendiente");

  const email = profile?.email ?? user.email;
  const name = profile?.full_name?.trim() || email || "Miembro";

  // "Dra. Lucía Méndez" is greeted as "Lucía".
  const firstName = name.replace(/^(Dr|Dra|Lcda|Lcdo|Lic)\.\s+/i, "").split(" ")[0];
  return { id: user.id, role, permissions: can(role), name, firstName, email };
});
