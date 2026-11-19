import "server-only";
import { headers } from "next/headers";
import { connectDB } from "@/lib/mongo";
import { SecurityLog, isId } from "@/lib/models";

export async function logSecurity(event: string, opts: { userId?: string | null; identifier?: string | null; detail?: string } = {}) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  } catch {}
  try {
    await connectDB();
    await SecurityLog.create({ event, userId: isId(opts.userId) ? opts.userId : null, identifier: opts.identifier ?? null, detail: opts.detail ?? null, ip });
  } catch {}
}
