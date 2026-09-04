// Feature #7 — automated follow-up sequences (drip). A scheduler hits
// /api/sequences/run periodically; this processes all due enrollments.

import { prisma } from "./prisma";
import { resolveCredentials, sendTextMessage, sendTemplateMessage } from "./whatsapp";

export interface SequenceStep {
  delayHours: number;
  type: "text" | "template";
  text?: string;
  templateName?: string;
  languageCode?: string;
}

// Enroll a set of contacts into a sequence (first step due after step[0].delay).
export async function enrollContacts(
  sequenceId: string,
  contactIds: string[],
): Promise<number> {
  const seq = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!seq) return 0;
  const steps = seq.steps as unknown as SequenceStep[];
  const firstDelay = steps[0]?.delayHours ?? 0;
  const nextRunAt = new Date(Date.now() + firstDelay * 3600_000);

  let count = 0;
  for (const contactId of contactIds) {
    try {
      await prisma.sequenceEnrollment.create({
        data: { sequenceId, contactId, currentStep: 0, nextRunAt, status: "active" },
      });
      count++;
    } catch {
      // already enrolled (unique constraint) — skip
    }
  }
  return count;
}

// Process every enrollment whose next step is due. Returns a small report.
export async function runDueSequences(now: Date = new Date()) {
  const due = await prisma.sequenceEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: now } },
    include: { sequence: { include: { tenant: true } }, contact: true },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const enr of due) {
    if (!enr.sequence.active) continue;
    const steps = enr.sequence.steps as unknown as SequenceStep[];
    const step = steps[enr.currentStep];
    if (!step) {
      await prisma.sequenceEnrollment.update({
        where: { id: enr.id },
        data: { status: "completed" },
      });
      completed++;
      continue;
    }

    const creds = resolveCredentials(enr.sequence.tenant);
    if (creds) {
      try {
        if (step.type === "template" && step.templateName) {
          await sendTemplateMessage(
            creds,
            enr.contact.waPhone,
            step.templateName,
            step.languageCode ?? "en_US",
          );
        } else if (step.text) {
          await sendTextMessage(creds, enr.contact.waPhone, step.text);
        }
        sent++;
      } catch {
        failed++;
      }
    }

    // Advance to the next step (or complete).
    const nextIndex = enr.currentStep + 1;
    if (nextIndex >= steps.length) {
      await prisma.sequenceEnrollment.update({
        where: { id: enr.id },
        data: { status: "completed", currentStep: nextIndex },
      });
      completed++;
    } else {
      const delay = steps[nextIndex].delayHours ?? 0;
      await prisma.sequenceEnrollment.update({
        where: { id: enr.id },
        data: {
          currentStep: nextIndex,
          nextRunAt: new Date(now.getTime() + delay * 3600_000),
        },
      });
    }
  }

  return { processed: due.length, sent, failed, completed };
}
