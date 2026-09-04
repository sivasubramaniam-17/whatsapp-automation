import type { ChatbotFlow, Contact, Conversation, Tenant } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveCredentials, sendTextMessage, type WhatsAppCredentials } from "./whatsapp";
import { generateSlots, slotsMessage, parseSlotChoice, type Slot } from "./booking";

// Send a free-form text reply and log it as an outbound message. Logs the
// message even if the WhatsApp send fails (status "failed") so the conversation
// is always visible in the inbox — handy for local testing without a live token.
async function sendAndLog(
  tenant: Tenant,
  conversation: Conversation,
  creds: WhatsAppCredentials,
  to: string,
  body: string,
) {
  let status = "sent";
  let waMessageId: string | null = null;
  try {
    const sent = await sendTextMessage(creds, to, body);
    waMessageId = sent.waMessageId;
  } catch (err) {
    status = "failed";
    console.error("[chatbot] send failed:", (err as Error).message);
  }
  await prisma.message.create({
    data: {
      tenantId: tenant.id,
      conversationId: conversation.id,
      direction: "outbound",
      type: "text",
      content: body,
      status,
      waMessageId,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
}

// Pick the flow that should respond to an inbound message, or null.
export function selectFlow(
  flows: ChatbotFlow[],
  text: string,
  isNewConversation: boolean,
): ChatbotFlow | null {
  const active = flows.filter((f) => f.active);
  const body = (text ?? "").trim().toLowerCase();

  // 1. Welcome flow on the very first message of a conversation.
  if (isNewConversation) {
    const welcome = active.find((f) => f.trigger === "welcome");
    if (welcome) return welcome;
  }

  // 2. Keyword + booking flows — highest priority match wins.
  const keywordMatches = active
    .filter((f) => f.trigger === "keyword" || f.trigger === "booking")
    .filter((f) =>
      f.keywords.some((k) => {
        const kw = k.trim().toLowerCase();
        if (!kw) return false;
        return f.matchType === "exact" ? body === kw : body.includes(kw);
      }),
    )
    .sort((a, b) => b.priority - a.priority);
  if (keywordMatches.length) return keywordMatches[0];

  // 3. Default fallback flow.
  return active.find((f) => f.trigger === "default") ?? null;
}

// If the conversation is mid-booking, interpret the reply as a slot choice.
// Returns true if the message was consumed (so the normal chatbot is skipped).
export async function handlePendingBooking(
  tenant: Tenant,
  conversation: Conversation,
  contact: Contact,
  text: string,
): Promise<boolean> {
  if (!conversation.pendingAction) return false;
  let pending: { type?: string; slots?: Slot[] };
  try {
    pending = JSON.parse(conversation.pendingAction);
  } catch {
    return false;
  }
  if (pending.type !== "booking" || !pending.slots) return false;

  const choice = parseSlotChoice(text, pending.slots);
  const creds = resolveCredentials(tenant);

  // Unrecognized reply — clear the pending state and let normal flow proceed.
  if (!choice) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { pendingAction: null },
    });
    return false;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { pendingAction: null },
  });

  if (choice.cancel) {
    if (creds) await sendAndLog(tenant, conversation, creds, contact.waPhone, "No problem — booking cancelled. 👍");
    return true;
  }

  const slot = choice.slot!;
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      contactId: contact.id,
      slotStart: new Date(slot.start),
      status: "booked",
    },
  });
  // Move the lead forward in the pipeline.
  await prisma.contact.update({
    where: { id: contact.id },
    data: { stage: "qualified", tags: { push: "wants-visit" } },
  });
  if (creds) {
    await sendAndLog(
      tenant,
      conversation,
      creds,
      contact.waPhone,
      `✅ Booked! Your visit is confirmed for ${slot.label}. See you then!`,
    );
  }
  return true;
}

// Evaluate the tenant's chatbot flows against an inbound message and, if one
// matches, send the auto-reply and log it. Returns the flow that fired (or null).
export async function runChatbot(params: {
  tenant: Tenant;
  conversation: Conversation;
  contact: Contact;
  text: string;
  isNewConversation: boolean;
}): Promise<ChatbotFlow | null> {
  const { tenant, conversation, contact, text, isNewConversation } = params;

  const flows = await prisma.chatbotFlow.findMany({
    where: { tenantId: tenant.id, active: true },
  });
  if (flows.length === 0) return null;

  const flow = selectFlow(flows, text, isNewConversation);
  if (!flow) return null;

  const creds = resolveCredentials(tenant);

  // Booking flow: offer slots and remember we're awaiting a choice.
  if (flow.trigger === "booking") {
    const slots = generateSlots();
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { pendingAction: JSON.stringify({ type: "booking", slots }) },
    });
    if (creds) {
      try {
        await sendAndLog(tenant, conversation, creds, contact.waPhone, slotsMessage(slots));
      } catch (err) {
        console.error("[chatbot] booking prompt failed:", (err as Error).message);
      }
    }
    return flow;
  }

  // Handoff flows route the conversation to a human instead of chatting on.
  if (flow.handoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "pending" },
    });
  }

  if (!creds) return flow; // matched, but can't send without credentials

  // Inbound just (re)opened the 24h service window, so a free text reply is
  // allowed here.
  try {
    await sendAndLog(tenant, conversation, creds, contact.waPhone, flow.responseText);
  } catch (err) {
    console.error("[chatbot] auto-reply failed:", (err as Error).message);
  }

  return flow;
}
