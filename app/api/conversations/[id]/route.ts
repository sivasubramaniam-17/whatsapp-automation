import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/conversations/:id — full message thread for the inbox.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation || conversation.tenantId !== auth.tenantId) {
    return fail("Conversation not found", 404);
  }

  const windowOpen =
    !!conversation.windowExpiresAt &&
    conversation.windowExpiresAt.getTime() > Date.now();

  return ok({ conversation, windowOpen });
}

// PATCH /api/conversations/:id — update status (e.g. close, reopen, assign).
const schema = z.object({
  status: z.enum(["open", "pending", "closed"]).optional(),
  assignedUserId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
  });
  if (!conversation || conversation.tenantId !== auth.tenantId) {
    return fail("Conversation not found", 404);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: parsed.data,
  });
  return ok(updated);
}
