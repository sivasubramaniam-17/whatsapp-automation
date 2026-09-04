import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

// Registering creates a new tenant (company) AND its first owner user.
const schema = z.object({
  companyName: z.string().min(1),
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { companyName, name, email, password } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: companyName } });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        name,
        role: "owner",
      },
    });
    return { tenant, user };
  });

  const token = await signToken({
    userId: result.user.id,
    tenantId: result.tenant.id,
    role: result.user.role,
  });

  return ok(
    {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: { id: result.tenant.id, name: result.tenant.name },
    },
    201,
  );
}
