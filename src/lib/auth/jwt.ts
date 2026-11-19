// Edge-safe JWT helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bl_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { sub: string; role: "customer" | "admin"; name: string; id: string; v?: number };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters long");
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: Record<string, unknown>, ttlSec: number, audience: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(audience)
    .setIssuer("bookslab")
    .setExpirationTime(`${ttlSec}s`)
    .sign(key());
}

export async function verifyToken<T>(token: string | undefined, audience: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience, issuer: "bookslab" });
    return payload as T;
  } catch {
    return null;
  }
}
