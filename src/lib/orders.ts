import "server-only";
import { connectDB } from "@/lib/mongo";
import { Book, Order, isId, type OrderDoc } from "@/lib/models";
import { HttpError } from "@/lib/auth/session";
import { CUSTOMER_CANCELLABLE, PREPAID_METHODS, RETURN_WINDOW_DAYS, type PaymentMethod } from "@/lib/constants";
import { newReference, refundPayment } from "@/lib/payments";

export type ReturnRequestDTO = {
  requestType: string;
  items: { bookId: string | null; title: string; quantity: number; price: number }[];
  reason: string;
  description: string;
  proofImages: string[];
  status: string;
  adminNote: string;
  requestedAt: string;
  resolvedAt: string | null;
  resellable: boolean;
  refundAmount: number;
  history: { status: string; note: string; at: string }[];
};

export type OrderItemDTO = { bookId: string | null; title: string; price: number; quantity: number; isbn: string; format: string; kit: boolean };
export type OrderDTO = {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItemDTO[];
  totalAmount: number;
  subtotal: number;
  bundleDiscount: number;
  deliveryFee: number;
  deliveryType: string;
  shippingAddress: { line: string; pincode: string; phone: string };
  status: string;
  etaText: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdAt: string;
  codFee: number;
  deliveredAt: string | null;
  /** 7-day return window for Delivered orders (null when not applicable). */
  returnWindow: { open: boolean; closesAt: string } | null;
  returnRequest: ReturnRequestDTO | null;
  payment: {
    method: PaymentMethod;
    status: string; // Pending | Paid | Failed | Refunded
    upiId: string | null;
    transactionId: string | null;
    card: { brand: string; last4: string } | null;
    paidAt: string | null;
    refundId: string | null;
    refundedAt: string | null;
  };
};

export function orderDTO(o: OrderDoc): OrderDTO {
  return {
    id: String(o._id), orderNumber: o.orderNumber, userId: String(o.userId),
    items: (o.items ?? []).map((it) => ({ bookId: it.bookId ? String(it.bookId) : null, title: it.title, price: it.price, quantity: it.quantity, isbn: it.isbn ?? "", format: it.format ?? "Paperback", kit: !!it.kit })),
    totalAmount: o.totalAmount, subtotal: o.subtotal, bundleDiscount: o.bundleDiscount ?? 0, deliveryFee: o.deliveryFee ?? 0,
    deliveryType: o.deliveryType, shippingAddress: { line: o.shippingAddress?.line ?? "", pincode: o.shippingAddress?.pincode ?? "", phone: o.shippingAddress?.phone ?? "" },
    status: o.status ?? "Placed", etaText: o.etaText ?? "", cancellationReason: o.cancellationReason ?? null,
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null, cancelledBy: o.cancelledBy ?? null,
    createdAt: (o as unknown as { createdAt: Date }).createdAt.toISOString(),
    codFee: o.codFee ?? 0,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    returnWindow: returnWindowOf(o),
    returnRequest: o.returnRequest ? returnDTO(o.returnRequest) : null,
    payment: {
      method: (o.paymentMethod ?? "COD") as PaymentMethod, status: o.paymentStatus ?? "Pending", upiId: o.upiId ?? null, transactionId: o.transactionId ?? null,
      card: o.cardLast4 ? { brand: o.cardBrand ?? "Card", last4: o.cardLast4 } : null,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null, refundId: o.refundId ?? null, refundedAt: o.refundedAt ? o.refundedAt.toISOString() : null,
    },
  };
}

const isPhysical = (format: string) => format === "Paperback" || format === "Hardcover";

/** When delivery happened: deliveredAt, or (for older orders) updatedAt / createdAt. */
export function deliveredOn(o: OrderDoc) {
  const x = o as unknown as { updatedAt?: Date; createdAt: Date };
  return o.deliveredAt ?? x.updatedAt ?? x.createdAt;
}
function returnWindowOf(o: OrderDoc) {
  if (o.status !== "Delivered" || !(o.items ?? []).some((i) => isPhysical(i.format ?? "Paperback"))) return null;
  const closesAt = new Date(deliveredOn(o).getTime() + RETURN_WINDOW_DAYS * 86400_000);
  return { open: closesAt.getTime() > Date.now(), closesAt: closesAt.toISOString() };
}
type RawReturn = NonNullable<OrderDoc["returnRequest"]>;
function returnDTO(r: RawReturn): ReturnRequestDTO {
  return {
    requestType: r.requestType, reason: r.reason, description: r.description ?? "", proofImages: [...(r.proofImages ?? [])],
    items: (r.items ?? []).map((i) => ({ bookId: i.bookId ? String(i.bookId) : null, title: i.title ?? "", quantity: i.quantity ?? 1, price: i.price ?? 0 })),
    status: r.status ?? "Requested", adminNote: r.adminNote ?? "", requestedAt: (r.requestedAt ?? new Date()).toISOString(), resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    resellable: !!r.resellable, refundAmount: r.refundAmount ?? 0,
    history: (r.history ?? []).map((h) => ({ status: h.status ?? "", note: h.note ?? "", at: (h.at ?? new Date()).toISOString() })),
  };
}

/**
 * Reserve stock for every physical line with conditional decrements (`stock >= qty`), so two shoppers
 * can never oversell the last copy. If any line fails, the lines already reserved are put back.
 * Works on a standalone MongoDB too (no multi-document transaction needed).
 */
export async function reserveStock(lines: { bookId: string; title: string; quantity: number; format: string }[]) {
  await connectDB();
  const done: typeof lines = [];
  for (const l of lines) {
    if (!isPhysical(l.format)) continue;
    const r = await Book.updateOne({ _id: l.bookId, stock: { $gte: l.quantity } }, { $inc: { stock: -l.quantity } });
    if (!r.modifiedCount) {
      await restoreStock(done);
      throw new HttpError(409, `"${l.title}" just went out of stock.`);
    }
    done.push(l);
  }
}

