import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { can, isRole, type Permissions, type Role } from "./roles";
import type { Patient } from "./sample-data";

/**
 * Administrators can preview the platform as another profile with the "Ver
 * como" bar; the choice is kept in this cookie. It can only narrow what an
 * administrator sees, and it is ignored for everyone else.
 */
export const PREVIEW_ROLE_COOKIE = "dst-preview-role";

/** Who each previewed profile "is" in the sample data, so the preview reads like a real day. */
const PREVIEW_PERSONA: Record<Exclude<Role, "admin">, { name: string; firstName: string; doctorId: string | null }> = {
  doctor: { name: "Dra. Andreína Rojas", firstName: "Dra. Rojas", doctorId: "d2" },
  director: { name: "Dr. José Morales", firstName: "Dr. Morales", doctorId: "d1" },
  staff: { name: "Yuleidy Pérez", firstName: "Yuleidy", doctorId: null },
};

export type Viewer = {
  /** The role the platform is rendered as. */
  role: Role;
  /** The member's own role, from their profile. */
  realRole: Role;
  permissions: Permissions;
  name: string;
  firstName: string;
  email: string | null;
  /** The viewer's doctor id in the sample data, when they have one. */
  doctorId: string | null;
};

/**
 * Signed-in member plus role. The role comes from `profiles.role`; a member
 * without one is sent to /acceso-pendiente. Reads cookies: call inside <Suspense>.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const realRole = profile?.role;
  if (!isRole(realRole)) redirect("/acceso-pendiente");

  const email = profile?.email ?? user.email;
  const name = profile?.full_name?.trim() || email || "Miembro";

  if (realRole === "admin") {
    const preview = (await cookies()).get(PREVIEW_ROLE_COOKIE)?.value;
    if (isRole(preview) && preview !== "admin") {
      return { role: preview, realRole, permissions: can(preview), email, ...PREVIEW_PERSONA[preview] };
    }
  }

  return {
    role: realRole,
    realRole,
    permissions: can(realRole),
    name,
    firstName: name.split(" ")[0],
    email,
    // Until doctors are real records, the medical director maps to the
    // sample director; other doctors have no sample agenda of their own.
    doctorId: realRole === "director" ? "d1" : null,
  };
});

/** Appointments and patients a viewer may list. */
export const inScope = (viewer: Viewer, doctorId: string) =>
  viewer.permissions.schedule === "all" || viewer.doctorId === doctorId;

/** Whether the viewer may read this patient's clinical data. */
export function canReadClinical(viewer: Viewer, patient: Patient) {
  const { clinical } = viewer.permissions;
  return clinical === "all" || (clinical === "own" && patient.doctorId === viewer.doctorId);
}

/** Whether the viewer may add or change this patient's clinical data. */
export function canEditClinical(viewer: Viewer, patient: Patient) {
  const { editClinical } = viewer.permissions;
  return editClinical === "all" || (editClinical === "own" && patient.doctorId === viewer.doctorId);
}

/** Whether the viewer may open and download this patient's documents. */
export function canDownloadDocuments(viewer: Viewer, patient: Patient) {
  const { documents } = viewer.permissions;
  return documents === "all" || (documents === "own" && patient.doctorId === viewer.doctorId);
}
