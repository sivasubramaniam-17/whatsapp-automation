import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import { campaignStats } from "@/lib/broadcast";

export const runtime = "nodejs";

// GET /api/campaigns/:id — campaign detail + live delivery report.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
  });
  if (!campaign || campaign.tenantId !== auth.tenantId) {
    return fail("Campaign not found", 404);
  }

  const stats = await campaignStats(campaign.id);
  return ok({ campaign, stats });
}

// DELETE /api/campaigns/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
  });
  if (!campaign || campaign.tenantId !== auth.tenantId) {
    return fail("Campaign not found", 404);
  }
  await prisma.campaign.delete({ where: { id: campaign.id } });
  return ok({ deleted: true });
}
