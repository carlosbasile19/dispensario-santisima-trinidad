import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";

import { can, isRole } from "@/lib/crm/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CONNECT_COOKIE, zernioConfig } from "@/lib/whatsapp/config";
import { syncTemplateStatuses } from "@/lib/whatsapp/send";
import { listWhatsAppAccounts } from "@/lib/whatsapp/zernio";

export const maxDuration = 30;

// Where Zernio's hosted signup sends the administrator back after Meta's
// Embedded Signup (connectWhatsApp in dashboard/whatsapp/actions.ts started
// it). The query carries `connected=whatsapp&accountId=…` or `error=…`.
// Nothing in the URL is trusted: the state must match the cookie set when
// the flow started, the member must be an administrator, and the account
// must be a WhatsApp account of the clinic's Zernio profile.

const back = (request: Request, query: string) => {
  const response = NextResponse.redirect(new URL(`/dashboard/whatsapp?${query}`, request.url));
  response.cookies.set({ name: CONNECT_COOKIE, value: "", path: "/api/whatsapp/callback", maxAge: 0 });
  return response;
};

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const config = zernioConfig();
  const admin = createAdminClient();
  if (!config || !admin) return back(request, "error=config");

  const state = url.searchParams.get("state") ?? "";
  const expected = (await cookies()).get(CONNECT_COOKIE)?.value ?? "";
  if (!state || state !== expected) return back(request, "error=state");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login", request.url));
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!isRole(profile?.role) || !can(profile.role).management) return back(request, "error=forbidden");

  const failure = url.searchParams.get("error");
  if (failure) return back(request, `error=${encodeURIComponent(failure.slice(0, 60))}`);

  const accountId = url.searchParams.get("accountId") ?? "";
  if (url.searchParams.get("connected") !== "whatsapp" || !/^[0-9a-f]{24}$/i.test(accountId)) {
    return back(request, "error=connection_cancelled");
  }

  let phone: string | null = null;
  try {
    const accounts = await listWhatsAppAccounts(config.apiKey, config.profileId);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return back(request, "error=account");
    phone = account.username || account.displayName || null;
  } catch (error) {
    console.error("WhatsApp callback: could not check the account", error instanceof Error ? error.message : error);
    return back(request, "error=zernio");
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("whatsapp_settings")
    .update({
      connected: true,
      zernio_account_id: accountId,
      phone: phone?.slice(0, 40) ?? null,
      connected_at: now,
      connected_by: userId,
      disconnected_at: null,
      disconnect_reason: null,
    })
    .eq("id", true);
  if (error) {
    console.error("WhatsApp callback: could not save the connection", error.code, error.message);
    return back(request, "error=save");
  }

  try {
    await syncTemplateStatuses(admin, config.apiKey, accountId);
  } catch (syncError) {
    console.error("WhatsApp template sync failed", syncError instanceof Error ? syncError.message : syncError);
  }
  return back(request, "conectado=1");
}
