// Sets the clinic up in your existing Zernio account (the same team other
// projects use) and prints the three values the platform needs in Vercel.
//
//   ZERNIO_ADMIN_KEY=sk_... SITE_URL=https://<production-domain> node scripts/zernio-setup.mjs
//
// ZERNIO_ADMIN_KEY is a full-access key of the Zernio team owner (Zernio →
// Settings → API keys). It is used only by this run and never stored. The
// script:
//   1. finds or creates the profile "Centro Médico Integral Santísima Trinidad"
//      (externalId dst-clinic) with zero content retention: Zernio keeps ids
//      and statuses, never message text, which suits patient data;
//   2. creates an API key limited to that profile (ZERNIO_API_KEY), so the
//      platform cannot reach the team's other profiles;
//   3. creates (or updates) a webhook limited to that profile, pointing at
//      SITE_URL/api/whatsapp/webhook, with a new secret (ZERNIO_WEBHOOK_SECRET).
// Safe to run again: it reuses the profile and the webhook for that URL. Each
// run creates a new API key and a new webhook secret, so update Vercel and
// revoke the old key in Zernio.
import { randomBytes } from "node:crypto";

const BASE = "https://zernio.com/api/v1";
const PROFILE = {
  name: "Centro Médico Integral Santísima Trinidad",
  externalId: "dst-clinic",
  description: "WhatsApp del centro (plataforma DST)",
  timezone: "America/Caracas",
};
const EVENTS = [
  "message.received",
  "message.delivered",
  "message.read",
  "message.failed",
  "account.connected",
  "account.disconnected",
  "whatsapp.template.status_updated",
];

const adminKey = process.env.ZERNIO_ADMIN_KEY?.trim();
const site = process.env.SITE_URL?.trim().replace(/\/$/, "");
if (!adminKey || !site || !/^https:\/\/[^/]+$/.test(site)) {
  console.error("Usage: ZERNIO_ADMIN_KEY=<full-access key> SITE_URL=https://<production-domain> node scripts/zernio-setup.mjs");
  process.exit(1);
}
const webhookUrl = `${site}/api/whatsapp/webhook`;

async function zernio(path, { method = "GET", body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${adminKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`${method} ${path} → ${response.status}: ${data?.error ?? data?.message ?? text}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// 1. The clinic's profile ---------------------------------------------------------------
let profile = (await zernio(`/profiles?externalId=${encodeURIComponent(PROFILE.externalId)}`)).profiles?.[0];
if (profile) {
  console.log(`Profile found: ${profile.name} (${profile._id})`);
} else {
  try {
    profile = (await zernio("/profiles", { method: "POST", body: { ...PROFILE, contentRetention: "none" } })).profile;
  } catch (error) {
    // Zero content retention needs the team owner; create it without and warn.
    if (error.status !== 403) throw error;
    profile = (await zernio("/profiles", { method: "POST", body: PROFILE })).profile;
    console.warn("Created the profile without zero content retention (only the team owner can turn it on).");
  }
  console.log(`Profile created: ${profile.name} (${profile._id})`);
}
if (profile.contentRetention !== "none") {
  try {
    await zernio(`/profiles/${profile._id}`, { method: "PUT", body: { contentRetention: "none" } });
    console.log("Zero content retention: on.");
  } catch (error) {
    console.warn(`Could not turn on zero content retention (${error.message}). Turn it on in Zernio if you can.`);
  }
}

// 2. A key limited to that profile ----------------------------------------------------------
const { apiKey } = await zernio("/api-keys", {
  method: "POST",
  body: { name: "Santísima Trinidad · plataforma", scope: "profiles", profileIds: [profile._id], permission: "read-write" },
});
if (!apiKey?.key) throw new Error("Zernio did not return the new key.");
console.log(`API key created: ${apiKey.name ?? "Santísima Trinidad · plataforma"} (${apiKey.keyPreview ?? apiKey.id})`);

// 3. The webhook --------------------------------------------------------------------------
const secret = randomBytes(32).toString("hex");
const { webhooks = [] } = await zernio("/webhooks/settings");
const existing = webhooks.find((w) => w.url === webhookUrl);
const subscription = { name: "Santísima Trinidad · WhatsApp", url: webhookUrl, secret, events: EVENTS, profileIds: [profile._id], isActive: true };
if (existing) {
  await zernio("/webhooks/settings", { method: "PUT", body: { webhookId: existing._id, ...subscription } });
  console.log(`Webhook updated: ${webhookUrl}`);
} else {
  await zernio("/webhooks/settings", { method: "POST", body: subscription });
  console.log(`Webhook created: ${webhookUrl}`);
}

console.log(`
Add these to Vercel (Project → Settings → Environment Variables, Production
and Preview), then redeploy:

ZERNIO_API_KEY=${apiKey.key}
ZERNIO_PROFILE_ID=${profile._id}
ZERNIO_WEBHOOK_SECRET=${secret}

Then, in the platform: Administración → WhatsApp → Conectar WhatsApp, with
the clinic's phone at hand, and "Enviar a Meta para revisión".`);
