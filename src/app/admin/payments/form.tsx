"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useApp } from "@/components/providers";
import type { PaymentSettings } from "@/lib/payment-settings";
import { UPI_ID, upiUri } from "@/lib/upi";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

type Draft = Omit<PaymentSettings, "updatedAt">;
const strip = ({ updatedAt: _u, ...d }: PaymentSettings): Draft => d;

const METHODS: { key: keyof Draft; label: string; sub: string; icon: string }[] = [
  { key: "enableUpi", label: "UPI", sub: "Google Pay, PhonePe, Paytm, BHIM — UPI ID or QR", icon: "bi-phone" },
  { key: "enableCod", label: "Cash on Delivery (COD)", sub: "Home Delivery orders, paid at the door", icon: "bi-cash-stack" },
  { key: "enablePayAtStore", label: "Pay at CP Store", sub: "Pickup orders, paid at the Inner Circle counter", icon: "bi-shop" },
  { key: "enableCard", label: "Debit / Credit Card", sub: "Visa, Mastercard, RuPay", icon: "bi-credit-card" },
];

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const { toast } = useApp();
  const [saved, setSaved] = useState<PaymentSettings>(initial);
  const [d, setD] = useState<Draft>(strip(initial));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setSuccess(false); };
  const dirty = JSON.stringify(d) !== JSON.stringify(strip(saved));
  const upiOk = UPI_ID.test(d.storeUpiId.trim());
  const homeOk = d.enableUpi || d.enableCard || d.enableCod;
  const pickupOk = d.enableUpi || d.enableCard || d.enablePayAtStore;

  // Live preview of the dynamic QR (₹100 sample) for the UPI ID being edited.
  useEffect(() => {
    if (!upiOk || d.upiQrImage) { setPreview(null); return; }
    let live = true;
    QRCode.toDataURL(upiUri({ vpa: d.storeUpiId.trim().toLowerCase(), name: d.storeUpiName.trim() || "Bookslab" }, 100, "Preview"), { margin: 1, width: 180, color: { dark: "#1E293B", light: "#FFFFFF" } })
      .then((u) => live && setPreview(u)).catch(() => {});
    return () => { live = false; };
  }, [d.storeUpiId, d.storeUpiName, d.upiQrImage, upiOk]);

  const upload = async (file: File) => {
    setUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/settings/qr", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      set("upiQrImage", j.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/settings/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, codFee: Number(d.codFee) || 0 }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't save payment settings.");
      setSaved(j.settings); setD(strip(j.settings)); setSuccess(true);
      toast({ kind: "success", title: "Payment settings saved", body: "Checkout now uses these settings." });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div>
          <div className="eyebrow">Store configuration</div>
          <h1 className="h3 mb-0">Payment settings</h1>
          <p className="small text-muted mb-0">Changes apply to the storefront checkout as soon as you save.{saved.updatedAt && <> Last saved {formatDateTime(saved.updatedAt)}.</>}</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-light border" disabled={!dirty || busy} onClick={() => { setD(strip(saved)); setError(""); }}>Discard</button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || busy || !upiOk}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save changes</button>
        </div>
      </div>

      {success && <div className="alert alert-success small py-2" role="status"><i className="bi bi-check-circle-fill me-2" />Payment settings saved. Customers will see the changes on their next checkout.</div>}
      {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card rounded-4 h-100">
            <div className="card-body p-4">
              <h2 className="h5 mb-1">Store UPI details</h2>
              <p className="small text-muted mb-4">Customers pay to this UPI ID — it appears on the checkout QR code and payment screen.</p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="s-upi">Store UPI ID</label>
                  <input id="s-upi" className={cn("form-control font-mono", d.storeUpiId && !upiOk && "is-invalid")} value={d.storeUpiId} onChange={(e) => set("storeUpiId", e.target.value.replace(/\s/g, ""))} placeholder="bookslab@hdfcbank" spellCheck={false} />
                  <div className="invalid-feedback">Use the format name@bank, e.g. yourname@okaxis.</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="s-name">Merchant display name</label>
                  <input id="s-name" className="form-control" value={d.storeUpiName} onChange={(e) => set("storeUpiName", e.target.value)} maxLength={60} />
                </div>
              </div>

              <h3 className="h6 mt-4 mb-2">UPI QR code at checkout</h3>
              <div className="d-flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="QR code source">
                <label className={cn("btn btn-sm rounded-pill", !d.upiQrImage ? "btn-primary" : "btn-light border")}>
                  <input type="radio" className="visually-hidden" name="qr-src" checked={!d.upiQrImage} onChange={() => set("upiQrImage", null)} />
                  <i className="bi bi-qr-code me-1" />Auto-generate (includes the exact amount)
                </label>
                <label className={cn("btn btn-sm rounded-pill", d.upiQrImage ? "btn-primary" : "btn-light border")} onClick={(e) => { if (!d.upiQrImage) { e.preventDefault(); fileRef.current?.click(); } }}>
                  <i className="bi bi-upload me-1" />Use my bank&apos;s QR image
                </label>
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="d-none" aria-label="Upload UPI QR image" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <div className="bg-white border rounded-3 p-2 d-grid" style={{ width: 196, height: 196, placeItems: "center" }}>
                  {uploading ? <span className="spinner-border spinner-border-sm text-muted" />
                    : d.upiQrImage ? <img src={d.upiQrImage} alt="Uploaded store UPI QR code" width={176} height={176} style={{ objectFit: "contain" }} data-qr-preview="uploaded" />
                    : preview ? <img src={preview} alt="Generated UPI QR preview" width={176} height={176} data-qr-preview="generated" />
                    : <span className="small text-muted text-center px-2">Enter a valid UPI ID to preview</span>}
                </div>
                <div className="small text-muted" style={{ maxWidth: 300 }}>
                  {d.upiQrImage ? (
                    <>Customers scan your bank&apos;s QR and type the amount themselves.
                      <div className="d-flex gap-2 mt-2">
                        <button type="button" className="btn btn-light border btn-sm" onClick={() => fileRef.current?.click()}>Replace image</button>
                        <button type="button" className="btn btn-light border btn-sm" onClick={() => set("upiQrImage", null)}>Remove</button>
                      </div>
                    </>
                  ) : (
                    <>A fresh QR is generated for every order from <span className="font-mono text-body">{d.storeUpiId || "your UPI ID"}</span>, with the exact payable amount filled in. Preview shows a ₹100 sample.</>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="card rounded-4 h-100">
            <div className="card-body p-4">
              <h2 className="h5 mb-1">Payment methods</h2>
              <p className="small text-muted mb-3">Turn methods on or off across the storefront checkout.</p>
              <div className="list-group list-group-flush mb-3">
                {METHODS.map((m) => (
                  <div key={m.key} className="list-group-item px-0 d-flex align-items-center gap-3">
                    <i className={`bi ${m.icon} fs-5 text-primary`} aria-hidden />
                    <label className="flex-grow-1 mb-0" htmlFor={`sw-${m.key}`}>
                      <span className="fw-semibold d-block">{m.label}</span>
                      <span className="small text-muted">{m.sub}</span>
                    </label>
                    <div className="form-check form-switch mb-0">
                      <input id={`sw-${m.key}`} className="form-check-input" type="checkbox" role="switch" checked={!!d[m.key]} onChange={(e) => set(m.key, e.target.checked as never)} />
                    </div>
                  </div>
                ))}
              </div>
              {!homeOk && <div className="alert alert-warning small py-2">Home Delivery needs at least one method: UPI, Card or COD.</div>}
              {!pickupOk && <div className="alert alert-warning small py-2">CP Store Pickup needs at least one method: UPI, Card or Pay at Store.</div>}
              {!d.enableUpi && !d.enableCard && <div className="alert alert-light border small py-2">With UPI and Card both off, digital titles (e-books, subscriptions) can&apos;t be bought online.</div>}

              <label className="form-label mt-2" htmlFor="s-cod">COD handling fee</label>
              <div className="input-group" style={{ maxWidth: 200 }}>
                <span className="input-group-text">₹</span>
                <input id="s-cod" className="form-control tabular" inputMode="numeric" value={String(d.codFee)} disabled={!d.enableCod} onChange={(e) => set("codFee", Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0)} />
              </div>
              <div className="form-text">{d.codFee > 0 ? `${formatINR(d.codFee)} is added to Cash on Delivery orders and shown in the price breakdown.` : "No fee — Cash on Delivery costs the same as other methods."}</div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
