import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Book } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { bookInput } from "@/lib/book-schema";
import { listBooks } from "@/lib/catalog";
import { slugify } from "@/lib/utils";

export const GET = handle(async () => {
  await requireAdmin();
  return NextResponse.json({ books: await listBooks({}, 500, { updatedAt: -1 }) });
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const b = bookInput.parse(await req.json());
  await connectDB();
  if (await Book.exists({ isbn: b.isbn })) return NextResponse.json({ error: "A book with this ISBN already exists." }, { status: 409 });
  let slug = slugify(`${b.title} ${b.year}`);
  if (await Book.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
  const book = await Book.create({
    ...b, slug, samplePages: [`## ${b.title}\n\n${b.edition} • ${b.year}\n${b.publisher}`, `## About this book\n\n${b.description}`],
  });
  return NextResponse.json({ ok: true, book: { id: String(book._id), slug: book.slug } });
});
