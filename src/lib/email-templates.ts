import "server-only";
import { STORE } from "@/lib/store-info";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/constants";

// Minimal, table-free HTML that renders well in Gmail / Outlook / Apple Mail, plus a plain-text twin.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function layout(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#FAF9F6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;">Bookslab</div>
    <div style="font-size:12px;color:#64748B;margin-bottom:24px;">Connaught Place, New Delhi</div>
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:28px;">${body}</div>
    <p style="font-size:12px;color:#64748B;line-height:1.6;margin-top:20px;">${esc(STORE.name)} · ${esc(STORE.address)}<br>${esc(STORE.phone)} · ${esc(STORE.email)}</p>
  </div>
</body></html>`;
}

export function resetCodeEmail(p: { name: string; code: string; ttlMinutes: number }) {
  const subject = `Your Bookslab password reset code: ${p.code}`;
  const html = layout(subject, `
    <h1 style="font-size:18px;margin:0 0 12px;">Reset your password</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${esc(p.name.split(" ")[0])}, use this code to set a new password:</p>
    <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:.3em;background:#F3F2EE;border-radius:8px;padding:14px 0;text-align:center;">${esc(p.code)}</div>
    <p style="margin:16px 0 0;font-size:13px;color:#64748B;line-height:1.6;">It expires in ${p.ttlMinutes} minutes and works once. If you didn't ask for this, you can ignore this email — your password stays the same.</p>`);
  const text = `Reset your Bookslab password\n\nHello ${p.name.split(" ")[0]}, your code is: ${p.code}\n\nIt expires in ${p.ttlMinutes} minutes and works once. If you didn't ask for this, ignore this email.`;
  return { subject, html, text };
}

export type OrderEmailInput = {
  name: string;
  orderId: string;
  orderNumber: string;
  items: { title: string; quantity: number; price: number }[];
  subtotal: number;
  bundleDiscount: number;
  deliveryFee: number;
  codFee: number;
  total: number;
  deliveryType: string;
  eta: string;
  address: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  transactionId: string | null;
};

export function orderConfirmationEmail(o: OrderEmailInput) {
  const pickup = o.deliveryType === "CP Store Pickup";
  const subject = `Order ${o.orderNumber} confirmed — ${inr(o.total)}`;
  const payLine =
    o.paymentStatus === "Paid" ? `Paid ${inr(o.total)} by ${PAYMENT_LABEL[o.paymentMethod]}${o.transactionId ? ` · Ref ${o.transactionId}` : ""}`
    : o.paymentMethod === "PAY_AT_STORE" ? `Pay ${inr(o.total)} at the CP store counter when you collect`
    : `Pay ${inr(o.total)} in cash or UPI on delivery`;
  const fulfil = pickup
    ? `<strong>CP Store Pickup</strong> — ${esc(o.eta)}.<br><span style="color:#64748B;">${esc(STORE.address)} · ${esc(STORE.hours)}</span>`
    : `<strong>Home Delivery</strong> — ${esc(o.eta)}.<br><span style="color:#64748B;">${esc(o.address)}</span>`;
  const row = (l: string, r: string, strong = false) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;${strong ? "font-weight:700;font-size:16px;border-top:1px solid #E5E7EB;margin-top:6px;padding-top:10px;" : "font-size:14px;"}"><span>${l}</span><span style="white-space:nowrap;">${r}</span></div>`;

  const html = layout(subject, `
    <h1 style="font-size:18px;margin:0 0 4px;">Thank you, ${esc(o.name.split(" ")[0])} — your order is placed</h1>
    <p style="margin:0 0 20px;color:#64748B;font-size:14px;">Order <strong style="color:#1E293B;font-family:ui-monospace,Menlo,monospace;">${esc(o.orderNumber)}</strong></p>
    ${o.items.map((i) => row(`${i.quantity} × ${esc(i.title)}`, inr(i.price * i.quantity))).join("")}
    <div style="border-top:1px solid #E5E7EB;margin:10px 0 4px;"></div>
    ${row("Subtotal", inr(o.subtotal))}
    ${o.bundleDiscount ? row("Kit savings", `−${inr(o.bundleDiscount)}`) : ""}
    ${row(pickup ? "Store pickup" : "Delivery", o.deliveryFee ? inr(o.deliveryFee) : "Free")}
    ${o.codFee ? row("COD handling fee", inr(o.codFee)) : ""}
    ${row("Total", inr(o.total), true)}
    <div style="background:#F3F2EE;border-radius:8px;padding:14px;margin-top:18px;font-size:14px;line-height:1.6;">${fulfil}</div>
    <p style="font-size:14px;margin:14px 0 0;">${esc(payLine)}</p>
    <p style="margin:22px 0 0;"><a href="${SITE()}/my-orders" style="background:#1B365D;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block;">View in My Orders</a></p>
    <p style="font-size:12px;color:#64748B;margin:14px 0 0;">You can cancel from My Orders until it's ${pickup ? "ready for pickup" : "out for delivery"}.</p>`);

  const text = [
    `Thank you, ${o.name.split(" ")[0]} — your Bookslab order is placed.`,
    `Order: ${o.orderNumber}`,
    "",
    ...o.items.map((i) => `${i.quantity} × ${i.title} — ${inr(i.price * i.quantity)}`),
    "",
    `Subtotal: ${inr(o.subtotal)}`,
    ...(o.bundleDiscount ? [`Kit savings: −${inr(o.bundleDiscount)}`] : []),
    `${pickup ? "Store pickup" : "Delivery"}: ${o.deliveryFee ? inr(o.deliveryFee) : "Free"}`,
    ...(o.codFee ? [`COD handling fee: ${inr(o.codFee)}`] : []),
    `Total: ${inr(o.total)}`,
    "",
    pickup ? `CP Store Pickup — ${o.eta}. ${STORE.address}` : `Home Delivery — ${o.eta}. ${o.address}`,
    payLine,
    "",
    `My Orders: ${SITE()}/my-orders`,
  ].join("\n");
  return { subject, html, text };
}
