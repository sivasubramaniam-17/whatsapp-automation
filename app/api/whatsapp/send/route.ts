import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import {
  resolveCredentials,
  sendTextMessage,
  sendTemplateMessage,
} from "@/lib/whatsapp";

export const runtime = "nodejs";

const schema = z.object({
  to: z.string().min(5), // E.164 phone, e.g. 15551234567
  // text: free-form (only valid inside the 24h service window)
  // template: required to open a conversation / outside the window
  type: z.enum(["text", "template"]).default("text"),
  text: z.string().optional(),
  templateName: z.string().optional(),
  languageCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { to, type, text, templateName, languageCode } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
  });
  const creds = resolveCredentials(tenant ?? undefined);
  if (!creds) {
    return fail(
      "WhatsApp not connected. Set the tenant's phoneNumberId/accessToken " +
        "or the WHATSAPP_* env vars.",
      409,
    );
  }

  // Send via Cloud API.
  let sent;
  try {
    if (type === "template") {
      if (!templateName) return fail("templateName is required for templates");
      sent = await sendTemplateMessage(creds, to, templateName, languageCode);
    } else {
      if (!text) return fail("text is required for text messages");
      sent = await sendTextMessage(creds, to, text);
    }
  } catch (err) {
    return fail((err as Error).message, 502);
  }

  // Upsert the contact + conversation, then log the outbound message.
  const contact = await prisma.contact.upsert({
    where: { tenantId_waPhone: { tenantId: auth.tenantId, waPhone: to } },
    create: { tenantId: auth.tenantId, waPhone: to },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
    where: { tenantId: auth.tenantId, contactId: contact.id, status: "open" },
  });
  conversation ??= await prisma.conversation.create({
    data: { tenantId: auth.tenantId, contactId: contact.id },
  });

  const message = await prisma.message.create({
    data: {
      tenantId: auth.tenantId,
      conversationId: conversation.id,
      direction: "outbound",
      type,
      content: type === "template" ? templateName : text,
      templateName: type === "template" ? templateName : null,
      status: "sent",
      waMessageId: sent.waMessageId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return ok({ messageId: message.id, waMessageId: sent.waMessageId }, 201);
}
