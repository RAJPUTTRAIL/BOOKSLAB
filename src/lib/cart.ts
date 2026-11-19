import "server-only";
import { connectDB } from "@/lib/mongo";
import { Book, Cart, isId, type BookDoc, type CartDoc } from "@/lib/models";
import { getBooksByIds } from "@/lib/catalog";
import { HttpError } from "@/lib/auth/session";
import { MAX_LINE_QTY, cartKey, type CartItem } from "@/lib/cart-types";

/**
 * Per-user cart stored in MongoDB. Every function takes the userId from the verified session —
 * never from the request body — so one account can never read or change another's cart.
 * All writes are single atomic updates, so rapid clicks can't lose items.
 */

const match = (bookId: string, kit: boolean) => ({ bookId, kit });

/** Read the cart, refreshed against the live catalog (current price, cover, weekly offers). Deleted books drop out. */
export async function getCart(userId: string): Promise<CartItem[]> {
  await connectDB();
  const cart = await Cart.findOne({ userId }).lean<CartDoc>();
  const lines = cart?.items ?? [];
  if (!lines.length) return [];
  const books = await getBooksByIds([...new Set(lines.map((l) => String(l.bookId)))]);
  return lines.flatMap((l) => {
    const b = books.find((x) => x.id === String(l.bookId));
    if (!b) return [];
    const kit = !!l.kit;
    return [{ key: cartKey(b.id, kit), bookId: b.id, slug: b.slug, title: b.title, author: b.author, price: b.price, mrp: b.mrp, coverImage: b.coverImage, category: b.category, digital: b.digital, qty: l.quantity, kit }];
  });
}

async function bookSnapshot(bookId: string) {
  if (!isId(bookId)) throw new HttpError(404, "Book not found.");
  const b = await Book.findById(bookId).select("title author discountedPrice coverImage").lean<BookDoc>();
  if (!b) throw new HttpError(404, "Book not found.");
  return { title: b.title, author: b.author, price: b.discountedPrice, coverImage: b.coverImage ?? "" };
}

/** Add `quantity` to a line (mode "add") or set it exactly (mode "set"; 0 removes the line). */
export async function upsertLine(userId: string, input: { bookId: string; kit: boolean; quantity: number; mode: "add" | "set" }) {
  await connectDB();
  const { bookId, kit, mode } = input;
  if (mode === "set" && input.quantity <= 0) return removeLine(userId, bookId, kit);
  const snap = await bookSnapshot(bookId);
  const qty = Math.min(MAX_LINE_QTY, Math.max(1, input.quantity));

  for (let attempt = 0; attempt < 3; attempt++) {
    // 1) The line exists → increment / set it in place.
    const r = await Cart.updateOne(
      { userId, items: { $elemMatch: match(bookId, kit) } },
      mode === "add"
        ? { $inc: { "items.$.quantity": qty }, $set: { "items.$.title": snap.title, "items.$.author": snap.author, "items.$.price": snap.price, "items.$.coverImage": snap.coverImage } }
        : { $set: { "items.$.quantity": qty, "items.$.title": snap.title, "items.$.author": snap.author, "items.$.price": snap.price, "items.$.coverImage": snap.coverImage } },
    );
    if (r.matchedCount) break;
    // 2) No such line → push it (creating the cart if needed). A concurrent push makes the
    //    filter miss and the upsert collide on the unique userId; loop and take path 1.
    try {
      const p = await Cart.updateOne(
        { userId, items: { $not: { $elemMatch: match(bookId, kit) } } },
        { $push: { items: { bookId, kit, quantity: qty, ...snap } } },
        { upsert: true },
      );
      if (p.matchedCount || p.upsertedCount) break;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
  // Keep every line within the per-line limit after an increment.
  await Cart.updateOne({ userId }, { $min: { "items.$[over].quantity": MAX_LINE_QTY } }, { arrayFilters: [{ "over.quantity": { $gt: MAX_LINE_QTY } }] });
  return getCart(userId);
}

export async function removeLine(userId: string, bookId: string, kit: boolean) {
  await connectDB();
  if (isId(bookId)) await Cart.updateOne({ userId }, { $pull: { items: match(bookId, kit) } });
  return getCart(userId);
}

export async function clearCart(userId: string) {
  await connectDB();
  await Cart.updateOne({ userId }, { $set: { items: [] } });
  return [] as CartItem[];
}

/** Fold a guest cart into the account once (quantities add up, capped per line). */
export async function mergeGuestCart(userId: string, lines: { bookId: string; kit: boolean; quantity: number }[]) {
  for (const l of lines) {
    if (!isId(l.bookId)) continue;
    try {
      await upsertLine(userId, { ...l, mode: "add" });
    } catch (e) {
      if (!(e instanceof HttpError)) throw e; // a guest line for a deleted book is simply dropped
    }
  }
  return getCart(userId);
}
