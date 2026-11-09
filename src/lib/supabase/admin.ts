import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client with the project's secret key. It bypasses RLS and can
 * manage auth users, so it is used only inside server actions that have
 * already checked the caller is an administrator. Never import it from
 * client code (server-only enforces that) and never return its data unchecked.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return null;
  return createClient<Database>(env.supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
