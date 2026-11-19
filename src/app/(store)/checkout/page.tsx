"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { useApi, useApp } from "@/components/providers";
import { AddressModal, labelIcon } from "@/components/address-modal";
import type { Address } from "@/lib/address-schema";
import { PaymentStep, emptyPayment, validatePayment, type PaymentDraft } from "@/components/checkout/payment-step";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/constants";
import { methodsFor, type PaymentSettings } from "@/lib/payment-settings";
import { estimateDelivery, pickupEta } from "@/lib/delivery";
import { computeTotals } from "@/lib/pricing";
import { STORE } from "@/lib/store-info";
import { cn, formatINR } from "@/lib/utils";

type Placed = { orderId: string; orderNumber: string; total: number; eta: string; paymentMethod: PaymentMethod; paymentStatus: string; transactionId: string | null };
type DeliveryType = "Home Delivery" | "CP Store Pickup";

export default function CheckoutPage() {
  const { cart, user, clearCart, toast, openAuth } = useApp();
  const api = useApi();
  const router = useRouter();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("Home Delivery");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [pay, setPay] = useState<PaymentDraft>(emptyPayment("UPI"));
  const [payError, setPayError] = useState("");
  // Live payment settings from the admin (methods on/off, COD fee, store UPI details).
  const [paySettings, setPaySettings] = useState<PaymentSettings | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/settings/payments", { cache: "no-store" }).then((r) => r.json()).then((d) => live && d.settings && setPaySettings(d.settings)).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => { try { const p = localStorage.getItem("bl_pin"); if (p) setPincode(p); } catch {} }, []);
  useEffect(() => { if (!user && cart.length > 0) openAuth("signin"); /* prompt once on arrival */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.identifier.startsWith("+91") && !phone) setPhone(user.identifier.slice(3)); }, [user, phone]);
  // Saved addresses for signed-in customers (default auto-selected).
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addrModal, setAddrModal] = useState(false);
  const [profilePhone, setProfilePhone] = useState("");
  useEffect(() => {
    setAddresses(null);
    setAddressId(null);
    if (!user) return;
    let live = true;
    fetch("/api/user/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const p = d?.profile?.phone ?? "";
        setProfilePhone(p);
        if (p) setPhone(p.replace(/^\+91/, "")); // the primary phone wins over an address phone
      })
      .catch(() => {});
    fetch("/api/user/addresses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((d) => {
        if (!live) return;
        const list: Address[] = d.addresses ?? [];
        setAddresses(list);
        setAddressId((list.find((a) => a.isDefault) ?? list[0])?.id ?? null);
        const fallback = (list.find((a) => a.isDefault) ?? list[0])?.phone;
        if (fallback) setPhone((x) => x || fallback.replace(/^\+91/, "")); // pickup contact number
      })
      .catch(() => live && setAddresses([]));
    return () => { live = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDigital = cart.length > 0 && cart.every((i) => i.digital);
  const effType: DeliveryType = allDigital ? "Home Delivery" : deliveryType;
  const t = useMemo(
    () => computeTotals(cart.map((i) => ({ price: i.price, quantity: i.qty, kit: i.kit, digital: i.digital })), { fulfillment: effType === "CP Store Pickup" ? "PICKUP" : "DELIVERY", paymentMethod: pay.method, codFee: paySettings?.codFee ?? 0 }),
    [cart, effType, pay.method, paySettings?.codFee],
  );
  // Keep the payment method valid for the way the order is fulfilled; pickup highlights Pay at Store.
  const pickupSelected = effType === "CP Store Pickup" && !allDigital;
  useEffect(() => {
    if (!paySettings) return;
    const offered = methodsFor(paySettings, { pickup: pickupSelected, allDigital });
    setPay((p) => {
      // Pickup highlights Pay at Store (unless the customer already started a UPI payment).
      if (pickupSelected && offered.includes("PAY_AT_STORE") && !(p.method === "UPI" && p.upiId) && p.method !== "CARD") return { ...p, method: "PAY_AT_STORE" };
      if (offered.includes(p.method)) return p;
      return offered[0] ? { ...p, method: offered[0] } : p;
    });
  }, [pickupSelected, allDigital, paySettings]);
  const savedMode = !!user && effType === "Home Delivery" && !allDigital;
  const selected = addresses?.find((a) => a.id === addressId) ?? null;
  const etaPin = savedMode ? selected?.pincode ?? "" : pincode;
  const eta = allDigital ? null : effType === "CP Store Pickup" ? pickupEta() : etaPin.length === 6 ? estimateDelivery(etaPin) : null;

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return openAuth("signin");
    if (savedMode && !addressId) return setError("Choose a delivery address, or add a new one.");
    if (!paySettings || !methodsFor(paySettings, { pickup: pickupSelected, allDigital }).includes(pay.method)) {
      setPayError("Choose one of the available payment methods.");
      return;
    }
    const checked = validatePayment(pay);
    if ("error" in checked) { setPayError(checked.error); document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setPayError("");
    setError("");
    setBusy(true);
    try {
      const d = await api<Placed>("/api/orders", {
        items: cart.map((i) => ({ bookId: i.bookId, quantity: i.qty, kit: i.kit })),
        deliveryType: effType,
        ...(savedMode ? { addressId } : { pincode, address, phone }),
        payment: checked.payload,
        expectedTotal: t.total,
      });
      setPlaced(d);
      clearCart();
      toast({ kind: "success", title: `Order ${d.orderNumber} placed` });
      router.refresh();
    } catch (err) {
      // Payment problems are shown next to the payment options; everything else in the summary.
      const msg = (err as Error).message;
      if (/declin|payment|UPI|card|charged/i.test(msg)) setPayError(msg); else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 560 }}>
        <div className="rounded-circle bg-success-subtle text-success d-inline-grid mb-3" style={{ width: 72, height: 72, placeItems: "center" }}><i className="bi bi-check2 fs-1" /></div>
        <h1 className="h3">Thank you — your order has been placed</h1>
        <p className="font-mono text-primary fs-5 mb-1">{placed.orderNumber}</p>
        {placed.paymentStatus === "Paid" ? (
          <div className="border rounded-3 bg-white d-inline-block text-start px-3 py-2 my-2">
            <div className="small"><i className="bi bi-check-circle-fill text-success me-1" /><strong>{formatINR(placed.total)} paid</strong> by {PAYMENT_LABEL[placed.paymentMethod]}</div>
            {placed.transactionId && <div className="small text-muted">Transaction ID <span className="font-mono text-body">{placed.transactionId}</span></div>}
          </div>
        ) : (
          <p className="text-muted mb-1">{placed.paymentMethod === "PAY_AT_STORE" ? `Pay ${formatINR(placed.total)} at the CP store counter when you collect.` : `Pay ${formatINR(placed.total)} in cash or UPI when it's delivered.`}</p>
        )}
        <p className="text-muted">{placed.eta}</p>
        <p className="small text-muted">We&apos;ll confirm it shortly. You can cancel it from My Orders until it is {effType === "CP Store Pickup" ? "ready for pickup" : "out for delivery"}.</p>
        <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
          <Link href={`/invoice/${placed.orderId}`} className="btn btn-light border">View invoice</Link>
          <Link href="/my-orders" className="btn btn-light border">My Orders</Link>
          <Link href="/" className="btn btn-primary">Continue browsing</Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
        <i className="bi bi-bag fs-1 text-muted" />
        <h1 className="h4 mt-3">Your cart is empty</h1>
        <p className="text-muted">Add a few titles and come back when you're ready.</p>
        <Link href="/search" className="btn btn-primary">Browse books</Link>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h1 className="h3 mb-4">Checkout</h1>
      <form className="row g-4" onSubmit={place}>
        <div className="col-lg-7">
          {!user && (
            <div className="alert alert-light border d-flex flex-wrap align-items-center gap-3">
              <i className="bi bi-person-circle fs-4 text-primary" />
              <div className="flex-grow-1"><strong>Sign in to place your order.</strong><div className="small text-muted">It takes a minute — your cart stays right here.</div></div>
              <button type="button" className="btn btn-primary" onClick={() => openAuth("signup")}>Sign Up / Login</button>
            </div>
          )}

          <div className="card rounded-4 mb-4">
            <div className="card-body p-4">
              <h2 className="h6 mb-3">1. How would you like to receive it?</h2>
              {allDigital ? (
                <p className="small text-muted mb-0"><i className="bi bi-lightning me-1" />Everything in your cart is digital and will be available in your account immediately.</p>
              ) : (
                <div className="row g-3">
                  {([["Home Delivery", "bi-truck", "Delhi NCR and across India"], ["CP Store Pickup", "bi-shop", "Free · usually ready in 2 hours"]] as const).map(([k, icon, sub]) => (
                    <div className="col-sm-6" key={k}>
                      <label className={cn("d-block border rounded-3 p-3 h-100", deliveryType === k ? "border-primary bg-primary-subtle" : "bg-white")} style={{ cursor: "pointer" }}>
                        <input type="radio" className="form-check-input me-2" name="delivery" checked={deliveryType === k} onChange={() => setDeliveryType(k)} />
                        <i className={`bi ${icon} me-1`} /><strong>{k}</strong>
                        <div className="small text-muted mt-1 ms-4">{sub}</div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card rounded-4 mb-4">
            <div className="card-body p-4">
              <h2 className="h6 mb-3">2. {effType === "CP Store Pickup" && !allDigital ? "Pickup details" : "Contact & address"}</h2>
              {savedMode && addresses === null && <div className="small text-muted mb-3"><span className="spinner-border spinner-border-sm me-2" />Loading your saved addresses…</div>}
              {savedMode && addresses && (
                <div className="mb-1">
                  {addresses.length === 0 ? (
                    <div className="border rounded-3 bg-paper p-3 small mb-3">You haven&apos;t saved a delivery address yet. Add one — it will be remembered for next time.</div>
                  ) : (
                    <div className="d-grid gap-2 mb-3" role="radiogroup" aria-label="Delivery address">
                      {addresses.map((a) => (
                        <label key={a.id} className={cn("d-flex gap-3 border rounded-3 p-3", addressId === a.id ? "border-primary bg-primary-subtle" : "bg-white")} style={{ cursor: "pointer" }} data-address={a.label}>
                          <input type="radio" className="form-check-input mt-1" name="saved-address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                          <span className="flex-grow-1 small">
                            <span className="fw-semibold"><i className={`bi ${labelIcon(a.label)} me-1`} />{a.label === "College" ? "College / Hostel" : a.label}</span>
                            {a.isDefault && <span className="badge text-bg-primary ms-2">Default</span>}
                            <span className="d-block">{a.recipientName} · <span className="font-mono">{a.phone}</span></span>
                            <span className="d-block text-muted">{a.street}, {a.city}, {a.state} {a.pincode}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-light border btn-sm" onClick={() => setAddrModal(true)}><i className="bi bi-plus-lg me-1" />Add new address</button>
                  <Link href="/profile" className="btn btn-link btn-sm text-decoration-none">Manage addresses</Link>
                </div>
              )}
              {effType === "Home Delivery" && !allDigital && !user && (
                <div className="row g-3 mb-3">
                  <div className="col-sm-4">
                    <label className="form-label" htmlFor="pin">Pincode</label>
                    <input id="pin" className="form-control font-mono" inputMode="numeric" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="110001" required />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="addr">Full address</label>
                    <textarea id="addr" className="form-control" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / flat, street, area, city" required />
                  </div>
                </div>
              )}
              {effType === "CP Store Pickup" && !allDigital && (
                <div className="bg-paper border rounded-3 p-3 small mb-3">
                  <strong>{STORE.name}</strong><br />{STORE.address}<br /><span className="text-muted">{STORE.hours}</span>
                </div>
              )}
              {!savedMode && (
                <>
                  <label className="form-label" htmlFor="phone">Mobile number</label>
                  <div className="input-group" style={{ maxWidth: 320 }}>
                    <span className="input-group-text">+91</span>
                    <input id="phone" className="form-control font-mono" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98100 12345" required />
                  </div>
                </>
              )}
              {eta?.ok && (
                <div className="mt-3 small"><i className="bi bi-clock me-1 text-primary" /><strong>{eta.label}</strong> <span className="text-muted">· {eta.detail}</span></div>
              )}
            </div>
          </div>

          <div className="card rounded-4 mb-4" id="payment">
            <div className="card-body p-4">
              <h2 className="h6 mb-3">3. Payment</h2>
              <PaymentStep value={pay} onChange={(p) => { setPay(p); setPayError(""); }} pickup={pickupSelected} allDigital={allDigital} total={t.total} settings={paySettings} error={payError} />
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card rounded-4" style={{ position: "sticky", top: 140 }}>
            <div className="card-body p-4">
              <h2 className="h6 mb-3">Order summary</h2>
              <ul className="list-unstyled mb-3" style={{ maxHeight: 280, overflowY: "auto" }}>
                {cart.map((i) => (
                  <li key={i.key} className="d-flex align-items-center gap-3 py-2">
                    <div style={{ width: 40 }}><BookCover src={i.coverImage} title={i.title} /></div>
                    <div className="flex-grow-1 min-w-0"><div className="small text-truncate">{i.title}</div><div className="small text-muted">Qty {i.qty}{i.kit ? " · kit" : ""}</div></div>
                    <span className="small tabular">{formatINR(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="row small g-0 border-top pt-3 mb-0">
                <dt className="col-7 fw-normal text-muted">Subtotal</dt><dd className="col-5 text-end mb-1 tabular">{formatINR(t.subtotal)}</dd>
                {t.bundleDiscount > 0 && (<><dt className="col-7 fw-normal text-muted">Kit savings ({t.kitPct}%)</dt><dd className="col-5 text-end mb-1 text-success tabular">−{formatINR(t.bundleDiscount)}</dd></>)}
                <dt className="col-7 fw-normal text-muted">{effType === "CP Store Pickup" ? "Store pickup" : "Delivery"}</dt><dd className="col-5 text-end mb-1 tabular">{t.deliveryFee ? formatINR(t.deliveryFee) : "Free"}</dd>
                {t.codFee > 0 && (<><dt className="col-7 fw-normal text-muted">COD handling fee</dt><dd className="col-5 text-end mb-1 tabular">{formatINR(t.codFee)}</dd></>)}
                <dt className="col-7 fs-6 pt-2">Total</dt><dd className="col-5 text-end fs-5 fw-semibold pt-2 mb-0 tabular">{formatINR(t.total)}</dd>
              </dl>
              {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary w-100 py-2 mt-3" disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm me-2" />}
                {!user ? "Sign in to place order"
                  : busy && (pay.method === "UPI" || pay.method === "CARD") ? "Verifying payment…"
                  : pay.method === "UPI" ? "Verify & Confirm UPI Payment"
                  : pay.method === "CARD" ? `Pay ${formatINR(t.total)} securely`
                  : "Place order"}
              </button>
              <p className="small text-muted text-center mt-2 mb-0">
                {pay.method === "COD" ? "You'll pay when your books arrive." : pay.method === "PAY_AT_STORE" ? "Nothing to pay now — pay at the counter." : "Paid now · refunded automatically if you cancel before dispatch."}
              </p>
            </div>
          </div>
        </div>
      </form>
      <AddressModal
        open={addrModal}
        editing={null}
        defaults={{ name: user?.name, phone: profilePhone || (addresses?.find((a) => a.isDefault)?.phone ?? "") }}
        forceDefault={(addresses?.length ?? 0) === 0}
        onClose={() => setAddrModal(false)}
        onSaved={(list, id) => { setAddresses(list); setAddressId(id); setAddrModal(false); toast({ kind: "success", title: "Address saved to your account" }); }}
      />
    </div>
  );
}
