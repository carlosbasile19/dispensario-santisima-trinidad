import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The few Zernio endpoints the clinic uses (https://docs.zernio.com). Zernio
// is a Meta Tech Provider: it connects the clinic's number to the WhatsApp
// Cloud API (with Coexistence, so the number stays in the WhatsApp Business
// app) and relays Meta's webhooks, signed, to /api/whatsapp/webhook.

const BASE = "https://zernio.com/api/v1";

export class ZernioError extends Error {
  constructor(
    message: string,
    /** HTTP status of Zernio's answer (0 when it never answered). */
    readonly status: number,
    /** Zernio's machine-readable code, e.g. TEMPLATE_REQUIRED. */
    readonly code: string | null,
    /** Meta's error code when the platform refused, e.g. 131026 (recipient unreachable). */
    readonly platformCode: string | null,
  ) {
    super(message);
    this.name = "ZernioError";
  }
}

type Query = Record<string, string | undefined>;

async function call<T>(
  apiKey: string,
  path: string,
  { method = "GET", query, body, idempotencyKey }: { method?: string; query?: Query; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  // Ids from webhooks end up in paths; pin the origin so nothing can send the key elsewhere.
  const url = new URL(`${BASE}${path}`);
  if (url.origin !== "https://zernio.com") throw new Error("Refusing a request outside zernio.com");
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, value);

  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    text = await response.text();
  } catch (error) {
    throw new ZernioError(`Zernio no respondió (${error instanceof Error ? error.message : "error de red"})`, 0, "network", null);
  }

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const problem = (data ?? {}) as {
      error?: unknown;
      message?: unknown;
      code?: unknown;
      platformError?: { code?: unknown; message?: unknown; error_user_msg?: unknown };
    };
    const platformCode = problem.platformError?.code;
    const detail =
      (typeof problem.platformError?.error_user_msg === "string" && problem.platformError.error_user_msg) ||
      (typeof problem.error === "string" && problem.error) ||
      (typeof problem.message === "string" && problem.message) ||
      `Zernio respondió ${response.status}`;
    throw new ZernioError(
      detail,
      response.status,
      typeof problem.code === "string" ? problem.code : null,
      platformCode === undefined || platformCode === null ? null : String(platformCode),
    );
  }
  return data as T;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

// Connecting ---------------------------------------------------------------------

/**
 * The link that connects the clinic's number: Zernio's hosted page in
 * Spanish, which opens Meta's Embedded Signup with Coexistence (the
 * "Connect your existing WhatsApp Business app" screen and its QR code).
 * The browser comes back to `redirectUrl` with `connected=whatsapp&accountId=…`
 * or `error=…`.
 */
