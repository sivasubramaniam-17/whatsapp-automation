import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/contacts — list with search / tag / stage filters + pagination.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search")?.trim();
  const tag = sp.get("tag")?.trim();
  const stage = sp.get("stage")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 25)));

  const where: Prisma.ContactWhereInput = { tenantId: auth.tenantId };
  if (stage) where.stage = stage;
  if (tag) where.tags = { has: tag };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { waPhone: { contains: search } },
    ];
  }

  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({ total, page, pageSize, contacts });
}

// POST /api/contacts — create a single contact.
const createSchema = z.object({
  waPhone: z.string().min(5).regex(/^\d+$/, "waPhone must be digits only (E.164 without +)"),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stage: z.enum(["new", "contacted", "qualified", "won", "lost"]).optional(),
  optIn: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    const contact = await prisma.contact.create({
      data: { tenantId: auth.tenantId, ...parsed.data },
    });
    return ok(contact, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("A contact with this phone number already exists", 409);
    }
    throw e;
  }
}
