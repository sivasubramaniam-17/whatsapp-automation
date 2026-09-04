import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import { segmentWhere } from "@/lib/broadcast";

export const runtime = "nodejs";

// GET /api/campaigns — list campaigns for the tenant.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return ok({ campaigns });
}

// POST /api/campaigns — create a draft broadcast.
const schema = z.object({
  name: z.string().min(1),
  templateName: z.string().min(1),
  languageCode: z.string().optional(),
  components: z.array(z.any()).optional(),
  segmentTags: z.array(z.string()).optional(),
  segmentStages: z.array(z.string()).optional(),
  optInOnly: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: auth.tenantId,
      name: d.name,
      templateName: d.templateName,
      languageCode: d.languageCode ?? "en_US",
      components: d.components ?? undefined,
      segmentTags: d.segmentTags ?? [],
      segmentStages: d.segmentStages ?? [],
      optInOnly: d.optInOnly ?? true,
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
    },
  });

  // How many contacts this segment currently matches (a preview count).
  const audience = await prisma.contact.count({
    where: segmentWhere(auth.tenantId, {
      segmentTags: campaign.segmentTags,
      segmentStages: campaign.segmentStages,
      optInOnly: campaign.optInOnly,
    }),
  });

  return ok({ campaign, audience }, 201);
}
