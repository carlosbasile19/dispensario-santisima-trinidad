import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Only member routes need session refresh. Public pages, booking, assets,
    // webhooks and cron jobs must not wait for the authentication service.
    "/dashboard/:path*",
    "/imprimir/:path*",
    "/login",
    "/acceso-pendiente",
    "/auth/:path*",
    "/api/whatsapp/callback",
  ],
};
