import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Book, Drop, User, isId, type BookDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { bookInput } from "@/lib/book-schema";
import { removeUnusedUploads } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Book not found." }, { status: 404 });

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  if (!isId(id)) return notFound();
  const b = bookInput.parse(await req.json());
  await connectDB();
  const before = await Book.findById(id).lean<BookDoc>();
  if (!before) return notFound();
  if (await Book.exists({ isbn: b.isbn, _id: { $ne: id } })) return NextResponse.json({ error: "Another book already uses this ISBN." }, { status: 409 });
  await Book.updateOne({ _id: id }, { $set: b }, { runValidators: true });
  await removeUnusedUploads([before.coverImage, ...(before.galleryImages ?? [])]);
  return NextResponse.json({ ok: true, book: { id, slug: before.slug } });
});

/** Orders keep a snapshot of each item (title, ISBN, price), so order history and invoices survive deletion. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  if (!isId(id)) return notFound();
  await connectDB();
  const book = await Book.findByIdAndDelete(id).lean<BookDoc>();
  if (!book) return notFound();
  await Promise.all([Drop.deleteMany({ bookId: id }), User.updateMany({ readingList: id }, { $pull: { readingList: id } })]);
  await removeUnusedUploads([book.coverImage, ...(book.galleryImages ?? [])]);
  return NextResponse.json({ ok: true });
});
