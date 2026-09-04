import type { ChatbotFlow, Contact, Conversation, Tenant } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveCredentials, sendTextMessage } from "./whatsapp";

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

  // 2. Keyword flows — highest priority match wins.
  const keywordMatches = active
    .filter((f) => f.trigger === "keyword")
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

  // Handoff flows route the conversation to a human instead of chatting on.
  if (flow.handoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "pending" },
    });
  }

  const creds = resolveCredentials(tenant);
  if (!creds) return flow; // matched, but can't send without credentials

  // Inbound just (re)opened the 24h service window, so a free text reply is
  // allowed here.
  try {
    const sent = await sendTextMessage(creds, contact.waPhone, flow.responseText);
    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        conversationId: conversation.id,
        direction: "outbound",
        type: "text",
        content: flow.responseText,
        status: "sent",
        waMessageId: sent.waMessageId,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  } catch (err) {
    console.error("[chatbot] auto-reply failed:", (err as Error).message);
  }

  return flow;
}
