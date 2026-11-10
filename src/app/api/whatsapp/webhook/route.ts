import { after, connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { zernioConfig } from "@/lib/whatsapp/config";
import { handleZernioEvent, type ZernioEvent } from "@/lib/whatsapp/webhook";
import { verifySignature } from "@/lib/whatsapp/zernio";

export const maxDuration = 30;

// Zernio POSTs every event of the clinic's WhatsApp number here, signed
// with the subscription's secret (X-Zernio-Signature). Zernio expects a 2xx
// within 5 seconds and retries a 5xx for about two days, so: verify, record
// the event id (Zernio may deliver an event twice), handle it, answer.
// A 4xx is never retried, which is right for a bad signature or body.

export async function POST(request: Request) {
  await connection();
  const config = zernioConfig();
  const admin = createAdminClient();
  if (!config || !admin) return Response.json({ error: "WhatsApp is not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-zernio-signature"), config.webhookSecret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ZernioEvent;
  try {
    event = JSON.parse(raw) as ZernioEvent;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event || typeof event !== "object") return Response.json({ error: "Invalid event" }, { status: 400 });
  // POST /v1/webhooks/test and the dashboard's "Send test" carry test: true.
  if (event.test === true || event.event === "webhook.test") return Response.json({ received: true, test: true });

  const id = (typeof event.id === "string" && event.id) || request.headers.get("x-zernio-event-id");
  if (!id) return Response.json({ error: "Missing event id" }, { status: 400 });

  const { error: seen } = await admin
    .from("whatsapp_webhook_events")
    .insert({ id: id.slice(0, 200), event: String(event.event ?? "").slice(0, 100) });
  if (seen?.code === "23505") return Response.json({ received: true, duplicate: true });
  if (seen) {
    console.error("WhatsApp webhook: could not record the event", seen.code, seen.message);
    return Response.json({ error: "Try again" }, { status: 500 });
  }

  try {
    const followUp = await handleZernioEvent({ ...event, id }, admin, config);
    if (followUp) after(followUp);
  } catch (error) {
    console.error("WhatsApp webhook failed", event.event, error instanceof Error ? error.message : error);
    // Forget the id so Zernio's retry is handled, not dropped as a duplicate.
    await admin.from("whatsapp_webhook_events").delete().eq("id", id.slice(0, 200));
    return Response.json({ error: "Try again" }, { status: 500 });
  }
  return Response.json({ received: true });
}
