import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/appointments — upcoming + past bookings for the tenant.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { slotStart: "asc" },
    include: { contact: { select: { name: true, waPhone: true } } },
    take: 200,
  });
  return ok({ appointments });
}
