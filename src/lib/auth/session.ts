import "server-only";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongo";
import { User, isId, type UserDoc } from "@/lib/models";
import { SESSION_COOKIE, SESSION_TTL_SEC, signToken, verifyToken, type SessionPayload } from "./jwt";

const cookieBase = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function createSession(user: { id: string; role: string; name: string; tokenVersion?: number | null }) {
  const token = await signToken(
    { sub: user.id, id: user.id, role: user.role === "admin" ? "admin" : "customer", name: user.name, v: user.tokenVersion ?? 0 },
    SESSION_TTL_SEC,
    "session",
  );
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL_SEC });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete("bl_2fa_pending"); // cookie from the retired two-step flow
}

export async function getSession() {
  return verifyToken<SessionPayload>((await cookies()).get(SESSION_COOKIE)?.value, "session");
}

export type AppUser = UserDoc & { id: string };

/** Load a user as a plain object with a string `id`. */
export async function findUserById(id: string): Promise<AppUser | null> {
  if (!isId(id)) return null;
  await connectDB();
  const u = await User.findById(id).lean<UserDoc>();
  return u ? { ...u, id: String(u._id) } : null;
}

/** Full user record for the current session (or null). */
export async function getCurrentUser() {
  const s = await getSession();
  if (!s) return null;
  const user = await findUserById(s.sub);
  // A password reset/change bumps tokenVersion, so cookies issued before it stop working.
  if (!user || (user.tokenVersion ?? 0) !== (s.v ?? 0)) return null;
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Admins only.");
  return user;
}
