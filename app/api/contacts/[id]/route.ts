import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// Ensure the contact belongs to the caller's tenant.
async function getOwned(tenantId: string, id: string) {
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact || contact.tenantId !== tenantId) return null;
  return contact;
}

// GET /api/contacts/:id — contact detail + its conversations.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const contact = await getOwned(auth.tenantId, params.id);
  if (!contact) return fail("Contact not found", 404);

  const conversations = await prisma.conversation.findMany({
    where: { contactId: contact.id },
    orderBy: { lastMessageAt: "desc" },
  });

  return ok({ ...contact, conversations });
}

// PATCH /api/contacts/:id — update name / tags / stage / optIn.
const updateSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stage: z.enum(["new", "contacted", "qualified", "won", "lost"]).optional(),
  optIn: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const contact = await getOwned(auth.tenantId, params.id);
  if (!contact) return fail("Contact not found", 404);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: parsed.data,
  });
  return ok(updated);
}

// DELETE /api/contacts/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const contact = await getOwned(auth.tenantId, params.id);
  if (!contact) return fail("Contact not found", 404);

  await prisma.contact.delete({ where: { id: contact.id } });
  return ok({ deleted: true });
}
