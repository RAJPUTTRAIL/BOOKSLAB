"use client";

import Link from "next/link";
import type { BookDTO } from "@/lib/catalog";
import { formatINR, pctOff } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { Countdown } from "./countdown";
import { useApp } from "./providers";

export function BookCard({ book }: { book: BookDTO }) {
  const { addToCart, toggleSaved, isSaved, openReader } = useApp();
  const off = pctOff(book.mrp, book.price);
  const saved = isSaved(book.id);
  const out = !book.digital && book.stock <= 0;
  return (
    <article className="card book-card h-100 rounded-4">
      <div className="p-3 pb-0 position-relative">
        <Link href={`/books/${book.slug}`} aria-label={book.title}>
          <BookCover src={book.coverImage} title={book.title} author={book.author} />
        </Link>
        <button
          type="button"
          onClick={() => toggleSaved(book)}
          className="btn btn-light btn-sm rounded-circle position-absolute shadow-sm"
          style={{ top: "1.4rem", right: "1.4rem", width: 34, height: 34 }}
          aria-label={saved ? "Remove from saved" : "Save for later"}
          aria-pressed={saved}
        >
          <i className={`bi ${saved ? "bi-bookmark-fill text-primary" : "bi-bookmark"}`} />
        </button>
      </div>
      <div className="card-body d-flex flex-column pt-3">
        <div className="small text-muted mb-1">{book.subcategory || book.category}</div>
        <Link href={`/books/${book.slug}`} className="title text-reset text-decoration-none fw-semibold lh-sm">{book.title}</Link>
        <div className="small text-muted mt-1 text-truncate">{book.author}</div>
        {book.drop && (
          <div className="small mt-2 text-success">
            <i className="bi bi-clock me-1" />{book.drop.label} · ends in <Countdown endsAt={book.drop.endsAt} />
          </div>
        )}
        <div className="mt-auto pt-3 d-flex align-items-end justify-content-between gap-2">
          <div>
            <span className="price">{formatINR(book.price)}</span>
            {off > 0 && (
              <div className="small"><span className="mrp me-1">{formatINR(book.mrp)}</span><span className="badge badge-off">{off}% off</span></div>
            )}
          </div>
          <div className="d-flex gap-1">
            <button type="button" className="btn btn-light btn-sm" onClick={() => openReader(book)} title="Look inside" aria-label={`Look inside ${book.title}`}>
              <i className="bi bi-book" />
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => addToCart(book)} disabled={out} aria-label={`Add ${book.title} to cart`}>
              {out ? "Sold out" : <><i className="bi bi-plus-lg" /><span className="d-none d-xl-inline ms-1">Add</span></>}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
