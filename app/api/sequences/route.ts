import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/sequences — list drip sequences with enrollment counts.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const sequences = await prisma.sequence.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });
  return ok({ sequences });
}

// POST /api/sequences — create a drip sequence.
const stepSchema = z.object({
  delayHours: z.number().min(0),
  type: z.enum(["text", "template"]).default("text"),
  text: z.string().optional(),
  templateName: z.string().optional(),
  languageCode: z.string().optional(),
});
const schema = z.object({
  name: z.string().min(1),
  steps: z.array(stepSchema).min(1),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const sequence = await prisma.sequence.create({
    data: {
      tenantId: auth.tenantId,
      name: parsed.data.name,
      active: parsed.data.active ?? true,
      steps: parsed.data.steps,
    },
  });
  return ok(sequence, 201);
}
