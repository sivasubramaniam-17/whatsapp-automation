import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";
import { runCampaign, campaignStats } from "@/lib/broadcast";

export const runtime = "nodejs";
// Vercel Hobby caps function duration at 60s. At ~250ms/message that's roughly
// 200 recipients per send. For larger broadcasts, upgrade the plan or move
// sending to a background queue (see DEPLOYMENT.md).
export const maxDuration = 60;

// POST /api/campaigns/:id/send — send the broadcast now.
export async function POST(
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
  if (campaign.status === "sending") {
    return fail("Campaign is already sending", 409);
  }
  if (campaign.status === "completed") {
    return fail("Campaign has already been sent", 409);
  }

  // Simple in-process sender: runs the send loop, then returns the report.
  await runCampaign(campaign.id);

  const [updated, stats] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaign.id } }),
    campaignStats(campaign.id),
  ]);

  return ok({ campaign: updated, stats });
}
