import { NextResponse, after } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Cart, Order, type OrderDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth/session";
import { getBooksByIds } from "@/lib/catalog";
import { computeTotals } from "@/lib/pricing";
import { estimateDelivery, pickupEta } from "@/lib/delivery";
import { STORE } from "@/lib/store-info";
import { logSecurity } from "@/lib/security-log";
import { sendEmail } from "@/lib/email";
import { orderConfirmationEmail } from "@/lib/email-templates";
import { orderDTO, reserveStock, restoreStock } from "@/lib/orders";
import { findAddress } from "@/lib/addresses";
import { captureOnlinePayment, refundPayment } from "@/lib/payments";
import { UPI_ID } from "@/lib/upi";
import { getPaymentSettings } from "@/lib/store-settings";
import { isEnabled } from "@/lib/payment-settings";
import { PAYMENT_LABEL } from "@/lib/constants";

const schema = z
  .object({
    items: z.array(z.object({ bookId: z.string(), quantity: z.number().int().min(1).max(20), kit: z.boolean().optional() })).min(1, "Your cart is empty").max(40),
    deliveryType: z.enum(["CP Store Pickup", "Home Delivery"]),
    addressId: z.string().optional(), // one of the customer's saved addresses (preferred for Home Delivery)
    pincode: z.string().optional(),
    address: z.string().max(300).optional(),
    phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number").optional(),
    payment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("UPI"), upiId: z.string().trim().toLowerCase().regex(UPI_ID, "Enter a valid UPI ID, like name@okicici").nullable().default(null) }),
      z.object({ method: z.literal("CARD"), card: z.object({ brand: z.string().max(20), last4: z.string().regex(/^\d{4}$/) }) }),
      z.object({ method: z.literal("COD") }),
      z.object({ method: z.literal("PAY_AT_STORE") }),
    ]),
    expectedTotal: z.number().int().min(0).optional(), // the amount the customer saw (and, for UPI, scanned)
  })
  .refine((d) => d.deliveryType === "CP Store Pickup" || !!d.addressId || (/^\d{6}$/.test(d.pincode ?? "") && (d.address ?? "").trim().length >= 8), {
    message: "Enter a 6-digit pincode and your full delivery address",
  })
  .refine((d) => !!d.addressId || !!d.phone, { message: "Enter a valid 10-digit mobile number" });

/** The signed-in customer's orders, newest first. */
export const GET = handle(async () => {
  const user = await requireUser();
  await connectDB();
  const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).lean<OrderDoc[]>();
  return NextResponse.json({ orders: orders.map(orderDTO) });
});

