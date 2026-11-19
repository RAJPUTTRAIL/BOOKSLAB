// Client-safe cart types and limits (shared by the API and <Providers>).

export const MAX_LINE_QTY = 20;

export type CartItem = {
  key: string; // `${bookId}:${kit ? "kit" : "single"}`
  bookId: string;
  slug: string;
  title: string;
  author: string;
  price: number;
  mrp: number;
  coverImage: string;
  category: string;
  digital: boolean;
  qty: number;
  kit: boolean;
};

export const cartKey = (bookId: string, kit: boolean) => `${bookId}:${kit ? "kit" : "single"}`;

/** Browser keys. Only a *guest* cart / saved list ever lives in the browser; signed-in data lives in MongoDB. */
export const GUEST_CART_KEY = "bookslab_guest_cart";
export const GUEST_SAVED_KEY = "bookslab_guest_saved";
/** Pre-fix keys that were shared by every account on the browser — always deleted. */
export const LEGACY_KEYS = ["bl_cart_v2", "bl_saved_v2", "bl_cart", "bl_saved"];
