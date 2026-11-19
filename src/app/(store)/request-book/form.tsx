"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Init = { customerName: string; phone: string; email: string; bookTitle: string; authorOrPublisher: string; isbn: string };
type Done = { bookTitle: string; quantity: number; preferredFulfillment: string; phone: string };

export function RequestBookForm({ initial, signedIn }: { initial: Init; signedIn: boolean }) {
  const [f, setF] = useState({ ...initial, editionOrYear: "", quantity: 1, preferredFulfillment: "CP Store Pickup", notes: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (f.bookTitle.trim().length < 2) return setError("Enter the book title.");
    if (f.customerName.trim().length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError("Enter a valid 10-digit mobile number — we'll confirm on WhatsApp or by call.");
    setBusy(true);
    try {
      const res = await fetch("/api/book-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't send your request. Please try again.");
      setDone({ bookTitle: j.request.bookTitle, quantity: j.request.quantity, preferredFulfillment: j.request.preferredFulfillment, phone: j.request.phone });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="container py-5" style={{ maxWidth: 620 }}>
        <div className="card rounded-4 text-center" data-request-confirmation>
          <div className="card-body p-4 p-md-5">
            <div className="rounded-circle bg-success-subtle text-success d-inline-grid mb-3" style={{ width: 64, height: 64, placeItems: "center" }}><i className="bi bi-check2 fs-2" /></div>
            <h1 className="h4">Thank you! Request received</h1>
            <p className="text-muted">Our Connaught Place sourcing desk will check availability and notify you shortly on <span className="font-mono text-body">{done.phone}</span>.</p>
            <div className="bg-paper border rounded-3 px-3 py-2 small d-inline-block mb-4">
              <strong>{done.bookTitle}</strong> · {done.quantity} {done.quantity === 1 ? "copy" : "copies"} · {done.preferredFulfillment}
            </div>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {signedIn && <Link href="/my-orders?tab=requests" className="btn btn-light border">Track in My Book Requests</Link>}
              <button type="button" className="btn btn-light border" onClick={() => { setDone(null); setF((x) => ({ ...x, bookTitle: "", authorOrPublisher: "", isbn: "", editionOrYear: "", quantity: 1, notes: "" })); }}>Request another book</button>
              <Link href="/search" className="btn btn-primary">Continue browsing</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 620 }}>
      <div className="text-center mb-4">
        <div className="eyebrow mb-1">Connaught Place sourcing desk</div>
        <h1 className="h3 mb-1">Can&apos;t find a book?</h1>
        <p className="text-muted mb-0">Tell us what you need — we&apos;ll check with our publishers and distributors and get back to you, usually within a working day.</p>
      </div>
      <form className="card rounded-4" onSubmit={submit} noValidate>
        <div className="card-body p-4">
          <h2 className="h6 mb-3">The book</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="br-title">Book title <span className="text-danger">*</span></label>
            <input id="br-title" className="form-control" value={f.bookTitle} onChange={(e) => set("bookTitle", e.target.value)} placeholder="e.g. Mulla on the Code of Civil Procedure" required autoFocus={!initial.bookTitle} maxLength={200} />
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-7">
              <label className="form-label" htmlFor="br-author">Author / Publisher</label>
              <input id="br-author" className="form-control" value={f.authorOrPublisher} onChange={(e) => set("authorOrPublisher", e.target.value)} maxLength={120} />
            </div>
            <div className="col-sm-5">
              <label className="form-label" htmlFor="br-isbn">ISBN <span className="text-muted fw-normal">(if known)</span></label>
              <input id="br-isbn" className="form-control font-mono" inputMode="numeric" value={f.isbn} onChange={(e) => set("isbn", e.target.value.replace(/[^\dXx-]/g, "").slice(0, 17))} placeholder="978…" />
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-sm-7">
              <label className="form-label" htmlFor="br-edition">Preferred edition</label>
              <input id="br-edition" className="form-control" list="br-editions" value={f.editionOrYear} onChange={(e) => set("editionOrYear", e.target.value)} placeholder="Latest" maxLength={60} />
              <datalist id="br-editions"><option value="Latest" /><option value="2026 Edition" /><option value="2025 Edition" /><option value="Any edition" /></datalist>
            </div>
            <div className="col-sm-5">
              <label className="form-label" htmlFor="br-qty">Quantity</label>
              <input id="br-qty" type="number" min={1} max={50} className="form-control" value={f.quantity} onChange={(e) => set("quantity", Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <fieldset className="mb-3">
            <legend className="form-label">How would you like it?</legend>
            <div className="row g-2">
              {([["CP Store Pickup", "bi-shop", "Collect from our Inner Circle store"], ["Home Delivery", "bi-truck", "Delhi NCR and across India"]] as const).map(([k, icon, sub]) => (
                <div className="col-sm-6" key={k}>
                  <label className={cn("d-block border rounded-3 p-3 h-100", f.preferredFulfillment === k ? "border-primary bg-primary-subtle" : "bg-white")} style={{ cursor: "pointer" }}>
                    <input type="radio" className="form-check-input me-2" name="fulfillment" checked={f.preferredFulfillment === k} onChange={() => set("preferredFulfillment", k)} />
                    <i className={`bi ${icon} me-1`} /><strong>{k}</strong>
                    <span className="d-block small text-muted ms-4">{sub}</span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="mb-4">
            <label className="form-label" htmlFor="br-notes">Additional notes</label>
            <textarea id="br-notes" className="form-control" rows={2} maxLength={500} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Need urgently for the May exam" />
          </div>

          <h2 className="h6 mb-3 border-top pt-4">Your details</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="br-name">Name <span className="text-danger">*</span></label>
            <input id="br-name" className="form-control" value={f.customerName} onChange={(e) => set("customerName", e.target.value)} autoComplete="name" maxLength={80} />
          </div>
          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="br-phone">Mobile <span className="text-danger">*</span></label>
              <div className="input-group">
                <span className="input-group-text">+91</span>
                <input id="br-phone" className="form-control font-mono" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98100 12345" autoComplete="tel-national" />
              </div>
              <div className="form-text">We&apos;ll confirm on WhatsApp or by call.</div>
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="br-email">Email <span className="text-muted fw-normal">(optional)</span></label>
              <input id="br-email" type="email" className="form-control" value={f.email} onChange={(e) => set("email", e.target.value.trim())} autoComplete="email" maxLength={120} />
            </div>
          </div>
          {/* Honeypot: hidden from people, tempting for bots. */}
          <div className="visually-hidden" aria-hidden="true">
            <label htmlFor="br-website">Website</label>
            <input id="br-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
        </div>
        <div className="card-footer bg-transparent border-0 px-4 pb-4 pt-0">
          <button type="submit" className="btn btn-primary w-100 py-2" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Send request</button>
          <p className="small text-muted text-center mt-2 mb-0">{signedIn ? "You can follow this request under My Orders → My Book Requests." : "No account needed. Sign in first if you'd like to track the request online."}</p>
        </div>
      </form>
    </div>
  );
}
