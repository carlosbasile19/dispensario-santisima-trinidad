"use server";

import { randomBytes } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { isRole } from "@/lib/crm/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export type AvatarFormState = { error?: string; message?: string } | undefined;

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Deletes the member's stored photos, except `keep`. Storage RLS limits this to their own folder. */
async function removeOldAvatars(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep);
  if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
}

/**
 * Uploads the signed-in member's profile photo to Supabase Storage
 * (avatars/<user id>/<timestamp>.<ext>) and points profiles.avatar_url at it.
 * Each upload gets a new file name so browsers never show a cached old photo.
 */
export async function uploadAvatar(_prev: AvatarFormState, formData: FormData): Promise<AvatarFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Tu sesión terminó. Vuelve a entrar." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una imagen." };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: "La foto debe ser JPG, PNG o WebP." };
  if (file.size > AVATAR_MAX_BYTES) return { error: "La foto no puede pesar más de 2 MB." };

  const supabase = await createClient();
  const path = `${profile.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return { error: "No se pudo subir la foto. Inténtalo de nuevo." };

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", profile.id);
  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { error: "No se pudo guardar la foto. Inténtalo de nuevo." };
  }

  await removeOldAvatars(supabase, profile.id, path);
  // The photo shows in the sidebar of every dashboard route, whose profile
  // read is a private (browser-side) cache: purge it for the whole layout.
  revalidatePath("/dashboard", "layout");
  return { message: "Foto actualizada." };
}

/** Removes the signed-in member's profile photo; their initials show again. */
export async function removeAvatar(): Promise<AvatarFormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Tu sesión terminó. Vuelve a entrar." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
  if (error) return { error: "No se pudo quitar la foto. Inténtalo de nuevo." };

  await removeOldAvatars(supabase, profile.id);
  revalidatePath("/dashboard", "layout");
  return { message: "Foto eliminada." };
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
