import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, requireAuth } from "@/lib/http";

export const runtime = "nodejs";

// POST /api/contacts/import
// Body accepts EITHER:
//   { "contacts": [{ waPhone, name?, tags?, stage?, optIn? }, ...] }
//   { "csv": "phone,name,tags\n15551234567,John,vip;buyer\n..." }
// Existing contacts (same phone) are updated, not duplicated.

const rowSchema = z.object({
  waPhone: z.string(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  stage: z.string().optional(),
  optIn: z.boolean().optional(),
});

const bodySchema = z.object({
  contacts: z.array(rowSchema).optional(),
  csv: z.string().optional(),
  defaultOptIn: z.boolean().optional(), // apply to rows that omit optIn
});

// Keep only digits — turns "+1 (555) 123-4567" into "15551234567".
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function parseCsv(csv: string): z.infer<typeof rowSchema>[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    phone: headers.findIndex((h) => ["phone", "waphone", "number", "mobile"].includes(h)),
    name: headers.findIndex((h) => h === "name"),
    tags: headers.findIndex((h) => h === "tags"),
    stage: headers.findIndex((h) => h === "stage"),
  };
  const rows: z.infer<typeof rowSchema>[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const phone = idx.phone >= 0 ? cols[idx.phone] : cols[0];
    if (!phone) continue;
    rows.push({
      waPhone: phone,
      name: idx.name >= 0 ? cols[idx.name] || undefined : undefined,
      tags:
        idx.tags >= 0 && cols[idx.tags]
          ? cols[idx.tags].split(/[;|]/).map((t) => t.trim()).filter(Boolean)
          : undefined,
      stage: idx.stage >= 0 ? cols[idx.stage] || undefined : undefined,
    });
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const rows = parsed.data.contacts ?? (parsed.data.csv ? parseCsv(parsed.data.csv) : []);
  if (rows.length === 0) return fail("No contacts to import (provide 'contacts' or 'csv')");

  let created = 0;
  let updated = 0;
  const skipped: { row: unknown; reason: string }[] = [];

  for (const row of rows) {
    const waPhone = normalizePhone(row.waPhone);
    if (waPhone.length < 5) {
      skipped.push({ row, reason: "invalid phone" });
      continue;
    }
    const existing = await prisma.contact.findUnique({
      where: { tenantId_waPhone: { tenantId: auth.tenantId, waPhone } },
      select: { id: true },
    });

    const data = {
      name: row.name,
      tags: row.tags ?? [],
      stage: row.stage ?? "new",
      optIn: row.optIn ?? parsed.data.defaultOptIn ?? false,
    };

    if (existing) {
      await prisma.contact.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.contact.create({ data: { tenantId: auth.tenantId, waPhone, ...data } });
      created++;
    }
  }

  return ok({ imported: created + updated, created, updated, skipped }, 201);
}
