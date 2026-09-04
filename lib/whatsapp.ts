import crypto from "crypto";

// Thin client for the WhatsApp Cloud API (Meta Graph API).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const BASE_URL =
  process.env.WHATSAPP_API_BASE_URL ?? "https://graph.facebook.com/v21.0";

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

// Resolve credentials: prefer the tenant's own connection, fall back to the
// global env (handy in development / sandbox).
export function resolveCredentials(tenant?: {
  phoneNumberId?: string | null;
  accessToken?: string | null;
}): WhatsAppCredentials | null {
  const phoneNumberId =
    tenant?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = tenant?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

interface SendResult {
  waMessageId: string | null;
  raw: unknown;
}

async function post(
  creds: WhatsAppCredentials,
  body: Record<string, unknown>,
): Promise<SendResult> {
  const res = await fetch(`${BASE_URL}/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (raw as any)?.error?.message ?? `WhatsApp API error (${res.status})`;
    throw new Error(message);
  }
  const waMessageId = (raw as any)?.messages?.[0]?.id ?? null;
  return { waMessageId, raw };
}

// Free-form text — only allowed inside the 24h customer service window.
export function sendTextMessage(
  creds: WhatsAppCredentials,
  to: string,
  text: string,
): Promise<SendResult> {
  return post(creds, {
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });
}

// Template message — required to start a conversation / outside the 24h window.
export function sendTemplateMessage(
  creds: WhatsAppCredentials,
  to: string,
  templateName: string,
  languageCode = "en_US",
  components?: unknown[],
): Promise<SendResult> {
  return post(creds, {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

// Validate the X-Hub-Signature-256 header Meta sends with webhook payloads.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // If no app secret configured (e.g. local sandbox), skip validation.
  if (!appSecret) return true;
  if (!signatureHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader),
    );
  } catch {
    return false;
  }
}
