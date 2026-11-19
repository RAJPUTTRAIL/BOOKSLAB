import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { clearCart, getCart, removeLine, upsertLine } from "@/lib/cart";
import { MAX_LINE_QTY } from "@/lib/cart-types";

/** The signed-in user's cart. The user always comes from the session cookie, never the request. */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ items: await getCart(user.id) }, { headers: { "Cache-Control": "no-store" } });
});

const upsert = z.object({
  bookId: z.string().min(1),
  kit: z.boolean().default(false),
  quantity: z.number().int().min(0).max(MAX_LINE_QTY),
  mode: z.enum(["add", "set"]).default("add"),
});

/** Add to a line ("add") or set its quantity ("set"; 0 removes it). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = upsert.parse(await req.json());
  return NextResponse.json({ items: await upsertLine(user.id, body) });
});

/** DELETE /api/cart?bookId=…&kit=1 removes one line; DELETE /api/cart (no params) clears the cart. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");
  const items = bookId ? await removeLine(user.id, bookId, url.searchParams.get("kit") === "1") : await clearCart(user.id);
  return NextResponse.json({ items });
});
