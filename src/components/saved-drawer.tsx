"use client";

import Link from "next/link";
import { formatINR } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { Offcanvas } from "./ui/overlay";
import { useApp } from "./providers";

export function SavedDrawer() {
  const { saved, savedOpen, setSavedOpen, toggleSaved, addToCart, user, openAuth } = useApp();
  return (
    <Offcanvas
      open={savedOpen}
      onClose={() => setSavedOpen(false)}
      title="Saved for later"
      footer={saved.length > 0 && (
        <button type="button" className="btn btn-primary w-100" onClick={() => { saved.forEach((b) => addToCart(b, { silent: true })); setSavedOpen(false); }}>
          Move all {saved.length} to cart
        </button>
      )}
    >
      {!user && (
        <div className="alert alert-light border small m-3 mb-0">
          <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => { setSavedOpen(false); openAuth("signin"); }}>Sign in</button> to keep your reading list across devices.
        </div>
      )}
      {saved.length === 0 ? (
        <div className="text-center px-4 py-5 text-muted">
          <i className="bi bi-bookmark fs-1" />
          <p className="mt-3 mb-0">Tap the bookmark on any book to save it here.</p>
        </div>
      ) : (
        <ul className="list-unstyled mb-0 px-3">
          {saved.map((b) => (
            <li key={b.id} className="d-flex gap-3 py-3 border-bottom">
              <Link href={`/books/${b.slug}`} onClick={() => setSavedOpen(false)} style={{ width: 52, flexShrink: 0 }}>
                <BookCover src={b.coverImage} title={b.title} />
              </Link>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold small lh-sm">{b.title}</div>
                <div className="small tabular mt-1">{formatINR(b.price)}</div>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => addToCart(b)}>Add to cart</button>
              </div>
              <button type="button" className="btn btn-link btn-sm text-muted p-0 align-self-start" onClick={() => toggleSaved(b)} aria-label={`Remove ${b.title}`}><i className="bi bi-x-lg" /></button>
            </li>
          ))}
        </ul>
      )}
    </Offcanvas>
  );
}
