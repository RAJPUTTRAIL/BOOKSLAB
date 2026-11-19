"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookDTO } from "@/lib/catalog";
import { useApp } from "./providers";

export function BookActions({ book }: { book: BookDTO }) {
  const { addToCart, toggleSaved, isSaved, openReader, user, openAuth } = useApp();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const out = !book.digital && book.stock <= 0;
  const max = book.digital ? 5 : Math.min(20, book.stock);

  return (
    <div>
      {!book.digital && (
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className="input-group" style={{ width: 132 }}>
            <button className="btn btn-light border" type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><i className="bi bi-dash" /></button>
            <span className="form-control text-center tabular" aria-live="polite">{qty}</span>
            <button className="btn btn-light border" type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase quantity"><i className="bi bi-plus" /></button>
          </div>
          <span className={`small ${book.stock < 20 ? "text-warning-emphasis" : "text-muted"}`}>{out ? "Currently out of stock" : book.stock < 20 ? `Only ${book.stock} left` : "In stock"}</span>
        </div>
      )}
      <div className="d-grid d-sm-flex gap-2">
        <button type="button" className="btn btn-primary px-4" disabled={out} onClick={() => addToCart(book, { qty })}><i className="bi bi-bag-plus me-2" />Add to cart</button>
        <button type="button" className="btn btn-outline-primary px-4" disabled={out} onClick={() => { addToCart(book, { qty, silent: true }); if (user) router.push("/checkout"); else openAuth("signin", "/checkout"); }}>Buy now</button>
      </div>
      <div className="d-flex gap-3 mt-3">
        <button type="button" className="btn btn-link px-0 text-decoration-none" onClick={() => openReader(book)}><i className="bi bi-book me-1" />Look inside</button>
        <button type="button" className="btn btn-link px-0 text-decoration-none" onClick={() => toggleSaved(book)}>
          <i className={`bi ${isSaved(book.id) ? "bi-bookmark-fill" : "bi-bookmark"} me-1`} />{isSaved(book.id) ? "Saved" : "Save for later"}
        </button>
      </div>
    </div>
  );
}
