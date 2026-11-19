import "server-only";
import { randomInt } from "crypto";

/**
 * Payment adapter — the only place money moves.
 *
 * PAYMENTS_MODE=sandbox (default): payments are simulated so the full flow can be tested
 * locally. Test conventions (like Razorpay / Stripe test mode):
 *   • UPI ID starting with "fail@"  → payment fails
 *   • card ending in 0002            → card declined
 * Going live: replace `captureOnlinePayment` and `refundPayment` with your gateway calls
 * (Razorpay Orders + payment signature verification, or Cashfree) — the rest of the app
 * only sees { ok, transactionId } / { refundId }.
 *
 * Card data rule: the full card number and CVV never reach this server. The browser sends
 * only the brand and last four digits (exactly what a gateway's hosted checkout returns).
 */

export const paymentsMode = () => (process.env.PAYMENTS_MODE === "live" ? "live" : "sandbox");

const digits = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
export const newReference = (kind: "UPI" | "CARD" | "COD" | "STORE" | "RFND") => `BSL-${kind}-${digits(8)}`;

export type CaptureInput =
  | { method: "UPI"; amount: number; upiId: string | null }
  | { method: "CARD"; amount: number; card: { brand: string; last4: string } };

export type CaptureResult = { ok: true; transactionId: string } | { ok: false; reason: string };

export async function captureOnlinePayment(input: CaptureInput): Promise<CaptureResult> {
  if (paymentsMode() === "live") {
    // Wire your gateway here; refuse rather than pretend to charge.
    return { ok: false, reason: "Online payments aren't connected yet. Please choose another payment method." };
  }
  await new Promise((r) => setTimeout(r, 600)); // feels like a real verification round-trip
  if (input.method === "UPI") {
    if (input.upiId?.toLowerCase().startsWith("fail@")) return { ok: false, reason: "Your UPI app declined the payment. No money was taken." };
    return { ok: true, transactionId: newReference("UPI") };
  }
  if (input.card.last4 === "0002") return { ok: false, reason: "Your bank declined this card. No money was taken." };
  return { ok: true, transactionId: newReference("CARD") };
}

/** Refund a captured online payment to the original method. */
export async function refundPayment(_p: { transactionId: string | null; amount: number }) {
  if (paymentsMode() === "live") throw new Error("Refunds aren't connected to a gateway yet.");
  return { refundId: newReference("RFND") };
}
