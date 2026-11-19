"use client";

import { useEffect, useState } from "react";
import { RETURN_REASONS, RETURN_TYPES } from "@/lib/constants";
import type { OrderDTO } from "@/lib/orders";
import { cn, formatINR } from "@/lib/utils";
import { Modal } from "./ui/overlay";

type Photo = { file: File; preview: string };
const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

/** Three calm steps: what & which books → why → photos. Saves to /api/orders/[id]/return. */
export function ReturnRequestModal({ order, onClose, onSubmitted }: { order: OrderDTO | null; onClose: () => void; onSubmitted: (o: OrderDTO) => void }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<(typeof RETURN_TYPES)[number]>("Replacement");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lines = (order?.items ?? []).filter((i) => i.bookId && (i.format === "Paperback" || i.format === "Hardcover"));
  // Merge duplicate lines (e.g. same book bought singly and in a kit).
  const books = Object.values(lines.reduce<Record<string, { bookId: string; title: string; max: number; price: number }>>((acc, i) => {
    const k = i.bookId!;
    acc[k] = acc[k] ? { ...acc[k], max: acc[k].max + i.quantity } : { bookId: k, title: i.title, max: i.quantity, price: i.price };
    return acc;
  }, {}));

  useEffect(() => {
    if (!order) return;
    setStep(1); setType("Replacement"); setReason(""); setDescription(""); setError(""); setBusy(false);
    setQty(books.length === 1 ? { [books[0].bookId]: 1 } : {});
    setPhotos((p) => { p.forEach((x) => URL.revokeObjectURL(x.preview)); return []; });
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = books.filter((b) => (qty[b.bookId] ?? 0) > 0);
  const value = selected.reduce((s, b) => s + b.price * qty[b.bookId], 0);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) { setError(`Up to ${MAX_PHOTOS} photos.`); break; }
      if (!/^image\/(jpeg|png|webp|avif)$/.test(f.type)) { setError(`"${f.name}" isn't a JPG, PNG or WebP photo.`); continue; }
      if (f.size > MAX_BYTES) { setError(`"${f.name}" is larger than 5 MB.`); continue; }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPhotos(next);
  };
  const removePhoto = (i: number) => setPhotos((p) => { URL.revokeObjectURL(p[i].preview); return p.filter((_, j) => j !== i); });

  const next = () => {
    setError("");
    if (step === 1 && selected.length === 0) return setError("Select the book(s) with the problem.");
    if (step === 2 && !reason) return setError("Choose a reason.");
    if (step === 2 && reason === "Other" && description.trim().length < 5) return setError("Please describe the problem briefly.");
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!order) return;
    if (photos.length === 0) return setError("Add at least one clear photo of the problem.");
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append("files", p.file));
      const up = await fetch("/api/returns/upload", { method: "POST", body: fd });
      const u = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(u.error ?? "Couldn't upload the photos.");
      const res = await fetch(`/api/orders/${order.id}/return`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: type, reason, description, proofImages: u.urls, items: selected.map((b) => ({ bookId: b.bookId, quantity: qty[b.bookId] })) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't submit your request.");
      onSubmitted(j.order);
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  };

  const STEPS = ["Request", "Reason", "Photos"];
  return (
    <Modal
      open={!!order}
      onClose={() => !busy && onClose()}
      title="Return or replace a book"
      footer={
        <>
          {step > 1 ? <button type="button" className="btn btn-light border me-auto" onClick={() => { setError(""); setStep((s) => s - 1); }} disabled={busy}>Back</button> : <button type="button" className="btn btn-light border me-auto" onClick={onClose}>Cancel</button>}
          {step < 3
            ? <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
            : <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Submit request</button>}
        </>
      }
    >
      {order && (
        <div data-return-step={step}>
          <ol className="list-unstyled d-flex gap-2 small mb-4" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} className={cn("flex-fill text-center border-bottom pb-2", i + 1 === step ? "border-primary border-2 fw-semibold text-body" : i + 1 < step ? "border-primary text-muted" : "text-muted")} aria-current={i + 1 === step ? "step" : undefined}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>

          {step === 1 && (
            <>
              <fieldset className="mb-3">
                <legend className="form-label small fw-semibold">What would you like?</legend>
                <div className="row g-2">
                  {RETURN_TYPES.map((t) => (
                    <div className="col-sm-6" key={t}>
                      <label className={cn("d-block border rounded-3 p-3 h-100", type === t ? "border-primary bg-primary-subtle" : "bg-white")} style={{ cursor: "pointer" }}>
                        <input type="radio" className="form-check-input me-2" name="return-type" checked={type === t} onChange={() => setType(t)} />
                        <strong>{t === "Replacement" ? "Free Replacement" : "Return & Refund"}</strong>
                        <span className="d-block small text-muted mt-1 ms-4">{t === "Replacement" ? "We send a fresh copy of the same edition." : "We collect the book and refund what you paid for it."}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="form-label small fw-semibold">Which book(s) are affected?</legend>
                <div className="d-grid gap-2">
                  {books.map((b) => {
                    const on = (qty[b.bookId] ?? 0) > 0;
                    return (
                      <div key={b.bookId} className={cn("border rounded-3 px-3 py-2 d-flex align-items-center gap-2", on ? "border-primary" : "bg-white")} data-return-book={b.bookId}>
                        <input type="checkbox" className="form-check-input m-0" id={`rb-${b.bookId}`} checked={on} onChange={(e) => setQty((q) => ({ ...q, [b.bookId]: e.target.checked ? 1 : 0 }))} />
                        <label htmlFor={`rb-${b.bookId}`} className="small flex-grow-1 mb-0">{b.title}</label>
                        {on && b.max > 1 && (
                          <select className="form-select form-select-sm" style={{ width: 80 }} value={qty[b.bookId]} onChange={(e) => setQty((q) => ({ ...q, [b.bookId]: Number(e.target.value) }))} aria-label={`Quantity of ${b.title}`}>
                            {Array.from({ length: b.max }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
                {type === "Return & Refund" && value > 0 && <div className="small text-muted mt-2">Refund on completion: <strong className="text-body">{formatINR(value)}</strong> to your original payment method.</div>}
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              <label className="form-label small fw-semibold" htmlFor="rr-reason">Reason</label>
              <select id="rr-reason" className="form-select mb-3" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="" disabled>Choose a reason…</option>
                {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <label className="form-label small fw-semibold" htmlFor="rr-desc">Tell us a little more <span className="text-muted fw-normal">{reason === "Other" ? "" : "(optional)"}</span></label>
              <textarea id="rr-desc" className="form-control" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. pages 113–128 are blank" />
            </>
          )}

          {step === 3 && (
            <>
              <p className="small text-muted">Add 1–3 clear photos — the damaged cover, the misprinted page or the wrong edition&apos;s title page. JPG, PNG or WebP, up to 5 MB each.</p>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {photos.map((p, i) => (
                  <div key={p.preview} className="position-relative border rounded-3 overflow-hidden" style={{ width: 96, height: 96 }}>
                    <img src={p.preview} alt={`Proof photo ${i + 1}`} className="w-100 h-100" style={{ objectFit: "cover" }} />
                    <button type="button" className="btn btn-light btn-sm position-absolute top-0 end-0 m-1 py-0 px-1" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}><i className="bi bi-x" /></button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="border rounded-3 d-grid text-muted small text-center" style={{ width: 96, height: 96, placeItems: "center", cursor: "pointer", borderStyle: "dashed" }}>
                    <span><i className="bi bi-camera fs-4 d-block" />Add photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="visually-hidden" aria-label="Add proof photos" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              <div className="bg-paper border rounded-3 small px-3 py-2">
                <strong>{type === "Replacement" ? "Free Replacement" : "Return & Refund"}</strong> · {selected.map((b) => `${qty[b.bookId]}× ${b.title}`).join(", ")} · {reason}
              </div>
            </>
          )}
          {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
