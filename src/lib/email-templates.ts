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
  const subject = "Your Bookslab password reset code"; // the code is only in the body, so it never shows up in server logs
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

export type ContactEmailInput = { name: string; email: string; phone: string; topic: string; orderNumber: string; message: string; signedIn: boolean };

/** Notification to the store inbox; Reply-To is set to the customer so staff can just hit Reply. */
export function contactNotificationEmail(c: ContactEmailInput) {
  const subject = `[Contact] ${c.topic}${c.orderNumber ? ` · ${c.orderNumber}` : ""} — ${c.name}`;
  const row = (k: string, v: string) => (v ? `<div style="font-size:14px;padding:3px 0;"><span style="color:#64748B;display:inline-block;width:96px;">${k}</span>${esc(v)}</div>` : "");
  const html = layout(subject, `
    <h1 style="font-size:18px;margin:0 0 14px;">New message from the website</h1>
    ${row("Name", c.name)}${row("Email", c.email)}${row("Phone", c.phone)}${row("Topic", c.topic)}${row("Order", c.orderNumber)}${row("Account", c.signedIn ? "Signed-in customer" : "Guest")}
    <div style="background:#F3F2EE;border-radius:8px;padding:14px;margin-top:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(c.message)}</div>
    <p style="font-size:12px;color:#64748B;margin:14px 0 0;">Reply to this email to answer ${esc(c.name.split(" ")[0])} directly.</p>`);
  const text = [`New message from the website`, ``, `Name: ${c.name}`, `Email: ${c.email}`, ...(c.phone ? [`Phone: ${c.phone}`] : []), `Topic: ${c.topic}`, ...(c.orderNumber ? [`Order: ${c.orderNumber}`] : []), `Account: ${c.signedIn ? "Signed-in customer" : "Guest"}`, ``, c.message].join("\n");
  return { subject, html, text };
}

export function welcomeEmail(p: { name: string; email: string; phone: string | null; createdAt: Date }) {
  const first = p.name.split(" ")[0];
  const subject = `Welcome to Bookslab, ${first} — your account is ready`;
  const joined = p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const detail = (k: string, v: string) => `<div style="font-size:14px;padding:3px 0;"><span style="color:#64748B;display:inline-block;width:110px;">${k}</span>${esc(v)}</div>`;
  const html = layout(subject, `
    <h1 style="font-size:18px;margin:0 0 12px;">Welcome to Bookslab, ${esc(first)}</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Your account has been created. Here are the details we have for you:</p>
    <div style="background:#F3F2EE;border-radius:8px;padding:12px 14px;margin-bottom:18px;">
      ${detail("Name", p.name)}${detail("Sign-in email", p.email)}${p.phone ? detail("Mobile", p.phone) : ""}${detail("Member since", joined)}
    </div>
    <p style="margin:0 0 8px;font-size:14px;font-weight:600;">What you can do</p>
    <ul style="margin:0 0 18px;padding-left:18px;line-height:1.8;font-size:14px;">
      <li>Order law, finance &amp; tax, academic and technology titles — current editions</li>
      <li>Collect free from our Connaught Place store, or get delivery across Delhi NCR</li>
      <li>Can&rsquo;t find a title? <a href="${SITE()}/request-book" style="color:#1B365D;">Request it</a> and our sourcing desk will find it</li>
    </ul>
    <p style="margin:0 0 20px;"><a href="${SITE()}/search" style="background:#1B365D;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block;">Browse the catalog</a></p>
    <div style="border-top:1px solid #E5E7EB;padding-top:14px;font-size:13px;line-height:1.7;color:#1E293B;">
      <strong>Visit us:</strong> ${esc(STORE.name)}, ${esc(STORE.address)} · ${esc(STORE.hours)}<br>
      <strong>Need help?</strong> Call ${esc(STORE.phone)}, email ${esc(STORE.email)}, or use our <a href="${SITE()}/contact" style="color:#1B365D;">contact form</a>.
    </div>
    <p style="font-size:12px;color:#64748B;margin:16px 0 0;">Didn&rsquo;t create this account? Contact us and we&rsquo;ll look into it.</p>`);
  const text = [
    `Welcome to Bookslab, ${first} — your account is ready.`, ``,
    `Name: ${p.name}`, `Sign-in email: ${p.email}`, ...(p.phone ? [`Mobile: ${p.phone}`] : []), `Member since: ${joined}`, ``,
    `Browse the catalog: ${SITE()}/search`, `Can't find a title? ${SITE()}/request-book`, ``,
    `Visit us: ${STORE.name}, ${STORE.address} (${STORE.hours})`,
    `Need help? Call ${STORE.phone}, email ${STORE.email}, or ${SITE()}/contact`, ``,
    `Didn't create this account? Contact us and we'll look into it.`,
  ].join("\n");
  return { subject, html, text };
}

export function verifyEmailCode(p: { name: string; code: string; ttlMinutes: number }) {
  const subject = "Verify your Bookslab account"; // the code stays out of the subject (and out of server logs)
  const html = layout(subject, `
    <h1 style="font-size:18px;margin:0 0 12px;">Confirm your email</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${esc(p.name.split(" ")[0])}, enter this code in the Bookslab sign-up window to finish creating your account:</p>
    <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:.35em;background:#F3F2EE;border-radius:8px;padding:14px 0;text-align:center;">${esc(p.code)}</div>
    <p style="margin:16px 0 0;font-size:13px;color:#64748B;line-height:1.6;">The code expires in ${p.ttlMinutes} minutes. If you didn't try to create a Bookslab account, you can ignore this email.</p>`);
  const text = `Verify your Bookslab account\n\nHello ${p.name.split(" ")[0]}, your verification code is: ${p.code}\n\nIt expires in ${p.ttlMinutes} minutes. If you didn't try to create a Bookslab account, ignore this email.`;
  return { subject, html, text };
}
