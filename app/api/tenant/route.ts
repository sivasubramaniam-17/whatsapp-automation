import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET current tenant (the caller's company).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
  });
  if (!tenant) return fail("Tenant not found", 404);

  return ok({
    id: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    whatsapp: {
      connected: Boolean(tenant.phoneNumberId),
      wabaId: tenant.wabaId,
      phoneNumberId: tenant.phoneNumberId,
      // never return the access token
    },
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
});

// PATCH — update company details or connect the WhatsApp Cloud API account.
// (Owner/admin only.)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "agent") return fail("Forbidden", 403);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: parsed.data,
  });

  return ok({
    id: tenant.id,
    name: tenant.name,
    whatsapp: { connected: Boolean(tenant.phoneNumberId) },
  });
}
