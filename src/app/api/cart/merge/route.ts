import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart";
import { MAX_LINE_QTY } from "@/lib/cart-types";

const schema = z.object({
  items: z.array(z.object({ bookId: z.string().min(1), kit: z.boolean().default(false), quantity: z.number().int().min(1).max(MAX_LINE_QTY) })).max(50),
});

/** Called once right after sign-in with the guest cart from this browser; returns the merged cart. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { items } = schema.parse(await req.json());
  return NextResponse.json({ items: await mergeGuestCart(user.id, items) });
});
