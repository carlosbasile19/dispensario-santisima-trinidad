import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data access layer for the current user. Every server-side auth check goes
 * through here. getClaims() verifies the JWT signature, so unlike getSession()
 * it is safe to trust on the server.
 *
 * With Cache Components, anything that calls these must render inside <Suspense>.
 *
 * Both reads are `"use cache: private"`, which also dedupes them per request
 * (replacing React.cache). The Supabase client reads the session cookie and
 * checks the token's expiry against `Date.now()` inside its own code, so the
 * session can't be passed into a plain `"use cache"`. A private cache may read
 * both, which lets the signed-in UI resolve in each route's App Shell and keeps
 * dashboard navigations instant. Nothing is stored on the server across
 * production requests; the browser keeps the result for the default profile's
 * 5-minute `stale`, the minimum for the App Shell, so don't lower it.
 */
export async function getCurrentUser() {
  "use cache: private";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: data.claims.email ?? null };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentProfile() {
  "use cache: private";
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
