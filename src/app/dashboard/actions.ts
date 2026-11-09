"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { isRole } from "@/lib/crm/roles";
import { PREVIEW_ROLE_COOKIE } from "@/lib/crm/viewer";

/** Design phase only: switches the role the platform is previewed as (see lib/crm/viewer.ts). */
export async function setPreviewRole(formData: FormData) {
  await requireUser();
  const role = formData.get("role");
  if (!isRole(role)) return;
  (await cookies()).set(PREVIEW_ROLE_COOKIE, role, {
    path: "/dashboard",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  refresh();
}
