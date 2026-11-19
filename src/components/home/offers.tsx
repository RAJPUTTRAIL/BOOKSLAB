"use client";

import Link from "next/link";
import type { BookDTO } from "@/lib/catalog";
import { formatINR } from "@/lib/utils";
import { BookCover } from "../book-cover";
import { Countdown } from "../countdown";
import { useApp } from "../providers";

type Offer = { id: string; discountPct: number; endsAt: string; label: string; book: BookDTO };

export function Offers({ offers }: { offers: Offer[] }) {
  const { addToCart } = useApp();
  if (offers.length === 0) return null;
  return (
    <section id="offers" className="py-5" style={{ scrollMarginTop: 120 }}>
      <div className="container">
        <div className="eyebrow mb-1">Limited time</div>
        <h2 className="h3 mb-4">This week&apos;s offers</h2>
        <div className="row g-4">
          {offers.map((o) => (
            <div className="col-md-6" key={o.id}>
              <div className="card rounded-4 h-100">
                <div className="card-body d-flex gap-3">
                  <Link href={`/books/${o.book.slug}`} style={{ width: 88, flexShrink: 0 }}><BookCover src={o.book.coverImage} title={o.book.title} /></Link>
                  <div className="d-flex flex-column flex-grow-1 min-w-0">
                    <div className="small text-success fw-semibold">{o.discountPct}% off · {o.label}</div>
                    <Link href={`/books/${o.book.slug}`} className="text-reset text-decoration-none fw-semibold lh-sm mt-1">{o.book.title}</Link>
                    <div className="small text-muted">{o.book.author}</div>
                    <div className="mt-auto pt-2 d-flex align-items-end justify-content-between">
                      <div>
                        <span className="price">{formatINR(o.book.price)}</span><span className="mrp ms-2">{formatINR(o.book.mrp)}</span>
                        <div className="small text-muted"><i className="bi bi-clock me-1" />Ends in <Countdown endsAt={o.endsAt} /></div>
                      </div>
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => addToCart(o.book)}>Add</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
