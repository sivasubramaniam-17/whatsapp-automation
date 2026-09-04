import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import { scoreConversationSmart } from "@/lib/leadScore";

export const runtime = "nodejs";

// POST /api/conversations/:id/analyze — score the lead from the conversation
// and update the contact (leadScore, summary, merged tags, suggested stage).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      messages: { where: { direction: "inbound" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation || conversation.tenantId !== auth.tenantId) {
    return fail("Conversation not found", 404);
  }

  const inbound = conversation.messages.map((m) => m.content ?? "").filter(Boolean);
  if (inbound.length === 0) {
    return fail("No customer messages to analyze yet", 400);
  }

  const result = await scoreConversationSmart(inbound);

  const mergedTags = [...new Set([...conversation.contact.tags, ...result.tags])];
  const contact = await prisma.contact.update({
    where: { id: conversation.contactId },
    data: {
      leadScore: result.leadScore,
      leadSummary: result.summary,
      tags: mergedTags,
      stage: result.suggestedStage,
    },
  });

  return ok({
    leadScore: contact.leadScore,
    summary: contact.leadSummary,
    tags: contact.tags,
    stage: contact.stage,
  });
}
