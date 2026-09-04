import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  });
  // Same error whether the user is missing or the password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Invalid email or password", 401);
  }

  const token = await signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return ok({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: user.tenant.id, name: user.tenant.name },
  });
}
