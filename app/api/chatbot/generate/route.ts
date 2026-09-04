import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ok, fail, requireAuth } from "@/lib/http";
import { generateFlowsSmart } from "@/lib/flowGen";

export const runtime = "nodejs";

// POST /api/chatbot/generate — turn plain English into draft flows.
// Returns drafts for the user to review; saving uses POST /api/chatbot/flows.
const schema = z.object({ instruction: z.string().min(3) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const drafts = await generateFlowsSmart(parsed.data.instruction);
  if (drafts.length === 0) {
    return fail(
      "Couldn't parse that. Try: \"If someone asks about price, tell them our 2BHK starts at 45L.\"",
    );
  }
  return ok({ drafts });
}
