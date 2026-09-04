import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/whatsapp";
import { runChatbot } from "@/lib/chatbot";

export const runtime = "nodejs";

// ── GET: webhook verification handshake ─────────────────
// Meta calls this once when you subscribe the webhook. Echo hub.challenge
// back if the verify token matches.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: inbound events (messages + statuses) ──────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Always ack fast; process defensively so one bad event can't 500 the batch.
  try {
    await processWebhook(payload);
  } catch (err) {
    console.error("[webhook] processing error:", err);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

async function processWebhook(payload: any) {
  if (payload?.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId: string | undefined =
        value?.metadata?.phone_number_id;

      // Route the event to the tenant that owns this WhatsApp number.
      const tenant = phoneNumberId
        ? await prisma.tenant.findFirst({ where: { phoneNumberId } })
        : null;
      if (!tenant) continue; // number not connected to any tenant yet

      // Incoming messages from customers.
      for (const msg of value.messages ?? []) {
        await handleIncomingMessage(tenant, msg);
      }

      // Delivery/read status updates for messages we sent.
      for (const status of value.statuses ?? []) {
        await handleStatusUpdate(tenant.id, status);
      }
    }
  }
}

async function handleIncomingMessage(tenant: Tenant, msg: any) {
  const tenantId = tenant.id;
  const from: string = msg.from; // customer's phone number
  const text: string | undefined =
    msg.text?.body ?? msg.button?.text ?? msg.interactive?.list_reply?.title;

  const contact = await prisma.contact.upsert({
    where: { tenantId_waPhone: { tenantId, waPhone: from } },
    create: { tenantId, waPhone: from, optIn: true },
    update: {},
  });

  const existing = await prisma.conversation.findFirst({
    where: { tenantId, contactId: contact.id, status: "open" },
  });
  const isNewConversation = !existing;
  const conversation =
    existing ??
    (await prisma.conversation.create({
      data: { tenantId, contactId: contact.id },
    }));

  // A customer message (re)opens the free 24h service window.
  const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.message.create({
    data: {
      tenantId,
      conversationId: conversation.id,
      direction: "inbound",
      type: msg.type ?? "text",
      content: text ?? null,
      status: "received",
      waMessageId: msg.id ?? null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), windowExpiresAt, status: "open" },
  });

  // Run the chatbot engine: auto-reply if a flow matches, else the message
  // simply waits in the shared inbox for a human.
  await runChatbot({
    tenant,
    conversation,
    contact,
    text: text ?? "",
    isNewConversation,
  });
}

async function handleStatusUpdate(tenantId: string, status: any) {
  const waMessageId: string | undefined = status.id;
  const newStatus: string | undefined = status.status; // sent|delivered|read|failed
  if (!waMessageId || !newStatus) return;

  await prisma.message.updateMany({
    where: { tenantId, waMessageId },
    data: { status: newStatus },
  });

  // Also update the broadcast delivery report if this message was part of one.
  await prisma.campaignRecipient.updateMany({
    where: { waMessageId },
    data: { status: newStatus },
  });
}
