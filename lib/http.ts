import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth, type AuthClaims } from "./auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Guard a route handler: returns the auth claims or a 401 response.
export async function requireAuth(
  req: NextRequest,
): Promise<AuthClaims | NextResponse> {
  const claims = await getAuth(req);
  if (!claims) return fail("Unauthorized", 401);
  return claims;
}