/** Put quantities back into stock (books that were deleted meanwhile are skipped). */
export async function restoreStock(items: ReadonlyArray<{ bookId?: unknown; quantity: number; format?: string | null }>) {
  await connectDB();
  for (const it of items) {
    const id = it.bookId ? String(it.bookId) : "";
    if (isId(id) && isPhysical(it.format ?? "Paperback")) await Book.updateOne({ _id: id }, { $inc: { stock: it.quantity } });
  }
}

/**
 * Cancel an order and restock it. The status change is a single conditional update, so a double
 * click (or a customer and an admin cancelling at once) can only restock once.
 */
export async function cancelOrder(opts: { orderId: string; by: "customer" | "admin"; reason: string; userId?: string }) {
  if (!isId(opts.orderId)) throw new HttpError(404, "Order not found.");
  await connectDB();
  const allowed: readonly string[] = opts.by === "customer" ? CUSTOMER_CANCELLABLE : ["Placed", "Confirmed", "Ready at CP Store", "Out for Delivery"];
  const filter = { _id: opts.orderId, status: { $in: allowed }, ...(opts.userId ? { userId: opts.userId } : {}) };
  const order = await Order.findOneAndUpdate(
    filter,
    { $set: { status: "Cancelled", cancelledAt: new Date(), cancellationReason: opts.reason, cancelledBy: opts.by } },
    { new: true },
  ).lean<OrderDoc>();

  if (!order) {
    const existing = await Order.findOne({ _id: opts.orderId, ...(opts.userId ? { userId: opts.userId } : {}) }).select("status").lean<OrderDoc>();
    if (!existing) throw new HttpError(404, "Order not found.");
    if (existing.status === "Cancelled") throw new HttpError(409, "This order is already cancelled.");
    throw new HttpError(
      409,
      opts.by === "customer"
        ? `This order is "${existing.status}" and can no longer be cancelled online. Please call the CP store.`
        : `A ${existing.status.toLowerCase()} order can't be cancelled.`,
    );
  }
  await restoreStock(order.items ?? []);

  // Anything already paid is refunded: online payments to the original method through the gateway,
  // cash collected for COD / Pay-at-Store by the store (we record the refund reference).
  // Conditional on "Paid", so it happens once.
  if (order.paymentStatus === "Paid") {
    const online = PREPAID_METHODS.includes(order.paymentMethod as PaymentMethod);
    const { refundId } = online ? await refundPayment({ transactionId: order.transactionId ?? null, amount: order.totalAmount }) : { refundId: newReference("RFND") };
    const refunded = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: "Paid" },
      { $set: { paymentStatus: "Refunded", refundId, refundedAt: new Date() } },
      { new: true },
    ).lean<OrderDoc>();
    if (refunded) return orderDTO(refunded);
  }
  return orderDTO(order);
}

/** Staff record that cash / UPI / card was collected for a COD or Pay-at-Store order. */
export async function markCollected(orderId: string) {
  if (!isId(orderId)) throw new HttpError(404, "Order not found.");
  await connectDB();
  const current = await Order.findById(orderId).select("paymentMethod paymentStatus status").lean<OrderDoc>();
  if (!current) throw new HttpError(404, "Order not found.");
  if (current.paymentMethod !== "COD" && current.paymentMethod !== "PAY_AT_STORE") throw new HttpError(400, "Only Cash on Delivery and Pay at Store orders are marked paid by hand.");
  if (current.status === "Cancelled") throw new HttpError(400, "This order was cancelled — there's nothing to collect.");
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: "Pending", status: { $ne: "Cancelled" } },
    { $set: { paymentStatus: "Paid", paidAt: new Date(), transactionId: newReference(current.paymentMethod === "COD" ? "COD" : "STORE") } },
    { new: true },
  ).lean<OrderDoc>();
  if (!updated) throw new HttpError(409, "This order is already marked as paid.");
  return orderDTO(updated);
}

/** Admin: edit an order's payment record (status, method, transaction ID). */
export async function editPayment(orderId: string, input: { status?: string; method?: PaymentMethod; transactionId?: string | null }) {
  if (!isId(orderId)) throw new HttpError(404, "Order not found.");
  await connectDB();
  const current = await Order.findById(orderId).lean<OrderDoc>();
  if (!current) throw new HttpError(404, "Order not found.");
  const method = input.method ?? (current.paymentMethod as PaymentMethod);
  if (method === "COD" && current.deliveryType !== "Home Delivery") throw new HttpError(400, "Cash on Delivery only applies to Home Delivery orders.");
  if (method === "PAY_AT_STORE" && current.deliveryType !== "CP Store Pickup") throw new HttpError(400, "Pay at CP Store only applies to pickup orders.");
  const status = input.status ?? current.paymentStatus ?? "Pending";
  const $set: Record<string, unknown> = { paymentMethod: method, paymentStatus: status };
  if (input.transactionId !== undefined) $set.transactionId = input.transactionId || null;
  if (status === "Paid" && !current.paidAt) $set.paidAt = new Date();
  if (status === "Refunded" && !current.refundedAt) { $set.refundedAt = new Date(); if (!current.refundId) $set.refundId = newReference("RFND"); }
  if (method !== "UPI") $set.upiId = null;
  if (method !== "CARD") { $set.cardBrand = null; $set.cardLast4 = null; }
  const updated = await Order.findByIdAndUpdate(orderId, { $set }, { new: true }).lean<OrderDoc>();
  return { before: orderDTO(current), after: orderDTO(updated!) };
}
