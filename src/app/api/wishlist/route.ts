import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Book, User, isId } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getBooksByIds } from "@/lib/catalog";

/** The signed-in user's saved-for-later list (newest first). */
export const GET = handle(async () => {
  const user = await requireUser();
  const ids = (user.readingList ?? []).map(String).reverse();
  const books = await getBooksByIds(ids);
  return NextResponse.json({ books: ids.map((id) => books.find((b) => b.id === id)).filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
});

const schema = z.union([
  z.object({ bookId: z.string().min(1), on: z.boolean() }),
  z.object({ merge: z.array(z.string()).max(100) }), // guest saved list, folded in once after sign-in
]);

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  await connectDB();
  if ("merge" in body) {
    const ids = body.merge.filter(isId);
    const existing = (await Book.find({ _id: { $in: ids } }).select("_id").lean()).map((b) => b._id);
    if (existing.length) await User.updateOne({ _id: user.id }, { $addToSet: { readingList: { $each: existing } } });
    return NextResponse.json({ ok: true });
  }
  const { bookId, on } = body;
  if (!isId(bookId)) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  if (!on) {
    await User.updateOne({ _id: user.id }, { $pull: { readingList: bookId } });
    return NextResponse.json({ ok: true });
  }
  if (!(await Book.exists({ _id: bookId }))) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  await User.updateOne({ _id: user.id }, { $addToSet: { readingList: bookId } });
  return NextResponse.json({ ok: true });
});
