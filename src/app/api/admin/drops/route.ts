import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Book, Drop, isId } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";

const schema = z.object({
  bookId: z.string().min(1, "Pick a book"),
  discountPct: z.coerce.number().int().min(1).max(90),
  hours: z.coerce.number().min(1).max(24 * 30),
  label: z.string().trim().min(2).max(30).default("This week"),
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const d = schema.parse(await req.json());
  await connectDB();
  if (!isId(d.bookId) || !(await Book.exists({ _id: d.bookId }))) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  await Drop.updateMany({ bookId: d.bookId, active: true }, { $set: { active: false } });
  const drop = await Drop.create({ bookId: d.bookId, discountPct: d.discountPct, label: d.label, endsAt: new Date(Date.now() + d.hours * 3600_000) });
  return NextResponse.json({ ok: true, drop: { id: String(drop._id), endsAt: drop.endsAt.toISOString() } });
});
