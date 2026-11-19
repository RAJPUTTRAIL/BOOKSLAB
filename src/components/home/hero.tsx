"use client";

import Link from "next/link";
import type { BookDTO } from "@/lib/catalog";
import type { HeroContent } from "@/lib/content";
import { computeTotals } from "@/lib/pricing";
import { formatINR } from "@/lib/utils";
import { BookCover } from "../book-cover";
import { useApp } from "../providers";

export function Hero({ hero, bundle }: { hero: HeroContent; bundle: BookDTO[] }) {
  const { addToCart, setCartOpen } = useApp();
  const t = computeTotals(bundle.map((b) => ({ price: b.price, quantity: 1, kit: true })), { fulfillment: "PICKUP" });
  return (
    <section className="py-5">
      <div className="container py-lg-4">
        <div className="row g-5 align-items-center">
          <div className="col-lg-7">
            <div className="eyebrow mb-3"><i className="bi bi-geo-alt me-1" />{hero.eyebrow}</div>
            <h1 className="display-5 fw-bold lh-sm mb-3" style={{ maxWidth: 640 }}>{hero.headline}</h1>
            <p className="lead mb-4" style={{ maxWidth: 560 }}>{hero.subhead}</p>
            <div className="d-flex flex-wrap gap-2 mb-4">
              <Link href="/search" className="btn btn-primary btn-lg px-4">Browse the catalog</Link>
              <Link href="/#showcase" className="btn btn-light btn-lg border px-4">See the 2026 Compendium</Link>
            </div>
            <div className="row g-3 mb-4" style={{ maxWidth: 560 }}>
              <div className="col-sm-6">
                <div className="d-flex gap-3 align-items-start border rounded-3 bg-white p-3 h-100">
                  <i className="bi bi-shop fs-4 text-primary" />
                  <div><div className="fw-semibold small">Ready at CP in 2 hours</div><div className="small text-muted">Free pickup from our Inner Circle store</div></div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="d-flex gap-3 align-items-start border rounded-3 bg-white p-3 h-100">
                  <i className="bi bi-truck fs-4 text-primary" />
                  <div><div className="fw-semibold small">Fast Delhi NCR delivery</div><div className="small text-muted">Same day in central Delhi · free above ₹999</div></div>
                </div>
              </div>
            </div>
            {hero.highlights.length > 0 && (
              <ul className="list-unstyled small text-muted mb-0">
                {hero.highlights.map((h) => <li key={h} className="mb-2"><i className="bi bi-check2 text-success me-2" />{h}</li>)}
              </ul>
            )}
          </div>
          {bundle.length > 0 && (
            <div className="col-lg-5">
              <div className="card rounded-4 shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="eyebrow">Featured set</span>
                    {t.kitPct > 0 && <span className="badge badge-off">Save {t.kitPct}%</span>}
                  </div>
                  <div className="row g-2 mb-3">
                    {bundle.slice(0, 3).map((b) => (
                      <div className="col-4" key={b.id}>
                        <Link href={`/books/${b.slug}`}><BookCover src={b.coverImage} title={b.title} eager /></Link>
                      </div>
                    ))}
                  </div>
                  <h2 className="h5 mb-1">{hero.bundleTitle}</h2>
                  <p className="small text-muted mb-3">{hero.bundleSubtitle}</p>
                  <div className="d-flex align-items-center justify-content-between">
                    <div><span className="price fs-5">{formatINR(t.total)}</span><span className="mrp ms-2">{formatINR(t.subtotal)}</span></div>
                    <button type="button" className="btn btn-outline-primary" onClick={() => { bundle.forEach((b) => addToCart(b, { kit: true, silent: true })); setCartOpen(true); }}>Add set to cart</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
