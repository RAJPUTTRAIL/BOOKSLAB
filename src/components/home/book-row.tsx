import Link from "next/link";
import type { BookDTO } from "@/lib/catalog";
import { BookCard } from "../book-card";
import { Reveal } from "../reveal";

export function BookRow({ id, eyebrow, title, blurb, books, href }: { id: string; eyebrow: string; title: string; blurb: string; books: BookDTO[]; href: string }) {
  if (books.length === 0) return null;
  return (
    <section id={id} className="py-5" style={{ scrollMarginTop: 120 }}>
      <div className="container">
        <Reveal>
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
            <div>
              <div className="eyebrow mb-1">{eyebrow}</div>
              <h2 className="h3 mb-1">{title}</h2>
              <p className="text-muted mb-0">{blurb}</p>
            </div>
            <Link href={href} className="btn btn-link text-decoration-none px-0">View all <i className="bi bi-arrow-right" /></Link>
          </div>
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-4">
            {books.map((b) => <div className="col" key={b.id}><BookCard book={b} /></div>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
