import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { logSecurity } from "@/lib/security-log";

export async function POST() {
  const s = await getSession();
  if (s) await logSecurity("LOGOUT", { userId: s.sub, identifier: s.name }).catch(() => {});
  await destroySession();
  return NextResponse.json({ ok: true });
}
