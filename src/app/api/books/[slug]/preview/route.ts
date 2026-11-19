import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Book } from "@/lib/models";
import { handle } from "@/lib/api";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  await connectDB();
  const book = await Book.findOne({ slug }).select("samplePages title galleryImages").lean();
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ title: book.title, pages: (book.samplePages ?? []).slice(0, 10), images: book.galleryImages ?? [] });
});
