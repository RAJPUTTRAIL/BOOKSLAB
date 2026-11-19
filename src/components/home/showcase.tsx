"use client";

import { useEffect, useRef, useState } from "react";
import type { BookDTO } from "@/lib/catalog";
import type { ShowcaseContent } from "@/lib/content";
import { computeTotals } from "@/lib/pricing";
import { cn, formatINR } from "@/lib/utils";
import { BookCover } from "../book-cover";
import { useApp } from "../providers";

/** Editorial flagship showcase: the cover stays pinned while short chapters scroll past. */
export function Showcase({ content, book, addons }: { content: ShowcaseContent; book: BookDTO | null; addons: BookDTO[] }) {
  const { addToCart, setCartOpen, openReader } = useApp();
  const [step, setStep] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const [edition, setEdition] = useState(Math.max(0, content.editions.findIndex((e) => e.highlight)));
  const [compare, setCompare] = useState(false);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [content.callouts.length]);

  if (!book) return null;
  const itemsFor = (i: number) => [book, ...addons.filter((a) => content.editions[i]?.addonSlugs.includes(a.slug))];
  const totalsFor = (i: number) => {
    const items = itemsFor(i);
    return computeTotals(items.map((b) => ({ price: b.price, quantity: 1, kit: items.length > 1 })), { fulfillment: "PICKUP" });
  };
  const ed = content.editions[edition] ?? content.editions[0];
  const et = totalsFor(edition);
  const mrp = itemsFor(edition).reduce((s, b) => s + b.mrp, 0);
  const addEdition = () => {
    const items = itemsFor(edition);
    items.forEach((b) => addToCart(b, { kit: items.length > 1, silent: true }));
    setCartOpen(true);
  };

  return (
    <section id="showcase" className="py-5 bg-white border-top border-bottom" style={{ scrollMarginTop: 120 }}>
      <div className="container py-lg-4">
        <div className="text-center mb-5 mx-auto" style={{ maxWidth: 640 }}>
          <div className="eyebrow mb-2">{content.eyebrow}</div>
          <h2 className="display-6 fw-bold">{content.headline}</h2>
          <p className="lead mb-0">{content.tagline}</p>
        </div>

        <div className="row g-5">
          <div className="col-lg-5">
            <div className="showcase-sticky">
              <div className="position-relative mx-auto" style={{ maxWidth: 340, transition: "transform .6s ease", transform: `scale(${1 - step * 0.015})` }}>
                <BookCover src={book.coverImage} title={book.title} author={book.author} />
                {content.hotspots.map((h, i) => (
                  <button key={i} type="button" className="hotspot" style={{ left: `${h.x}%`, top: `${h.y}%` }} onClick={() => setHot(hot === i ? null : i)} aria-label={`Detail: ${h.title}`} aria-expanded={hot === i}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="mx-auto mt-3" style={{ maxWidth: 340, minHeight: 72 }} aria-live="polite">
                {hot !== null && content.hotspots[hot] ? (
                  <div className="surface p-3 small">
                    <strong>{content.hotspots[hot].title}.</strong> <span className="text-muted">{content.hotspots[hot].body}</span>
                  </div>
                ) : <p className="small text-muted text-center mb-0">Tap the numbered markers to explore details.</p>}
              </div>
            </div>
          </div>
          <div className="col-lg-7">
            {content.callouts.map((c, i) => (
              <div key={i} ref={(el) => { stepRefs.current[i] = el; }} data-step={i} className={cn("showcase-step", step === i && "active")}>
                <div className="step-card">
                  <div className="font-mono text-primary fs-4 fw-semibold mb-1">{c.stat}</div>
                  <h3 className="h3 mb-2">{c.title}</h3>
                  <p className="text-muted fs-5 mb-0" style={{ maxWidth: 520 }}>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-lg-4">
          <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 mb-4">
            <h3 className="h4 mb-0 me-2">Compare editions</h3>
            <div className="btn-group" role="group" aria-label="Edition">
              {content.editions.map((e, i) => (
                <button key={e.name} type="button" className={cn("btn btn-outline-primary", edition === i && !compare && "active")} onClick={() => { setEdition(i); setCompare(false); }}>{e.name}</button>
              ))}
            </div>
            <div className="form-check form-switch mb-0">
              <input className="form-check-input" type="checkbox" role="switch" id="compare-switch" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
              <label className="form-check-label small" htmlFor="compare-switch">Side by side</label>
            </div>
          </div>

          {compare ? (
            <div className="row g-4 justify-content-center">
              {content.editions.map((e, i) => (
                <div className="col-md-6 col-lg-4" key={e.name}>
                  <div className={cn("card rounded-4 h-100", e.highlight && "border-primary")}>
                    <div className="card-body p-4 d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center">
                        <h4 className="h5 mb-0">{e.name}</h4>
                        {e.highlight && <span className="badge text-bg-primary">Recommended</span>}
                      </div>
                      <div className="price fs-3 my-3">{formatINR(totalsFor(i).total)}</div>
                      <ul className="list-unstyled small mb-4">
                        {e.features.map((f) => <li key={f} className="mb-2"><i className="bi bi-check2 text-success me-2" />{f}</li>)}
                      </ul>
                      <button type="button" className={cn("btn mt-auto", e.highlight ? "btn-primary" : "btn-outline-primary")} onClick={() => { setEdition(i); setCompare(false); }}>Choose {e.name}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card rounded-4 mx-auto" style={{ maxWidth: 760 }}>
              <div className="card-body p-4 row g-4 align-items-center">
                <div className="col-md-7">
                  <h4 className="h5">{book.title} — {ed.name}</h4>
                  <ul className="list-unstyled small mb-0">
                    {ed.features.map((f) => <li key={f} className="mb-2"><i className="bi bi-check2 text-success me-2" />{f}</li>)}
                  </ul>
                </div>
                <div className="col-md-5 text-md-end">
                  <div className="price fs-3">{formatINR(et.total)}</div>
                  <div className="mrp">{formatINR(mrp)}</div>
                  {et.bundleDiscount > 0 && <div className="small text-success">Includes {formatINR(et.bundleDiscount)} kit savings</div>}
                  <div className="d-flex gap-2 justify-content-md-end mt-3">
                    <button type="button" className="btn btn-light border" onClick={() => openReader(book)}>Look inside</button>
                    <button type="button" className="btn btn-primary" onClick={addEdition}>Add {ed.name}</button>
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
