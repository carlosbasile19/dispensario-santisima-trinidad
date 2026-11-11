import "server-only";
import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetch";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new one per request; never share it between requests.
 *
 * The client compares the session's expiry with `Date.now()` on every auth
 * call and every query. With Partial Prefetching, `cookies()` resolves while
 * Next.js renders the App Shell, so it doesn't keep that clock read out of the
 * prerender. `io()` does: outside a cache scope it defers what follows to
 * request time; inside `"use cache: private"` (src/lib/auth.ts), during a
 * request or in an action it resolves at once.
 */
export async function createClient() {
  const cookieStore = await cookies();
  await io();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
