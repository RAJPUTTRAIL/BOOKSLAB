import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Drop, isId } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const { active } = z.object({ active: z.boolean() }).parse(await req.json());
  if (!isId(id)) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  await connectDB();
  const r = await Drop.updateOne({ _id: id }, { $set: { active } });
  if (!r.matchedCount) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  if (isId(id)) {
    await connectDB();
    await Drop.deleteOne({ _id: id });
  }
  return NextResponse.json({ ok: true });
});
