import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

async function getOwned(tenantId: string, id: string) {
  const flow = await prisma.chatbotFlow.findUnique({ where: { id } });
  if (!flow || flow.tenantId !== tenantId) return null;
  return flow;
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  trigger: z.enum(["welcome", "keyword", "default", "booking"]).optional(),
  keywords: z.array(z.string()).optional(),
  matchType: z.enum(["contains", "exact"]).optional(),
  responseText: z.string().min(1).optional(),
  handoff: z.boolean().optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

// PATCH /api/chatbot/flows/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const flow = await getOwned(auth.tenantId, params.id);
  if (!flow) return fail("Flow not found", 404);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const updated = await prisma.chatbotFlow.update({
    where: { id: flow.id },
    data: parsed.data,
  });
  return ok(updated);
}

// DELETE /api/chatbot/flows/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const flow = await getOwned(auth.tenantId, params.id);
  if (!flow) return fail("Flow not found", 404);

  await prisma.chatbotFlow.delete({ where: { id: flow.id } });
  return ok({ deleted: true });
}
