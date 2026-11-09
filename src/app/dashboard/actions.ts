"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth";
import { isRole } from "@/lib/crm/roles";
import { PREVIEW_ROLE_COOKIE } from "@/lib/crm/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type MemberAccessState =
  | { error?: string; created?: { name: string; email: string; password: string } }
  | undefined;

const temporaryPassword = () => randomBytes(12).toString("base64url");
const NO_KEY = "Falta configurar SUPABASE_SECRET_KEY en el servidor.";

/**
 * Administrators only: creates a member's account with a profile and a
 * temporary password. The password is returned once, for the administrator
 * to hand over; the member changes it in Mi cuenta.
 */
export async function inviteMember(_prev: MemberAccessState, formData: FormData): Promise<MemberAccessState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { error: "Solo un administrador puede crear cuentas." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role");
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isRole(role)) {
    return { error: "Completa el nombre, un correo válido y el perfil." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: NO_KEY };

  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) {
    return {
      error:
        error?.code === "email_exists"
          ? "Ya existe una cuenta con ese correo. Asígnale el perfil en la lista."
          : "No se pudo crear la cuenta. Inténtalo de nuevo.",
    };
  }

  // The profile row is created by the on_auth_user_created trigger.
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name: name })
    .eq("id", data.user.id);
  if (roleError) {
    return { error: "La cuenta se creó, pero no se pudo asignar el perfil. Asígnalo en la lista." };
  }

  refresh();
  return { created: { name, email, password } };
}

/** Administrators only: gives another member a new temporary password, returned once. */
export async function resetMemberPassword(_prev: MemberAccessState, formData: FormData): Promise<MemberAccessState> {
  const profile = await getCurrentProfile();
  const memberId = formData.get("member");
  if (profile?.role !== "admin" || typeof memberId !== "string") {
    return { error: "Solo un administrador puede restablecer contraseñas." };
  }
  if (memberId === profile.id) return { error: "Cambia tu propia contraseña en Mi cuenta." };

  const admin = createAdminClient();
  if (!admin) return { error: NO_KEY };

  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error || !data.user) return { error: "No se pudo restablecer la contraseña." };

  const email = data.user.email ?? "";
  return { created: { name: email, email, password } };
}
