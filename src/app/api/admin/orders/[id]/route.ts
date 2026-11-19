import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Order, isId, type OrderDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { ORDER_STATUSES } from "@/lib/order-status";
import { cancelOrder, editPayment, markCollected, orderDTO } from "@/lib/orders";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { logSecurity } from "@/lib/security-log";

const schema = z.union([
  z.object({ status: z.enum(ORDER_STATUSES), reason: z.string().trim().max(300).optional() }),
  z.object({ paymentStatus: z.literal("Paid") }), // quick "Mark as Paid": cash / UPI / card collected for COD or Pay-at-Store
  z.object({
    payment: z.object({
      status: z.enum(PAYMENT_STATUSES).optional(),
      method: z.enum(PAYMENT_METHODS).optional(),
      transactionId: z.string().trim().max(64).regex(/^[A-Za-z0-9._\/-]*$/, "Transaction IDs may use letters, numbers, - _ . /").nullable().optional(),
    }),
  }),
]);

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = schema.parse(await req.json());
  if (!isId(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if ("paymentStatus" in body) return NextResponse.json({ ok: true, order: await markCollected(id) });
  if ("payment" in body) {
    const { before, after } = await editPayment(id, body.payment);
    await logSecurity("PAYMENT_EDITED", { userId: admin.id, identifier: admin.email ?? admin.phone, detail: `${after.orderNumber}: ${before.payment.method}/${before.payment.status}/${before.payment.transactionId ?? "—"} → ${after.payment.method}/${after.payment.status}/${after.payment.transactionId ?? "—"}` });
    return NextResponse.json({ ok: true, order: after });
  }
  const { status, reason } = body;
  await connectDB();
  const order = await Order.findById(id).lean<OrderDoc>();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "Cancelled") return NextResponse.json({ error: "Cancelled orders can't be reopened." }, { status: 400 });
  if (order.status === "Delivered") return NextResponse.json({ error: "Delivered orders can't be changed." }, { status: 400 });
  if (status === order.status) return NextResponse.json({ ok: true, order: orderDTO(order) });

  if (status === "Cancelled") {
    const updated = await cancelOrder({ orderId: id, by: "admin", reason: reason || "Cancelled by the store" });
    return NextResponse.json({ ok: true, order: updated });
  }
  if (status === "Placed") return NextResponse.json({ error: "An order can't be moved back to Placed." }, { status: 400 });
  if (status === "Ready at CP Store" && order.deliveryType !== "CP Store Pickup") return NextResponse.json({ error: "Only pickup orders can be marked Ready at CP Store." }, { status: 400 });
  if (status === "Out for Delivery" && order.deliveryType !== "Home Delivery") return NextResponse.json({ error: "Pickup orders don't go out for delivery." }, { status: 400 });

  // Conditional on the status we just read, so a concurrent customer cancellation wins cleanly.
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: order.status },
    { $set: { status, ...(status === "Delivered" ? { deliveredAt: new Date() } : {}) } }, // starts the 7-day return window
    { new: true },
  ).lean<OrderDoc>();
  if (!updated) return NextResponse.json({ error: "This order changed meanwhile — refresh and try again." }, { status: 409 });
  return NextResponse.json({ ok: true, order: orderDTO(updated) });
});