export async function getConnectUrl(
  apiKey: string,
  { profileId, redirectUrl, reconnectAccountId }: { profileId: string; redirectUrl: string; reconnectAccountId?: string },
) {
  const data = await call<{ authUrl?: unknown }>(apiKey, "/connect/whatsapp", {
    query: {
      profileId,
      redirect_url: redirectUrl,
      onboarding: "business_app",
      signup: "hosted",
      language: "es",
      brandName: "Santísima Trinidad",
      reconnectAccountId,
    },
  });
  const authUrl = str(data?.authUrl);
  if (!/^https:\/\//.test(authUrl)) throw new ZernioError("Zernio no devolvió el enlace de conexión", 200, null, null);
  return authUrl;
}

export type ZernioAccount = { id: string; username: string; displayName: string; active: boolean };

/** The profile's WhatsApp accounts, to check an account id the browser brought back. */
export async function listWhatsAppAccounts(apiKey: string, profileId: string): Promise<ZernioAccount[]> {
  const data = await call<{ accounts?: unknown }>(apiKey, "/accounts", { query: { profileId, platform: "whatsapp" } });
  const list = Array.isArray(data?.accounts) ? (data.accounts as Record<string, unknown>[]) : [];
  return list
    .map((account) => ({
      id: str(account._id) || str(account.id) || str(account.accountId),
      username: str(account.username),
      displayName: str(account.displayName),
      active: account.isActive !== false && account.status !== "disconnected",
    }))
    .filter((account) => account.id);
}

export type NumberInfo = {
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  messagingLimitTier: string;
  status: string;
};

/** Meta's live view of the number (Zernio runs a link probe): its status, quality and daily limit. */
export async function getNumberInfo(apiKey: string, accountId: string): Promise<NumberInfo> {
  const data = await call<{ phone?: Record<string, unknown> }>(apiKey, "/whatsapp/number-info", { query: { accountId } });
  const phone = data?.phone ?? {};
  return {
    displayPhoneNumber: str(phone.display_phone_number),
    verifiedName: str(phone.verified_name),
    qualityRating: str(phone.quality_rating),
    messagingLimitTier: str(phone.messaging_limit_tier),
    status: str(phone.status),
  };
}

// Templates ------------------------------------------------------------------------

export type ZernioTemplate = { id: string; name: string; language: string; status: string; category: string };

export async function listTemplates(apiKey: string, accountId: string): Promise<ZernioTemplate[]> {
  const data = await call<{ templates?: unknown }>(apiKey, "/whatsapp/templates", { query: { accountId } });
  const list = Array.isArray(data?.templates) ? (data.templates as Record<string, unknown>[]) : [];
  return list.map((t) => ({
    id: str(t.id),
    name: str(t.name),
    language: str(t.language),
    status: str(t.status).toUpperCase(),
    category: str(t.category),
  }));
}

/** Submits a template to Meta's review (usually minutes, up to 24 hours). */
export async function createTemplate(
  apiKey: string,
  template: { accountId: string; name: string; language: string; category: "UTILITY"; components: unknown[]; ttlSeconds?: number },
): Promise<ZernioTemplate> {
  const data = await call<{ template?: Record<string, unknown> }>(apiKey, "/whatsapp/templates", {
    method: "POST",
    body: {
      accountId: template.accountId,
      name: template.name,
      category: template.category,
      language: template.language,
      parameter_format: "POSITIONAL",
      components: template.components,
      ...(template.ttlSeconds ? { message_send_ttl_seconds: template.ttlSeconds } : {}),
    },
  });
  const t = data?.template ?? {};
  return { id: str(t.id), name: str(t.name) || template.name, language: str(t.language) || template.language, status: str(t.status).toUpperCase() || "PENDING", category: str(t.category) };
}

// Sending ----------------------------------------------------------------------------

/**
 * Sends an approved template to a phone number (it needs no earlier chat).
 * Answers WhatsApp's message id (wamid) and Zernio's conversation id.
 */
export async function sendTemplate(
  apiKey: string,
  {
    accountId,
    toE164,
    name,
    language,
    params,
    document,
  }: {
    accountId: string;
    toE164: string;
    name: string;
    language: string;
    params: string[];
    /** For a template with a document header: a link Meta can download (a signed URL) and the name the patient sees. */
    document?: { link: string; filename: string };
  },
) {
  const data = await call<{ data?: { messageId?: unknown; conversationId?: unknown } }>(apiKey, "/inbox/conversations", {
    method: "POST",
    body: {
      accountId,
      // Zernio takes the number as digits with the country code, without "+".
      participantId: toE164.replace(/^\+/, ""),
      templateName: name,
      templateLanguage: language,
      templateParams: params,
      ...(document ? { headerMedia: { type: "document", link: document.link, filename: document.filename } } : {}),
    },
  });
  return { messageId: str(data?.data?.messageId), conversationId: str(data?.data?.conversationId) };
}

/**
 * Sends a plain text in a conversation whose 24-hour window is open (the
 * patient has just written or tapped a button). The idempotency key makes a
 * retried webhook send it only once.
 */
export async function sendText(
  apiKey: string,
  { accountId, conversationId, text, idempotencyKey }: { accountId: string; conversationId: string; text: string; idempotencyKey: string },
) {
  await call(apiKey, `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: { accountId, message: text },
    idempotencyKey,
  });
}

// Webhooks ------------------------------------------------------------------------------

/** X-Zernio-Signature is the lowercase hex HMAC-SHA256 of the raw body with the subscription's secret. */
export function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature.trim(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
