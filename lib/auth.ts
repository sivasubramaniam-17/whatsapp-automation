import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
);
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";

export interface AuthClaims {
  userId: string;
  tenantId: string;
  role: string;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: String(payload.userId),
      tenantId: String(payload.tenantId),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

// Pull the bearer token from a request and return the claims, or null.
export async function getAuth(req: NextRequest): Promise<AuthClaims | null> {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return verifyToken(token);
}
