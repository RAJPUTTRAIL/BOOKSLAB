import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { connectDB } from "@/lib/mongo";
import { SearchEvent } from "@/lib/models";
import { searchBooks } from "@/lib/catalog";
import { CATEGORIES, filterLabel, isFilterKey } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const metadata = { title: "Browse books" };

const SORTS = [
  { key: "relevance", label: "Recommended" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "discount", label: "Biggest discount" },
  { key: "newest", label: "Newest edition" },
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const c = isFilterKey(sp.c) ? sp.c : "all";
  const sort = SORTS.some((s) => s.key === sp.sort) ? sp.sort! : "relevance";
  let results = await searchBooks(q, c);
  if (sp.log === "1") await connectDB().then(() => SearchEvent.create({ category: c, query: q.toLowerCase() })).catch(() => {});
  results = [...results].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "discount") return (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp;
    if (sort === "newest") return b.year - a.year;
    return 0;
  });
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c !== "all") p.set("c", c);
    if (sort !== "relevance") p.set("sort", sort);
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
    return `/search?${p.toString()}`;
  };

  return (
    <div className="container py-5">
      <div className="mb-4">
        <h1 className="h3 mb-1">{q ? <>Results for “{q}”</> : filterLabel(c)}</h1>
        <p className="text-muted mb-0">{results.length} {results.length === 1 ? "title" : "titles"}{c !== "all" && q ? ` in ${filterLabel(c)}` : ""}</p>
      </div>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-4">
        <div className="d-flex flex-wrap gap-1 me-auto">
          <Link href={qs({ c: "" })} className={cn("btn btn-sm rounded-pill", c === "all" ? "btn-primary" : "btn-light border")}>All</Link>
          {CATEGORIES.map((cat) => (
            <Link key={cat.key} href={qs({ c: cat.key })} className={cn("btn btn-sm rounded-pill", c === cat.key ? "btn-primary" : "btn-light border")}>{cat.label}</Link>
          ))}
          <Link href={qs({ c: "pickup" })} className={cn("btn btn-sm rounded-pill", c === "pickup" ? "btn-primary" : "btn-light border")}><i className="bi bi-shop me-1" />CP Store Pickup</Link>
        </div>
        <div className="dropdown-center">
          <div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Sort">
            {SORTS.map((s) => (
              <Link key={s.key} href={qs({ sort: s.key === "relevance" ? "" : s.key })} scroll={false} className={cn("btn btn-outline-primary", sort === s.key && "active")}>{s.label}</Link>
            ))}
          </div>
        </div>
      </div>
      {q && <p className="small"><Link href={qs({ q: "" })} className="link-secondary">Clear search “{q}”</Link></p>}
      {results.length === 0 ? (
        <div className="card rounded-4 mx-auto text-center" style={{ maxWidth: 560 }} data-no-results>
          <div className="card-body p-4 p-md-5">
            <i className="bi bi-search fs-1 text-muted" />
            <p className="fw-semibold mt-3 mb-1">{q ? <>No titles match “{q}”</> : "No titles in this section yet"}</p>
            <p className="text-muted small">Try an author, an ISBN, or a broader word like “GST” or “Bare Act”.</p>
            <div className="border-top pt-3 mt-3">
              <p className="mb-2">Can&apos;t find what you&apos;re looking for?</p>
              <Link href={`/request-book${q ? `?title=${encodeURIComponent(q)}` : ""}`} className="btn btn-primary"><i className="bi bi-journal-plus me-1" />Request this book</Link>
              <p className="small text-muted mt-2 mb-0">Our Connaught Place sourcing desk will find it for you.</p>
            </div>
            <Link href="/search" className="btn btn-link btn-sm mt-2">Browse all books</Link>
          </div>
        </div>
      ) : (
        <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-4">
          {results.map((b) => <div className="col" key={b.id}><BookCard book={b} /></div>)}
        </div>
      )}
    </div>
  );
}
