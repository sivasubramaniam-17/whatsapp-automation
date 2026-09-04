import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveCredentials, sendTemplateMessage } from "./whatsapp";

// Build the Prisma filter for a campaign's target segment.
export function segmentWhere(
  tenantId: string,
  opts: { segmentTags: string[]; segmentStages: string[]; optInOnly: boolean },
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { tenantId };
  if (opts.segmentTags.length) where.tags = { hasSome: opts.segmentTags };
  if (opts.segmentStages.length) where.stage = { in: opts.segmentStages };
  if (opts.optInOnly) where.optIn = true;
  return where;
}

const SEND_DELAY_MS = 250; // simple pacing to respect WhatsApp rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run a broadcast: materialize recipients from the segment, then send the
// template to each one, tracking per-recipient delivery status.
// This is the simple in-process sender (no Redis). Swap for a BullMQ worker
// when volume grows — the recipient rows already model a durable queue.
export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { tenant: true },
  });
  if (!campaign) return;

  const creds = resolveCredentials(campaign.tenant);
  if (!creds) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "failed", finishedAt: new Date() },
    });
    return;
  }

  // Resolve the segment and create pending recipient rows (skip if re-run).
  const contacts = await prisma.contact.findMany({
    where: segmentWhere(campaign.tenantId, {
      segmentTags: campaign.segmentTags,
      segmentStages: campaign.segmentStages,
      optInOnly: campaign.optInOnly,
    }),
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "sending", startedAt: new Date(), total: contacts.length },
  });

  for (const contact of contacts) {
    const recipient = await prisma.campaignRecipient.create({
      data: {
        campaignId,
        contactId: contact.id,
        waPhone: contact.waPhone,
        status: "pending",
      },
    });

    try {
      const sent = await sendTemplateMessage(
        creds,
        contact.waPhone,
        campaign.templateName,
        campaign.languageCode,
        (campaign.components as unknown[]) ?? undefined,
      );
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "sent", waMessageId: sent.waMessageId },
      });
    } catch (err) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "failed", error: (err as Error).message.slice(0, 500) },
      });
    }

    await sleep(SEND_DELAY_MS);
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed", finishedAt: new Date() },
  });
}

// Count recipients by status for a campaign (delivery report).
export async function campaignStats(campaignId: string) {
  const rows = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: true,
  });
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count]));
  return {
    pending: byStatus.pending ?? 0,
    sent: byStatus.sent ?? 0,
    delivered: byStatus.delivered ?? 0,
    read: byStatus.read ?? 0,
    failed: byStatus.failed ?? 0,
  };
}
