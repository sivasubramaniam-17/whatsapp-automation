import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import { enrollContacts } from "@/lib/sequences";
import { segmentWhere } from "@/lib/broadcast";

export const runtime = "nodejs";

// POST /api/sequences/:id/enroll — enroll contacts by ids or by segment.
const schema = z.object({
  contactIds: z.array(z.string()).optional(),
  segmentTags: z.array(z.string()).optional(),
  segmentStages: z.array(z.string()).optional(),
  optInOnly: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const seq = await prisma.sequence.findUnique({ where: { id: params.id } });
  if (!seq || seq.tenantId !== auth.tenantId) return fail("Sequence not found", 404);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  let contactIds = d.contactIds ?? [];
  if (contactIds.length === 0) {
    const contacts = await prisma.contact.findMany({
      where: segmentWhere(auth.tenantId, {
        segmentTags: d.segmentTags ?? [],
        segmentStages: d.segmentStages ?? [],
        optInOnly: d.optInOnly ?? true,
      }),
      select: { id: true },
    });
    contactIds = contacts.map((c) => c.id);
  }
  if (contactIds.length === 0) return fail("No contacts matched", 400);

  const enrolled = await enrollContacts(seq.id, contactIds);
  return ok({ enrolled });
}
