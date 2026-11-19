import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { ActivitySession, isId } from "@/lib/models";
import { getSession } from "@/lib/auth/session";

const schema = z.object({ sid: z.string().min(8).max(64), seconds: z.number().int().min(1).max(60), path: z.string().max(200).optional() });

/** Session-time heartbeat for the admin "average session time" metric. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { sid, seconds, path } = parsed.data;
  try {
    const s = await getSession();
    await connectDB();
    await ActivitySession.updateOne(
      { _id: sid },
      { $inc: { seconds }, $set: { path: path ?? null, ...(s && isId(s.sub) ? { userId: s.sub } : {}) } },
      { upsert: true },
    );
  } catch {}
  return NextResponse.json({ ok: true });
}
