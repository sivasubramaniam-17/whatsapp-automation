import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/chatbot/flows — list the tenant's auto-reply rules.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const flows = await prisma.chatbotFlow.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ trigger: "asc" }, { priority: "desc" }],
  });
  return ok({ flows });
}

// POST /api/chatbot/flows — create an auto-reply rule.
const schema = z
  .object({
    name: z.string().min(1),
    trigger: z.enum(["welcome", "keyword", "default", "booking"]).default("keyword"),
    keywords: z.array(z.string()).optional(),
    matchType: z.enum(["contains", "exact"]).optional(),
    // Booking flows reply with slot options instead of responseText, so the
    // text is optional for them.
    responseText: z.string().min(1).optional(),
    handoff: z.boolean().optional(),
    priority: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) => !["keyword", "booking"].includes(d.trigger) || (d.keywords?.length ?? 0) > 0,
    { message: "keyword/booking flows require at least one keyword", path: ["keywords"] },
  )
  .refine((d) => d.trigger === "booking" || (d.responseText?.length ?? 0) > 0, {
    message: "responseText is required",
    path: ["responseText"],
  });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const flow = await prisma.chatbotFlow.create({
    data: {
      tenantId: auth.tenantId,
      name: d.name,
      trigger: d.trigger,
      keywords: d.keywords ?? [],
      matchType: d.matchType ?? "contains",
      // Booking flows send slot options, not responseText.
      responseText: d.responseText ?? "",
      handoff: d.handoff ?? false,
      priority: d.priority ?? 0,
      active: d.active ?? true,
    },
  });
  return ok(flow, 201);
}
