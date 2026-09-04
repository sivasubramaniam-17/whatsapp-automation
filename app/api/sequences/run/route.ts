import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { runDueSequences } from "@/lib/sequences";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/sequences/run — process all due drip steps across tenants.
// Auth: either a Bearer token (owner/admin, for manual "run now") OR the
// CRON_SECRET (for the scheduler, e.g. Vercel Cron).
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const isCron = !!cronSecret && provided === cronSecret;
  const claims = await getAuth(req);
  const isOwner = claims && claims.role !== "agent";

  if (!isCron && !isOwner) return fail("Unauthorized", 401);

  const report = await runDueSequences();
  return ok(report);
}

// Vercel Cron sends GET requests — support both.
export async function GET(req: NextRequest) {
  return POST(req);
}
