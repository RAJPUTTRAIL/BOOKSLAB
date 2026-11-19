// Client-safe UPI helpers. The payee (store UPI ID + name) comes from the admin's Payment Settings.

/** name@handle — the handle is the bank / app (okicici, ybl, paytm, oksbi, hdfcbank…). */
export const UPI_ID = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;

/** Standard UPI deep link (NPCI spec) — what the dynamic QR code encodes. */
export function upiUri(payee: { vpa: string; name: string }, amount: number, note: string) {
  const p = new URLSearchParams({ pa: payee.vpa, pn: payee.name, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${p.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}
