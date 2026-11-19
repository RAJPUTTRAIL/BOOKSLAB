"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Aspect-ratio-locked (2:3) cover image with a calm typographic fallback. */
export function BookCover({ src, title, author, className, eager }: { src?: string | null; title: string; author?: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("book-cover", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Cover of ${title}`} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="book-cover-fallback" aria-label={`Cover of ${title}`}>
          <span className="small text-uppercase opacity-75" style={{ letterSpacing: ".08em", fontSize: ".6rem" }}>Bookslab</span>
          <div>
            <div className="fw-semibold lh-sm" style={{ fontSize: ".85rem" }}>{title}</div>
            {author && <div className="opacity-75 mt-1" style={{ fontSize: ".65rem" }}>{author}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
