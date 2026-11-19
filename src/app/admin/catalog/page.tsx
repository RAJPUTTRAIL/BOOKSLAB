import { connectDB } from "@/lib/mongo";
import { Book, type BookDoc } from "@/lib/models";
import { CatalogManager, type AdminBook } from "./manager";

export const metadata = { title: "Catalog & inventory" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ new?: string; title?: string; author?: string; isbn?: string }> }) {
  const { new: openNew, title, author, isbn } = await searchParams;
  await connectDB();
  const rows = await Book.find().sort({ updatedAt: -1 }).lean<BookDoc[]>();
  const books: AdminBook[] = rows.map((b) => ({
    id: String(b._id), slug: b.slug, title: b.title, subtitle: b.subtitle ?? "", author: b.author, publisher: b.publisher ?? "", isbn: b.isbn,
    category: b.category, subcategory: b.subcategory ?? "", format: b.format ?? "Paperback", mrp: b.mrp, discountedPrice: b.discountedPrice,
    edition: b.edition, year: b.year ?? 2026, pages: b.pages ?? 0, stock: b.stock ?? 0, description: b.description,
    coverImage: b.coverImage ?? "", galleryImages: [...(b.galleryImages ?? [])], tags: [...(b.tags ?? [])], isFeatured: !!b.isFeatured, cpPickup: b.cpPickup !== false,
  }));
  const prefill = openNew === "1" && (title || author || isbn) ? { title: (title ?? "").slice(0, 200), author: (author ?? "").slice(0, 120), isbn: (isbn ?? "").replace(/[^\dXx]/g, "") } : undefined;
  return <CatalogManager initial={books} openNew={openNew === "1"} prefill={prefill} />;
}
