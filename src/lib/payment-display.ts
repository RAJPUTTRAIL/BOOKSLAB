// Client-safe labels for payment badges (My Orders, admin, invoice).
import { PAYMENT_LABEL, type PaymentMethod } from "./constants";

type P = { method: PaymentMethod; status: string; card?: { brand: string; last4: string } | null };

export const methodLabel = (p: P) => (p.method === "CARD" && p.card ? `${p.card.brand} •• ${p.card.last4}` : PAYMENT_LABEL[p.method] ?? p.method);
export const methodShort = (m: PaymentMethod) => ({ UPI: "UPI", COD: "COD", PAY_AT_STORE: "Pay at Store", CARD: "Card" })[m] ?? m;

/** "UPI · Paid", "COD · Pay on Delivery", "Pay at Store · Pay at pickup", "Card · Refunded" */
export function paymentBadge(p: P, orderStatus?: string) {
  const pendingText = p.method === "COD" ? "Pay on Delivery" : p.method === "PAY_AT_STORE" ? "Pay at pickup" : "Pending";
  const status = p.status === "Pending" ? (orderStatus === "Cancelled" ? "Not charged" : pendingText) : p.status;
  const tone = p.status === "Paid" ? "text-bg-success" : p.status === "Refunded" ? "text-bg-info" : p.status === "Failed" ? "text-bg-danger" : "text-bg-light border";
  return { text: `${methodShort(p.method)} · ${status}`, tone };
}

export const REFUND_NOTICE = "Refund initiated to original payment method — reflects in 3–5 business days.";
