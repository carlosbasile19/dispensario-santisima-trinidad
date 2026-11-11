import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ZernioTemplate } from "./zernio";

/** Keep webhook rejection details when a provider read omits them. */
export async function saveTemplateStatuses(admin: SupabaseClient<Database>, templates: readonly ZernioTemplate[]) {
  const rows = templates.map((t) => ({
    name: t.name, language: t.language, status: t.status || "PENDING",
    ...(t.status !== "REJECTED" || t.reason ? { reason: t.reason } : {}),
    meta_template_id: t.id || null, updated_at: new Date().toISOString(),
  }));
  // PostgREST uses the union of keys in a bulk upsert. Mixing a missing
  // reason with an explicit null would erase a reason received by webhook.
  for (const group of [rows.filter((row) => "reason" in row), rows.filter((row) => !("reason" in row))]) {
    if (!group.length) continue;
    const { error } = await admin.from("whatsapp_templates").upsert(group, { onConflict: "name,language" });
    if (error) throw new Error(`whatsapp_templates: ${error.message}`);
  }
}
