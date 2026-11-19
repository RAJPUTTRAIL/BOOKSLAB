import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { BookRequest, type BookRequestDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { bookRequestDTO } from "@/lib/book-requests";
import { DELIVERY_TYPES } from "@/lib/constants";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({
  customerName: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, "").replace(/^0/, ""))
    .refine((s) => /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit mobile number — we'll confirm on WhatsApp or by call")
    .transform((s) => `+91${s}`),
  email: z.string().trim().max(120).refine((s) => s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s), "Enter a valid email address").default(""),
  bookTitle: z.string().trim().min(2, "Enter the book title").max(200),
  authorOrPublisher: z.string().trim().max(120).default(""),
  isbn: z.string().transform((s) => s.replace(/[-\s]/g, "")).refine((s) => s === "" || /^(\d{9}[\dXx]|\d{13})$/.test(s), "ISBN should be 10 or 13 digits").default(""),
  editionOrYear: z.string().trim().max(60).default(""),
  quantity: z.coerce.number().int().min(1, "At least 1 copy").max(50, "For more than 50 copies, call the store").default(1),
  preferredFulfillment: z.enum(DELIVERY_TYPES).default("CP Store Pickup"),
  notes: z.string().trim().max(500).default(""),
  website: z.string().max(0, "Something went wrong.").optional(), // honeypot — real visitors never fill it
});

/** Public: anyone can ask the CP sourcing desk for a title. Linked to the account when signed in. */
export const POST = handle(async (req: Request) => {
  const body = schema.parse(await req.json());
  const user = await getCurrentUser().catch(() => null);
  await connectDB();
  // Light spam guard: at most 5 requests per phone number per hour.
  const recent = await BookRequest.countDocuments({ phone: body.phone, createdAt: { $gte: new Date(Date.now() - 3600_000) } });
  if (recent >= 5) return NextResponse.json({ error: "You've sent several requests in the last hour — our team will get back to you on those first." }, { status: 429 });
  const { website: _hp, ...data } = body;
  const doc = await BookRequest.create({ ...data, email: data.email || null, userId: user?.id ?? null });
  await logSecurity("BOOK_REQUESTED", { userId: user?.id ?? null, identifier: body.phone, detail: `${body.quantity}× ${body.bookTitle}` });
  return NextResponse.json({ ok: true, request: bookRequestDTO(doc.toObject() as BookRequestDoc) });
});

/** Signed-in customer: their own requests, newest first. */
export const GET = handle(async () => {
  const user = await requireUser();
  await connectDB();
  const rows = await BookRequest.find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).lean<BookRequestDoc[]>();
  return NextResponse.json({ requests: rows.map(bookRequestDTO) }, { headers: { "Cache-Control": "no-store" } });
});
