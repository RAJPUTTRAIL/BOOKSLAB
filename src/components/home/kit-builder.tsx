"use client";

import { useMemo, useState } from "react";
import type { BookDTO } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/categories";
import { computeTotals, KIT_TIERS, kitTier } from "@/lib/pricing";
import { cn, formatINR } from "@/lib/utils";
import { BookCover } from "../book-cover";
import { useApp } from "../providers";

/** Build an exam/office kit: tap or drag books into the kit; tiered savings update live. */
export function KitBuilder({ books }: { books: BookDTO[] }) {
  const { addToCart, setCartOpen, toast } = useApp();
  const [cat, setCat] = useState<string>("academic");
  const [kit, setKit] = useState<BookDTO[]>([]);
  const [over, setOver] = useState(false);
  const shelf = useMemo(() => books.filter((b) => b.categoryKey === cat && (b.digital || b.stock > 0)), [books, cat]);
  const t = computeTotals(kit.map((b) => ({ price: b.price, quantity: 1, kit: true, digital: b.digital })), { fulfillment: "DELIVERY" });
  const { tier, next } = kitTier(kit.length);
  const add = (b: BookDTO) => {
    if (kit.some((k) => k.id === b.id)) return;
    if (kit.length >= 10) return toast({ kind: "info", title: "A kit can hold up to 10 titles" });
    setKit((k) => [...k, b]);
  };

  return (
    <section id="kit-builder" className="py-5 bg-white border-top border-bottom" style={{ scrollMarginTop: 120 }}>
      <div className="container">
        <div className="eyebrow mb-1">Bundle and save</div>
        <h2 className="h3 mb-1">Build your exam or office kit</h2>
        <p className="text-muted mb-4">
          Kit savings: {KIT_TIERS.map((k) => `${k.min}+ books ${k.pct}%`).join(" · ")}
        </p>
        <div className="row g-4">
          <div className="col-lg-7">
            <ul className="nav nav-pills pill-tabs mb-3 flex-nowrap scroll-x">
              {CATEGORIES.map((c) => (
                <li className="nav-item" key={c.key}><button type="button" className={cn("nav-link", cat === c.key && "active")} onClick={() => setCat(c.key)}>{c.label}</button></li>
              ))}
            </ul>
            <div className="row row-cols-3 row-cols-sm-4 g-3" style={{ maxHeight: 520, overflowY: "auto" }}>
              {shelf.map((b) => {
                const inKit = kit.some((k) => k.id === b.id);
                return (
                  <div className="col" key={b.id}>
                    <div draggable={!inKit} onDragStart={(e) => e.dataTransfer.setData("text/plain", b.id)} className={cn("position-relative", inKit && "opacity-50")} style={{ cursor: inKit ? "default" : "grab" }}>
                      <BookCover src={b.coverImage} title={b.title} />
                      <div className="small lh-sm mt-2 text-truncate" title={b.title}>{b.title}</div>
                      <div className="small text-muted tabular">{formatINR(b.price)}</div>
                      <button type="button" className="btn btn-light btn-sm border rounded-circle position-absolute shadow-sm" style={{ top: 6, right: 6, width: 30, height: 30, padding: 0 }} disabled={inKit} onClick={() => add(b)} aria-label={`Add ${b.title} to kit`}>
                        <i className={`bi ${inKit ? "bi-check2" : "bi-plus"}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-lg-5">
            <div
              className={cn("card rounded-4 h-100", over && "border-primary")}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const b = books.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (b) add(b); }}
            >
              <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="h6 mb-0">Your kit ({kit.length})</h3>
                  {kit.length > 0 && <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => setKit([])}>Clear</button>}
                </div>
                <div className="progress mb-2" style={{ height: 6 }} role="progressbar" aria-label="Kit discount progress" aria-valuenow={kit.length} aria-valuemin={0} aria-valuemax={7}>
                  <div className="progress-bar" style={{ width: `${Math.min(100, (kit.length / 7) * 100)}%`, transition: "width .3s ease" }} />
                </div>
                <p className="small text-muted">
                  {tier ? <span className="text-success">{tier.pct}% kit savings applied. </span> : null}
                  {next ? `Add ${next.min - kit.length} more for ${next.pct}% off.` : "You've reached the best kit price."}
                </p>
                <ul className="list-unstyled flex-grow-1 mb-3">
                  {kit.length === 0 && <li className="text-center text-muted small border rounded-3 py-5" style={{ borderStyle: "dashed" }}>Drag books here, or tap +</li>}
                  {kit.map((b) => (
                    <li key={b.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                      <div style={{ width: 30 }}><BookCover src={b.coverImage} title={b.title} /></div>
                      <span className="small flex-grow-1 text-truncate">{b.title}</span>
                      <span className="small tabular">{formatINR(b.price)}</span>
                      <button type="button" className="btn btn-link btn-sm text-muted p-0" onClick={() => setKit((k) => k.filter((x) => x.id !== b.id))} aria-label={`Remove ${b.title}`}><i className="bi bi-x-lg" /></button>
                    </li>
                  ))}
                </ul>
                <dl className="row small g-0 mb-3">
                  <dt className="col-7 fw-normal text-muted">Subtotal</dt><dd className="col-5 text-end mb-1 tabular">{formatINR(t.subtotal)}</dd>
                  <dt className="col-7 fw-normal text-muted">Kit savings</dt><dd className="col-5 text-end mb-1 text-success tabular">−{formatINR(t.bundleDiscount)}</dd>
                  <dt className="col-7">Kit total</dt><dd className="col-5 text-end mb-0 fw-semibold tabular">{formatINR(t.subtotal - t.bundleDiscount)}</dd>
                </dl>
                <button type="button" className="btn btn-primary" disabled={kit.length === 0} onClick={() => { kit.forEach((b) => addToCart(b, { kit: true, silent: true })); setKit([]); setCartOpen(true); }}>Add kit to cart</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
