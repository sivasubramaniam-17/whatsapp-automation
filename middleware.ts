import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Add permissive CORS headers to all /api/* routes so browser clients on other
// origins (e.g. the Flutter web app on a different localhost port) can call the
// API. Auth is via Bearer token (no cookies), so "*" origin is safe here.
export function middleware(req: NextRequest) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
