import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/contacts/stats — total, per-stage counts, opt-in count, all tags.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const [total, optedIn, byStage, tagRows] = await Promise.all([
    prisma.contact.count({ where: { tenantId: auth.tenantId } }),
    prisma.contact.count({ where: { tenantId: auth.tenantId, optIn: true } }),
    prisma.contact.groupBy({
      by: ["stage"],
      where: { tenantId: auth.tenantId },
      _count: true,
    }),
    prisma.contact.findMany({
      where: { tenantId: auth.tenantId },
      select: { tags: true },
    }),
  ]);

  const stages = Object.fromEntries(byStage.map((s) => [s.stage, s._count]));
  const tagCounts: Record<string, number> = {};
  for (const { tags } of tagRows) {
    for (const t of tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }

  return ok({ total, optedIn, stages, tags: tagCounts });
}
