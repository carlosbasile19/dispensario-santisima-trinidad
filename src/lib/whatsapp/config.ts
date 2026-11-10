import "server-only";

// Zernio settings, from the server's environment (Vercel → Settings →
// Environment Variables). `node scripts/zernio-setup.mjs` creates the three
// values in your Zernio account and prints them; README "WhatsApp" explains.

export const ZERNIO_ENV = ["ZERNIO_API_KEY", "ZERNIO_PROFILE_ID", "ZERNIO_WEBHOOK_SECRET"] as const;

export type ZernioConfig = {
  /** A Zernio API key limited to the clinic's profile. */
  apiKey: string;
  /** The Zernio profile that holds the clinic's WhatsApp number. */
  profileId: string;
  /** The secret of the webhook subscription that points at /api/whatsapp/webhook. */
  webhookSecret: string;
};

export function zernioConfig(): ZernioConfig | null {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  const profileId = process.env.ZERNIO_PROFILE_ID?.trim();
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET?.trim();
  return apiKey && profileId && webhookSecret ? { apiKey, profileId, webhookSecret } : null;
}

/** The variables still missing, for the WhatsApp page. */
export const missingZernioEnv = () => ZERNIO_ENV.filter((name) => !process.env[name]?.trim());

/**
 * Cookie that carries the random state of a "Conectar WhatsApp" flow from
 * the dashboard to /api/whatsapp/callback, so a forged link to the callback
 * cannot attach another number.
 */
export const CONNECT_COOKIE = "wa_connect_state";
