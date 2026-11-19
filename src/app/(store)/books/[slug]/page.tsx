import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { BookActions } from "@/components/book-actions";
import { BookCard } from "@/components/book-card";
import { Countdown } from "@/components/countdown";
import { DeliveryEstimator } from "@/components/delivery-estimator";
import { getBookBySlug, listBooks } from "@/lib/catalog";
import { categoryByValue } from "@/lib/categories";
import { formatINR, pctOff } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getBookBySlug((await params).slug).catch(() => null);
  return { title: b ? b.title : "Book not found", description: b?.description };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const book = await getBookBySlug((await params).slug);
  if (!book) notFound();
  const cat = categoryByValue(book.category);
  const related = await listBooks({ category: book.category, NOT: { slug: book.slug } }, 4, { rating: "desc" });
  const off = pctOff(book.mrp, book.price);
  const specs: [string, string][] = [
    ["ISBN-13", book.isbn],
    ["Edition", `${book.edition} (${book.year})`],
    ["Publisher", book.publisher],
    ["Format", book.format],
    ...(book.pages ? ([["Pages", book.pages.toLocaleString("en-IN")]] as [string, string][]) : []),
    ["Category", book.subcategory ? `${book.category} · ${book.subcategory}` : book.category],
  ];

  return (
    <div className="container py-4 py-lg-5">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><Link href="/">Home</Link></li>
          <li className="breadcrumb-item"><Link href={`/search?c=${cat?.key ?? "all"}`}>{cat?.label ?? "Books"}</Link></li>
          <li className="breadcrumb-item active text-truncate" aria-current="page" style={{ maxWidth: 260 }}>{book.title}</li>
        </ol>
      </nav>
      <div className="row g-5 mt-1">
        <div className="col-md-5 col-lg-4">
          <div style={{ position: "sticky", top: 140 }}>
            <BookCover src={book.coverImage} title={book.title} author={book.author} eager />
            {book.galleryImages.length > 0 && (
              <div className="row g-2 mt-2">
                {book.galleryImages.slice(0, 4).map((g) => (
                  <div className="col-3" key={g}><BookCover src={g} title={`${book.title} — additional image`} /></div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-md-7 col-lg-8">
          <div className="eyebrow mb-2">{book.subcategory || book.category} · {book.edition}</div>
          <h1 className="h2 mb-1">{book.title}</h1>
          {book.subtitle && <p className="lead mb-2">{book.subtitle}</p>}
          <p className="text-muted">by <span className="text-body">{book.author}</span></p>
          <div className="small text-muted mb-4"><i className="bi bi-star-fill text-warning me-1" />{book.rating.toFixed(1)} · {book.reviews.toLocaleString("en-IN")} ratings</div>

          <div className="d-flex align-items-baseline gap-2 mb-1">
            <span className="price fs-2">{formatINR(book.price)}</span>
            {off > 0 && <><span className="mrp fs-5">{formatINR(book.mrp)}</span><span className="badge badge-off">{off}% off</span></>}
          </div>
          <p className="small text-muted">MRP inclusive of applicable taxes</p>
          {book.drop && (
            <div className="alert alert-success small py-2">
              <i className="bi bi-clock me-1" />{book.drop.label}: {book.drop.discountPct}% off ends in <Countdown endsAt={book.drop.endsAt} />
            </div>
          )}

          <div className="my-4"><BookActions book={book} /></div>

          <div className="row g-3 mb-4 small">
            <div className="col-sm-4"><div className="surface p-3 h-100"><i className="bi bi-truck text-primary me-2" />Free NCR delivery over ₹999</div></div>
            <div className="col-sm-4"><div className="surface p-3 h-100"><i className="bi bi-shop text-primary me-2" />{book.cpPickup ? "Ready at CP in 2 hours" : "Instant e-delivery"}</div></div>
            <div className="col-sm-4"><div className="surface p-3 h-100"><i className="bi bi-shield-check text-primary me-2" />Secure 2-step checkout</div></div>
          </div>

          <h2 className="h5">About this book</h2>
          <p className="text-muted" style={{ maxWidth: 680 }}>{book.description}</p>
          {book.tags.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mb-4">
              {book.tags.map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="badge rounded-pill text-bg-light border text-decoration-none fw-normal">{t}</Link>)}
            </div>
          )}

          <h2 className="h5">Details</h2>
          <table className="table table-sm small" style={{ maxWidth: 560 }}>
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k}><th scope="row" className="fw-normal text-muted bg-transparent" style={{ width: 140 }}>{k}</th><td className={k === "ISBN-13" ? "font-mono bg-transparent" : "bg-transparent"}>{v}</td></tr>
              ))}
            </tbody>
          </table>

          {!book.digital && <div className="mt-4" style={{ maxWidth: 520 }}><DeliveryEstimator compact /></div>}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-5 pt-4 border-top">
          <h2 className="h4 mb-4">More in {cat?.label ?? book.category}</h2>
          <div className="row row-cols-2 row-cols-md-4 g-4">
            {related.map((b) => <div className="col" key={b.id}><BookCard book={b} /></div>)}
          </div>
        </section>
      )}
    </div>
  );
}
