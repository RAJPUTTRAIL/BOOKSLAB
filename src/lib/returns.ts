import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Book, Order, isId, type OrderDoc } from "@/lib/models";
import { HttpError } from "@/lib/auth/session";
import { PREPAID_METHODS, RETURN_FLOW, RETURN_REASONS, RETURN_TYPES, type PaymentMethod } from "@/lib/constants";
import { deliveredOn, orderDTO } from "@/lib/orders";
import { newReference, refundPayment } from "@/lib/payments";
import { RETURN_WINDOW_DAYS } from "@/lib/constants";

const isPhysical = (f?: string | null) => f === "Paperback" || f === "Hardcover" || !f;
const PROOF = /^\/uploads\/returns\/[\w-]+\.(jpe?g|png|webp|avif)$/i;

export const returnInput = z.object({
  requestType: z.enum(RETURN_TYPES),
  items: z.array(z.object({ bookId: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1, "Select at least one book"),
  reason: z.enum(RETURN_REASONS),
  description: z.string().trim().max(500).default(""),
  proofImages: z.array(z.string().regex(PROOF, "Upload the photos again")).min(1, "Add at least one photo").max(3, "Up to 3 photos"),
}).refine((d) => d.reason !== "Other" || d.description.length >= 5, { message: "Please describe the problem", path: ["description"] });

/** Customer: open a return / replacement request on their own Delivered order (within 7 days). */
export async function createReturn(userId: string, orderId: string, raw: unknown) {
  if (!isId(orderId)) throw new HttpError(404, "Order not found.");
  const input = returnInput.parse(raw);
  await connectDB();
  const order = await Order.findOne({ _id: orderId, userId }).lean<OrderDoc>();
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status !== "Delivered") throw new HttpError(400, "Returns can be requested once the order has been delivered.");
  if (order.returnRequest) throw new HttpError(409, "A return or replacement has already been requested for this order.");
  if (deliveredOn(order).getTime() + RETURN_WINDOW_DAYS * 86400_000 < Date.now()) throw new HttpError(400, "The 7-day return window for this order has closed.");

  // Every selected line must be a physical book on this order, within the ordered quantity.
  const items = input.items.map((sel) => {
    const lines = (order.items ?? []).filter((i) => String(i.bookId) === sel.bookId && isPhysical(i.format));
    const ordered = lines.reduce((s, i) => s + i.quantity, 0);
    if (!lines.length) throw new HttpError(400, "One of the selected books isn't on this order (or is digital).");
    if (sel.quantity > ordered) throw new HttpError(400, `You ordered ${ordered} of "${lines[0].title}".`);
    return { bookId: lines[0].bookId, title: lines[0].title, quantity: sel.quantity, price: lines[0].price };
  });

  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, userId, status: "Delivered", returnRequest: null },
    { $set: { returnRequest: { ...input, items, status: "Requested", adminNote: "", requestedAt: now, resolvedAt: null, history: [{ status: "Requested", note: "", at: now }] } } },
    { new: true },
  ).lean<OrderDoc>();
  if (!updated) throw new HttpError(409, "A return or replacement has already been requested for this order.");
  return orderDTO(updated);
}

/**
 * Admin: move a request along its flow and attach a note for the customer.
 * Completing a request applies stock / refund effects exactly once (the status change is conditional).
 */
export async function updateReturn(orderId: string, input: { status: string; adminNote?: string; resellable?: boolean }) {
  if (!isId(orderId)) throw new HttpError(404, "Request not found.");
  await connectDB();
  const order = await Order.findById(orderId).lean<OrderDoc>();
  const rr = order?.returnRequest;
  if (!order || !rr) throw new HttpError(404, "Request not found.");
  const from = rr.status ?? "Requested";
  const note = (input.adminNote ?? rr.adminNote ?? "").trim();
  if (from === "Completed" || from === "Rejected") throw new HttpError(409, `This request is already ${from.toLowerCase()} and can't be changed.`);
  if (input.status === from) {
    // note-only update
    const u = await Order.findOneAndUpdate({ _id: orderId, "returnRequest.status": from }, { $set: { "returnRequest.adminNote": note } }, { new: true }).lean<OrderDoc>();
    return orderDTO(u!);
  }
  if (!(RETURN_FLOW[from] ?? []).includes(input.status)) throw new HttpError(400, `A request that is "${from}" can't be moved to "${input.status}".`);
  if (input.status === "Rejected" && note.length < 5) throw new HttpError(400, "Add a note explaining why the request was rejected.");

  const completing = input.status === "Completed";
  const replacement = rr.requestType === "Replacement";
  const lines = (rr.items ?? []).filter((i) => i.bookId && isId(String(i.bookId)));

  // Replacement: the new copies leave stock. Reserve them first (conditional), so we never go negative.
  const reserved: typeof lines = [];
  if (completing && replacement) {
    for (const l of lines) {
      const r = await Book.updateOne({ _id: l.bookId, stock: { $gte: l.quantity ?? 1 } }, { $inc: { stock: -(l.quantity ?? 1) } });
      if (!r.modifiedCount) {
        for (const x of reserved) await Book.updateOne({ _id: x.bookId }, { $inc: { stock: x.quantity ?? 1 } });
        throw new HttpError(409, `Not enough stock of "${l.title}" to send a replacement. Restock it first.`);
      }
      reserved.push(l);
    }
  }

  const now = new Date();
  const refundAmount = completing && !replacement ? lines.reduce((s, l) => s + (l.price ?? 0) * (l.quantity ?? 1), 0) : 0;
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, "returnRequest.status": from },
    {
      $set: {
        "returnRequest.status": input.status,
        "returnRequest.adminNote": note,
        ...(completing || input.status === "Rejected" ? { "returnRequest.resolvedAt": now } : {}),
        ...(completing && !replacement ? { "returnRequest.resellable": !!input.resellable, "returnRequest.refundAmount": refundAmount } : {}),
      },
      $push: { "returnRequest.history": { status: input.status, note, at: now } },
    },
    { new: true },
  ).lean<OrderDoc>();
  if (!updated) {
    for (const x of reserved) await Book.updateOne({ _id: x.bookId }, { $inc: { stock: x.quantity ?? 1 } }); // someone else moved it first
    throw new HttpError(409, "This request changed meanwhile — refresh and try again.");
  }

  if (completing && !replacement) {
    // Returned copies go back on sale only if the admin marked them resellable.
    if (input.resellable) for (const l of lines) await Book.updateOne({ _id: l.bookId }, { $inc: { stock: l.quantity ?? 1 } });
    // Refund what was paid for the returned books (online → gateway; cash → store refund reference).
    if (updated.paymentStatus === "Paid") {
      const online = PREPAID_METHODS.includes(updated.paymentMethod as PaymentMethod);
      const { refundId } = online ? await refundPayment({ transactionId: updated.transactionId ?? null, amount: refundAmount }) : { refundId: newReference("RFND") };
      const refunded = await Order.findOneAndUpdate({ _id: orderId, paymentStatus: "Paid" }, { $set: { paymentStatus: "Refunded", refundId, refundedAt: now } }, { new: true }).lean<OrderDoc>();
      if (refunded) return orderDTO(refunded);
    }
  }
  return orderDTO(updated);
}
