import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { can, isRole, type Permissions, type Role } from "./roles";
import type { Patient } from "./sample-data";

/**
 * DESIGN PHASE: the role comes from a cookie set by the "Ver como" bar, so
 * each level of access can be reviewed from one account. This is safe only
 * because the platform shows sample data. Before real patient data lands, the
 * role must come from the database (a `role` column on profiles, enforced by
 * RLS) and this cookie must go away.
 */
export const PREVIEW_ROLE_COOKIE = "dst-preview-role";

/** Who each role "is" in the sample data, so the preview reads like a real day. */
const PERSONA: Record<Role, { name: string; firstName: string; doctorId: string | null }> = {
  doctor: { name: "Dra. Andreína Rojas", firstName: "Dra. Rojas", doctorId: "d2" },
  director: { name: "Dr. José Morales", firstName: "Dr. Morales", doctorId: "d1" },
  staff: { name: "Yuleidy Pérez", firstName: "Yuleidy", doctorId: null },
  admin: { name: "Administración", firstName: "Administración", doctorId: null },
};

export type Viewer = {
  role: Role;
  permissions: Permissions;
  name: string;
  firstName: string;
  email: string | null;
  /** Set when the viewer is a doctor: their id in the sample data. */
  doctorId: string | null;
};

/** Signed-in user plus role. Reads cookies: call inside <Suspense>. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  const stored = (await cookies()).get(PREVIEW_ROLE_COOKIE)?.value;
  const role: Role = isRole(stored) ? stored : "admin";
  return {
    role,
    permissions: can(role),
    ...PERSONA[role],
    email: profile?.email ?? user.email,
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
