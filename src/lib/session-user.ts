import "server-only";
import { getCurrentUser } from "@/lib/auth/session";

export type SessionUser = {
  id: string;
  name: string;
  identifier: string;
  role: "customer" | "admin";
} | null;

export async function getSessionUser(): Promise<SessionUser> {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return null;
  return { id: u.id, name: u.name, identifier: u.email ?? u.phone ?? "", role: u.role === "admin" ? "admin" : "customer" };
}
