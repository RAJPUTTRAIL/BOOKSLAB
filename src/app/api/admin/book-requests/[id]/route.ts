import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { BookRequest, isId, type BookRequestDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { bookRequestDTO } from "@/lib/book-requests";
import { BOOK_REQUEST_STATUSES } from "@/lib/constants";
import { logSecurity } from "@/lib/security-log";

const schema = z
  .object({
    status: z.enum(BOOK_REQUEST_STATUSES),
    estimatedPrice: z.coerce.number().int("Use whole rupees").min(1, "Enter the price in ₹").max(100000).nullable().optional(),
    adminReply: z.string().trim().max(500).default(""),
  })
  .refine((d) => d.status !== "Available at Store" || (d.estimatedPrice ?? 0) > 0, { message: "Quote a price (₹) when marking it Available at Store.", path: ["estimatedPrice"] });

/** Admin: update status, quoted price and the reply shown to the customer. */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const body = schema.parse(await req.json());
  await connectDB();
  const doc = await BookRequest.findByIdAndUpdate(
    id,
    { $set: { status: body.status, adminReply: body.adminReply, ...(body.estimatedPrice !== undefined ? { estimatedPrice: body.estimatedPrice } : {}) } },
    { new: true, runValidators: true },
  ).lean<BookRequestDoc>();
  if (!doc) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  await logSecurity("BOOK_REQUEST_UPDATED", { userId: admin.id, identifier: admin.email ?? admin.phone, detail: `${doc.bookTitle}: ${doc.status}${doc.estimatedPrice ? ` @ ₹${doc.estimatedPrice}` : ""}` });
  return NextResponse.json({ ok: true, request: bookRequestDTO(doc) });
});
