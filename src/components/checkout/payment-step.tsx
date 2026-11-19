"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PaymentMethod } from "@/lib/constants";
import { UPI_ID, upiUri } from "@/lib/upi";
import { methodsFor, type PaymentSettings } from "@/lib/payment-settings";
import { cn, formatINR } from "@/lib/utils";

export type PaymentDraft = {
  method: PaymentMethod;
  upiMode: "id" | "qr";
  upiId: string;
  card: { number: string; expiry: string; cvc: string; name: string };
};
export const emptyPayment = (method: PaymentMethod = "UPI"): PaymentDraft => ({ method, upiMode: "id", upiId: "", card: { number: "", expiry: "", cvc: "", name: "" } });

/** What is sent to the server: never the card number or CVV — only brand + last four digits. */
export type PaymentPayload =
  | { method: "UPI"; upiId: string | null }
  | { method: "CARD"; card: { brand: string; last4: string } }
  | { method: "COD" }
  | { method: "PAY_AT_STORE" };

const SANDBOX = (process.env.NEXT_PUBLIC_PAYMENTS_MODE ?? "sandbox") !== "live";

export function cardBrand(num: string) {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^(60|65|81|82|508)/.test(n)) return "RuPay";
  if (/^3[47]/.test(n)) return "Amex";
  return "Card";
}
function luhn(n: string) {
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Client-side checks before anything is sent. Returns the safe payload or an error message. */
export function validatePayment(p: PaymentDraft): { payload: PaymentPayload } | { error: string } {
  if (p.method === "COD" || p.method === "PAY_AT_STORE") return { payload: { method: p.method } };
  if (p.method === "UPI") {
    if (p.upiMode === "qr") return { payload: { method: "UPI", upiId: null } };
    const id = p.upiId.trim().toLowerCase();
    if (!UPI_ID.test(id)) return { error: "Enter a valid UPI ID, like name@okicici or 98100xxxxx@ybl." };
    return { payload: { method: "UPI", upiId: id } };
  }
  const num = p.card.number.replace(/\D/g, "");
  if (num.length < 13 || num.length > 19 || !luhn(num)) return { error: "Check the card number — it doesn't look right." };
  const m = p.card.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { error: "Enter the expiry as MM/YY." };
  const exp = new Date(2000 + Number(m[2]), Number(m[1]), 1); // first day after the expiry month
  if (exp.getTime() <= Date.now()) return { error: "This card has expired." };
  if (!/^\d{3,4}$/.test(p.card.cvc)) return { error: "Enter the 3- or 4-digit CVV." };
  if (p.card.name.trim().length < 2) return { error: "Enter the name as printed on the card." };
  return { payload: { method: "CARD", card: { brand: cardBrand(num), last4: num.slice(-4) } } };
}

type Option = { method: PaymentMethod; title: string; sub: string; icon: string; badge?: string };

export function PaymentStep({
  value, onChange, pickup, allDigital, total, settings, error,
}: {
  value: PaymentDraft;
  onChange: (p: PaymentDraft) => void;
  pickup: boolean;
  allDigital: boolean;
  total: number;
  settings: PaymentSettings | null;
  error?: string;
}) {
  if (!settings) return <div className="small text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading payment options…</div>;
  const ALL: Record<PaymentMethod, Option> = {
    UPI: { method: "UPI", title: "UPI", sub: "Google Pay, PhonePe, Paytm, BHIM", icon: "bi-phone", badge: "Instant & Zero Fee" },
    COD: { method: "COD", title: "Cash on Delivery", sub: "Pay in cash or UPI upon delivery at your doorstep", icon: "bi-cash-stack", badge: settings.codFee > 0 ? `+${formatINR(settings.codFee)} handling` : "No COD fee" },
    PAY_AT_STORE: { method: "PAY_AT_STORE", title: "Pay at Connaught Place Store", sub: "Reserve now, pay by cash, UPI or card at the counter when you collect", icon: "bi-shop" },
    CARD: { method: "CARD", title: "Debit / Credit Card", sub: "Visa, Mastercard, RuPay", icon: "bi-credit-card" },
  };
  const options = methodsFor(settings, { pickup, allDigital }).map((m) => ALL[m]);
  if (options.length === 0) {
    return <div className="alert alert-warning small mb-0">{allDigital ? "Online payment is switched off at the moment, so digital titles can't be ordered online. Please contact the CP store." : "No payment method is available for this delivery option right now. Please try the other option or contact the CP store."}</div>;
  }
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...value, ...patch });
  const setCard = (patch: Partial<PaymentDraft["card"]>) => onChange({ ...value, card: { ...value.card, ...patch } });

  return (
    <div>
      {SANDBOX && (
        <div className="alert alert-light border small py-2 d-flex gap-2 align-items-start">
          <i className="bi bi-shield-check text-primary" />
          <span><strong>Test mode.</strong> UPI and card payments are simulated — no money moves. Use any valid-looking details (card <span className="font-mono">4111 1111 1111 1111</span>); <span className="font-mono">fail@upi</span> or a card ending <span className="font-mono">0002</span> shows a declined payment.</span>
        </div>
      )}
      <div className="d-grid gap-2" role="radiogroup" aria-label="Payment method">
        {options.map((o) => {
          const on = value.method === o.method;
          return (
            <div key={o.method} className={cn("border rounded-3", on ? "border-primary bg-primary-subtle" : "bg-white")} data-pay={o.method}>
              <label className="d-flex gap-3 p-3 mb-0" style={{ cursor: "pointer" }}>
                <input type="radio" className="form-check-input mt-1" name="payment-method" checked={on} onChange={() => set({ method: o.method })} />
                <i className={`bi ${o.icon} fs-5 text-primary`} aria-hidden />
                <span className="flex-grow-1">
                  <span className="fw-semibold">{o.title}</span>
                  {o.badge && <span className="badge text-bg-light border ms-2 fw-normal">{o.badge}</span>}
                  <span className="d-block small text-muted">{o.sub}</span>
                </span>
              </label>
              {on && o.method === "UPI" && <UpiPanel value={value} set={set} total={total} settings={settings} />}
              {on && o.method === "CARD" && <CardPanel value={value} setCard={setCard} />}
              {on && o.method === "COD" && (
                <div className="px-3 pb-3 small text-muted ps-5">
                  Keep {formatINR(total)} ready{settings.codFee > 0 ? `, including the ${formatINR(settings.codFee)} COD handling fee` : ""}. Our delivery partner also accepts UPI at the door.
                </div>
              )}
              {on && o.method === "PAY_AT_STORE" && (
                <div className="px-3 pb-3 small text-muted ps-5">Your books are held for you. Pay {formatINR(total)} by cash, UPI or card at the Inner Circle counter when you collect.</div>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert"><i className="bi bi-exclamation-circle me-1" />{error}</div>}
    </div>
  );
}

function UpiPanel({ value, set, total, settings }: { value: PaymentDraft; set: (p: Partial<PaymentDraft>) => void; total: number; settings: PaymentSettings }) {
  const [qr, setQr] = useState<string | null>(null);
  const payee = { vpa: settings.storeUpiId, name: settings.storeUpiName };
  const uri = upiUri(payee, total, "Bookslab CP order");
  const fixedQr = settings.upiQrImage; // the store's own bank QR, if uploaded (amount is entered in the app)
  useEffect(() => {
    if (value.upiMode !== "qr" || fixedQr) return;
    let live = true;
    QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#1E293B", light: "#FFFFFF" } }).then((d) => live && setQr(d)).catch(() => setQr(null));
    return () => { live = false; };
  }, [uri, value.upiMode, fixedQr]);
  const idOk = !value.upiId || UPI_ID.test(value.upiId.trim());

  return (
    <div className="px-3 pb-3 ps-sm-5">
      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="How to pay with UPI">
        <button type="button" className={cn("btn btn-outline-primary", value.upiMode === "id" && "active")} onClick={() => set({ upiMode: "id" })}>Enter UPI ID</button>
        <button type="button" className={cn("btn btn-outline-primary", value.upiMode === "qr" && "active")} onClick={() => set({ upiMode: "qr" })}>Scan QR code</button>
      </div>
      {value.upiMode === "id" ? (
        <div style={{ maxWidth: 360 }}>
          <label className="form-label small" htmlFor="upi-id">Your UPI ID</label>
          <input id="upi-id" className={cn("form-control font-mono", !idOk && "is-invalid")} value={value.upiId} onChange={(e) => set({ upiId: e.target.value.replace(/\s/g, "") })} placeholder="name@okicici" autoComplete="off" spellCheck={false} />
          <div className={cn("form-text", !idOk && "text-danger")}>{idOk ? "We'll send a collect request to your UPI app — approve it to finish." : "That doesn't look like a UPI ID (name@bank)."}</div>
        </div>
      ) : (
        <div className="d-flex flex-wrap gap-3 align-items-center">
          <div className="bg-white border rounded-3 p-2" style={{ width: 160, height: 160 }}>
            {fixedQr ? <img src={fixedQr} alt={`UPI QR code for ${settings.storeUpiName}`} width={144} height={144} style={{ objectFit: "contain" }} data-upi-qr="uploaded" />
              : qr ? <img src={qr} alt={`UPI QR code to pay ${formatINR(total)} to ${settings.storeUpiName}`} width={144} height={144} data-upi-uri={uri} />
              : <div className="w-100 h-100 d-grid" style={{ placeItems: "center" }}><span className="spinner-border spinner-border-sm text-muted" /></div>}
          </div>
          <div className="small">
            <div className="text-muted">Pay exactly</div>
            <div className="fs-4 fw-semibold tabular">{formatINR(total)}</div>
            <div className="text-muted">to <span className="font-mono" data-store-upi>{settings.storeUpiId}</span> ({settings.storeUpiName})</div>
            <div className="text-muted mt-1">{fixedQr ? <>Scan with any UPI app, <strong>enter {formatINR(total)}</strong>, then tap <em>Verify &amp; Confirm</em>.</> : <>Scan with any UPI app, then tap <em>Verify &amp; Confirm</em>.</>}</div>
            {SANDBOX && <div className="text-warning-emphasis mt-1"><i className="bi bi-exclamation-triangle me-1" />Test mode — please don&apos;t pay with a real app.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function CardPanel({ value, setCard }: { value: PaymentDraft; setCard: (p: Partial<PaymentDraft["card"]>) => void }) {
  const brand = cardBrand(value.card.number);
  return (
    <div className="px-3 pb-3 ps-sm-5">
      <div className="row g-2" style={{ maxWidth: 440 }}>
        <div className="col-12">
          <label className="form-label small" htmlFor="cc-number">Card number</label>
          <div className="input-group">
            <input id="cc-number" className="form-control font-mono" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
              value={value.card.number}
              onChange={(e) => setCard({ number: e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ") })} />
            <span className="input-group-text small">{value.card.number ? brand : <i className="bi bi-credit-card" />}</span>
          </div>
        </div>
        <div className="col-6">
          <label className="form-label small" htmlFor="cc-exp">Expiry</label>
          <input id="cc-exp" className="form-control font-mono" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
            value={value.card.expiry}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setCard({ expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }); }} />
        </div>
        <div className="col-6">
          <label className="form-label small" htmlFor="cc-cvc">CVV</label>
          <input id="cc-cvc" type="password" className="form-control font-mono" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" value={value.card.cvc} onChange={(e) => setCard({ cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        </div>
        <div className="col-12">
          <label className="form-label small" htmlFor="cc-name">Name on card</label>
          <input id="cc-name" className="form-control" autoComplete="cc-name" value={value.card.name} onChange={(e) => setCard({ name: e.target.value })} />
        </div>
      </div>
      <p className="small text-muted mt-2 mb-0"><i className="bi bi-lock me-1" />Your card number and CVV stay in your browser — we only keep the last four digits for your receipt.</p>
    </div>
  );
}
