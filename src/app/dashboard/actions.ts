"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { isRole } from "@/lib/crm/roles";
import { PREVIEW_ROLE_COOKIE } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

/** Administrators only: previews the platform as another profile (see lib/crm/viewer.ts). */
export async function setPreviewRole(formData: FormData) {
  const profile = await getCurrentProfile();
  const role = formData.get("role");
  if (profile?.role !== "admin" || !isRole(role)) return;
  (await cookies()).set(PREVIEW_ROLE_COOKIE, role, {
    path: "/dashboard",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  refresh();
}

/** Administrators only: assigns a member's profile. The database re-checks (set_member_role). */
export async function setMemberRole(formData: FormData) {
  const profile = await getCurrentProfile();
  const memberId = formData.get("member");
  const role = formData.get("role");
  if (profile?.role !== "admin" || typeof memberId !== "string" || !isRole(role)) return;
  const supabase = await createClient();
  await supabase.rpc("set_member_role", { member_id: memberId, new_role: role });
  refresh();
}

export type PasswordFormState = { error?: string; message?: string } | undefined;

/** Changes the signed-in member's own password. */
export async function changePassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Tu sesión terminó. Vuelve a entrar." };
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
  if (password !== confirm) return { error: "Las dos contraseñas no coinciden." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." };
  return { message: "Contraseña actualizada." };
}
