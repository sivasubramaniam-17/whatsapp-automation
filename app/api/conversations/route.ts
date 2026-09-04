import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/conversations — inbox list: conversations with contact + last message.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const status = req.nextUrl.searchParams.get("status"); // open|pending|closed

  const conversations = await prisma.conversation.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      contact: { select: { id: true, name: true, waPhone: true, stage: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const list = conversations.map((c) => ({
    id: c.id,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    windowExpiresAt: c.windowExpiresAt,
    contact: c.contact,
    lastMessage: c.messages[0]
      ? { direction: c.messages[0].direction, content: c.messages[0].content }
      : null,
  }));

  return ok({ conversations: list });
}
