import "server-only";
import type { FilterQuery, SortOrder } from "mongoose";
import { connectDB } from "@/lib/mongo";
import { Book, Drop, isId, type BookDoc, type DropDoc } from "@/lib/models";
import { effectivePrice } from "@/lib/pricing";
import { categoryByKey, categoryByValue, type FilterKey } from "@/lib/categories";
import { escapeRegex } from "@/lib/utils";

export type BookDTO = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  categoryKey: string;
  subcategory: string;
  format: string;
  mrp: number;
  discountedPrice: number;
  price: number; // effective selling price (weekly-offer aware)
  edition: string;
  year: number;
  pages: number;
  stock: number;
  rating: number;
  reviews: number;
  description: string;
  coverImage: string;
  galleryImages: string[];
  tags: string[];
  isFeatured: boolean;
  cpPickup: boolean;
  digital: boolean;
  drop: { id: string; discountPct: number; endsAt: string; label: string } | null;
};

export const isDigitalFormat = (format: string) => format === "E-book" || format === "Subscription";

export function toDTO(b: BookDoc, live: DropDoc | null = null): BookDTO {
  return {
    id: String(b._id), slug: b.slug, title: b.title, subtitle: b.subtitle ?? "", author: b.author, publisher: b.publisher ?? "", isbn: b.isbn,
    category: b.category, categoryKey: categoryByValue(b.category)?.key ?? "all", subcategory: b.subcategory ?? "", format: b.format ?? "Paperback",
    mrp: b.mrp, discountedPrice: b.discountedPrice, price: effectivePrice({ mrp: b.mrp, price: b.discountedPrice }, live),
    edition: b.edition, year: b.year ?? 0, pages: b.pages ?? 0, stock: b.stock ?? 0, rating: b.rating ?? 0, reviews: b.reviews ?? 0,
    description: b.description, coverImage: b.coverImage ?? "", galleryImages: [...(b.galleryImages ?? [])], tags: [...(b.tags ?? [])],
    isFeatured: !!b.isFeatured, cpPickup: b.cpPickup !== false, digital: isDigitalFormat(b.format ?? ""),
    drop: live ? { id: String(live._id), discountPct: live.discountPct, endsAt: live.endsAt.toISOString(), label: live.label ?? "" } : null,
  };
}

/** Attach each book's live weekly offer (one query for the whole list). */
async function withDrops(books: BookDoc[]) {
  if (!books.length) return [];
  const drops = await Drop.find({ bookId: { $in: books.map((b) => b._id) }, active: true, endsAt: { $gt: new Date() } }).lean<DropDoc[]>();
  return books.map((b) => toDTO(b, drops.find((d) => String(d.bookId) === String(b._id)) ?? null));
}

type Sort = Record<string, SortOrder>;

export async function listBooks(filter: FilterQuery<BookDoc> = {}, limit = 60, sort: Sort = { createdAt: -1 }) {
  await connectDB();
  return withDrops(await Book.find(filter).sort(sort).limit(limit).lean<BookDoc[]>());
}

export async function getBookBySlug(slug: string) {
  await connectDB();
  const b = await Book.findOne({ slug }).lean<BookDoc>();
  return b ? (await withDrops([b]))[0] : null;
}

export async function getBooksByIds(ids: string[]) {
  await connectDB();
  const valid = ids.filter(isId);
  return valid.length ? withDrops(await Book.find({ _id: { $in: valid } }).lean<BookDoc[]>()) : [];
}

export function filterFor(key: FilterKey): FilterQuery<BookDoc> {
  if (key === "pickup") return { cpPickup: true, stock: { $gt: 0 }, format: { $in: ["Paperback", "Hardcover"] } };
  const cat = categoryByKey(key);
  return cat ? { category: cat.value } : {};
}

export async function searchBooks(q: string, key: FilterKey) {
  const filter: FilterQuery<BookDoc> = { ...filterFor(key) };
  const term = q.trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = [
      { title: rx }, { author: rx }, { subtitle: rx }, { subcategory: rx }, { tags: rx }, { publisher: rx },
      { isbn: new RegExp(escapeRegex(term.replace(/[-\s]/g, ""))) },
    ];
  }
  return listBooks(filter, 80, { isFeatured: -1, rating: -1 });
}

export async function activeDrops() {
  await connectDB();
  const drops = await Drop.find({ active: true, endsAt: { $gt: new Date() } }).sort({ endsAt: 1 }).lean<DropDoc[]>();
  const books = await Book.find({ _id: { $in: drops.map((d) => d.bookId) } }).lean<BookDoc[]>();
  return drops.flatMap((d) => {
    const b = books.find((x) => String(x._id) === String(d.bookId));
    return b ? [{ id: String(d._id), discountPct: d.discountPct, endsAt: d.endsAt.toISOString(), label: d.label ?? "", book: toDTO(b, d) }] : [];
  });
}