/** Place an order. Prices, discounts and delivery fees are always recomputed on the server. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  const books = await getBooksByIds([...new Set(body.items.map((i) => i.bookId))]);
  const lines = body.items.map((i) => {
    const b = books.find((x) => x.id === i.bookId);
    if (!b) throw new HttpError(409, "A book in your cart is no longer available.");
    return { book: b, quantity: i.quantity, kit: !!i.kit };
  });
  for (const b of books) {
    if (b.digital) continue;
    const need = lines.filter((l) => l.book.id === b.id).reduce((s, l) => s + l.quantity, 0);
    if (need > b.stock) return NextResponse.json({ error: b.stock ? `Only ${b.stock} left of "${b.title}".` : `"${b.title}" is out of stock.` }, { status: 409 });
  }
  const allDigital = lines.every((l) => l.book.digital);
  const deliveryType = allDigital ? "Home Delivery" : body.deliveryType;
  const pickup = deliveryType === "CP Store Pickup";
  // Payment method must fit how the order is fulfilled.
  const method = body.payment.method;
  if (method === "COD" && (pickup || allDigital)) return NextResponse.json({ error: allDigital ? "Digital orders are paid online (UPI or card)." : "Cash on Delivery is for Home Delivery — choose Pay at CP Store for pickup." }, { status: 400 });
  if (method === "PAY_AT_STORE" && !pickup) return NextResponse.json({ error: "Pay at CP Store is available for CP Store Pickup orders." }, { status: 400 });
  const settings = await getPaymentSettings();
  if (!isEnabled(settings, method)) return NextResponse.json({ error: `${PAYMENT_LABEL[method]} is currently unavailable. Please choose another payment method.` }, { status: 400 });

  const totals = computeTotals(
    lines.map((l) => ({ price: l.book.price, quantity: l.quantity, kit: l.kit, digital: l.book.digital })),
    { fulfillment: pickup ? "PICKUP" : "DELIVERY", paymentMethod: method, codFee: settings.codFee },
  );
  if (body.expectedTotal !== undefined && body.expectedTotal !== totals.total) {
    return NextResponse.json({ error: `Your total has changed to ₹${totals.total.toLocaleString("en-IN")} (a price or offer was updated). Please review and try again — nothing was charged.`, total: totals.total }, { status: 409 });
  }
  // A saved address is looked up on the server from the signed-in user's own list — never trusted from the client.
  const saved = !pickup && !allDigital && body.addressId ? await findAddress(user.id, body.addressId) : null;
  if (!pickup && !allDigital && body.addressId && !saved) return NextResponse.json({ error: "That delivery address no longer exists. Please choose another." }, { status: 400 });
  const rawPhone = saved?.phone ?? body.phone ?? "";
  const phone = rawPhone.startsWith("+91") ? rawPhone : `+91${rawPhone}`;
  const homeLine = saved ? `${saved.recipientName}, ${saved.street}, ${saved.city}, ${saved.state}` : (body.address ?? "").trim();
  const homePin = saved?.pincode ?? body.pincode ?? "";
  const eta = allDigital ? { label: "Instant — e-delivery" } : pickup ? pickupEta() : estimateDelivery(saved?.pincode ?? body.pincode ?? "");

  const reserve = lines.map((l) => ({ bookId: l.book.id, title: l.book.title, quantity: l.quantity, format: l.book.format }));
  await reserveStock(reserve);

  // Online payments are captured after stock is reserved and before the order is saved.
  let capture: { transactionId: string } | null = null;
  if (method === "UPI" || method === "CARD") {
    const r = await captureOnlinePayment(
      method === "UPI" ? { method, amount: totals.total, upiId: body.payment.method === "UPI" ? body.payment.upiId : null } : { method, amount: totals.total, card: (body.payment as { card: { brand: string; last4: string } }).card },
    ).catch(() => ({ ok: false as const, reason: "We couldn't reach the payment service. No money was taken." }));
    if (!r.ok) {
      await restoreStock(reserve);
      await logSecurity("PAYMENT_FAILED", { userId: user.id, identifier: user.email ?? user.phone, detail: `${method} ₹${totals.total}: ${r.reason}` });
      return NextResponse.json({ error: r.reason, paymentFailed: true }, { status: 402 });
    }
    capture = { transactionId: r.transactionId };
  }
  try {
    await connectDB();
    const count = await Order.estimatedDocumentCount();
    let order;
    for (let attempt = 0; ; attempt++) {
      try {
        order = await Order.create({
          orderNumber: `BL-CP-${1001 + count + attempt}-${Math.floor(Math.random() * 90 + 10)}`,
          userId: user.id, totalAmount: totals.total, subtotal: totals.subtotal, bundleDiscount: totals.bundleDiscount, deliveryFee: totals.deliveryFee, codFee: totals.codFee,
          paymentMethod: method, paymentStatus: capture ? "Paid" : "Pending", transactionId: capture?.transactionId ?? null, paidAt: capture ? new Date() : null,
          upiId: body.payment.method === "UPI" ? body.payment.upiId : null,
          cardBrand: body.payment.method === "CARD" ? body.payment.card.brand : null, cardLast4: body.payment.method === "CARD" ? body.payment.card.last4 : null,
          deliveryType, status: allDigital ? "Delivered" : "Placed", deliveredAt: allDigital ? new Date() : null, etaText: eta.label,
          shippingAddress: pickup
            ? { line: `Store pickup — ${STORE.address}`, pincode: STORE.pincode, phone }
            : allDigital ? { line: "E-delivery to your Bookslab account", pincode: "", phone } : { line: homeLine, pincode: homePin, phone },
          items: lines.map((l) => ({ bookId: l.book.id, title: l.book.title, isbn: l.book.isbn, format: l.book.format, price: l.book.price, quantity: l.quantity, kit: l.kit })),
        });
        break;
      } catch (e) {
        if ((e as { code?: number }).code !== 11000 || attempt >= 3) throw e; // order-number collision → retry
      }
    }
    // The order now holds these books — empty this user's saved cart (server-side, so every device agrees).
    await Cart.updateOne({ userId: user.id }, { $set: { items: [] } }).catch(() => {});
    // Confirmation email, sent after the response so checkout never waits on (or fails because of) email.
    if (user.email) {
      const placed = order;
      const to = user.email;
      after(() =>
        sendEmail({
          to, tag: "order-confirmation",
          ...orderConfirmationEmail({
            name: user.name, orderId: String(placed._id), orderNumber: placed.orderNumber,
            items: lines.map((l) => ({ title: l.book.title, quantity: l.quantity, price: l.book.price })),
            subtotal: totals.subtotal, bundleDiscount: totals.bundleDiscount, deliveryFee: totals.deliveryFee, codFee: totals.codFee, total: totals.total,
            deliveryType, eta: eta.label, address: placed.shippingAddress?.line ?? "",
            paymentMethod: method, paymentStatus: placed.paymentStatus ?? "Pending", transactionId: placed.transactionId ?? null,
          }),
        }).then((r) => { if (!r.sent && process.env.RESEND_API_KEY) console.error(`[email] order ${placed.orderNumber}: ${r.reason}`); }),
      );
    }
    return NextResponse.json({ ok: true, orderId: String(order._id), orderNumber: order.orderNumber, total: order.totalAmount, eta: eta.label, paymentMethod: method, paymentStatus: order.paymentStatus, transactionId: order.transactionId });
  } catch (e) {
    await restoreStock(reserve); // never leave stock reserved for an order that wasn't saved
    if (capture) await refundPayment({ transactionId: capture.transactionId, amount: totals.total }).catch(() => {}); // …nor money taken for it
    throw e;
  }
});
