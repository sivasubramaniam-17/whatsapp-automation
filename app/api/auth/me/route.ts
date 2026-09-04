import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { tenant: true },
  });
  if (!user) return fail("User not found", 404);

  return ok({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      plan: user.tenant.plan,
      whatsappConnected: Boolean(user.tenant.phoneNumberId),
    },
  });
}
