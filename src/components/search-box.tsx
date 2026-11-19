"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BookDTO } from "@/lib/catalog";
import { formatINR } from "@/lib/utils";

/** Centered header search with live suggestions. */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [loadedFor, setLoadedFor] = useState(""); // term whose results have arrived (to show "no matches")
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (pathname === "/search") setQ(params.get("q") ?? ""); }, [pathname, params]);
  // Close the suggestions when clicking anywhere outside the search form.
  useEffect(() => {
    const onClick = (e: MouseEvent) => wrapRef.current && !wrapRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal }).then((r) => r.json()).then((d) => { setResults((d.results ?? []).slice(0, 6)); setActive(-1); setLoadedFor(term); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && results[active]) { setOpen(false); router.push(`/books/${results[active].slug}`); return; }
    const p = new URLSearchParams(pathname === "/search" ? params.toString() : "");
    if (q.trim()) p.set("q", q.trim()); else p.delete("q");
    p.set("log", "1");
    setOpen(false);
    router.push(`/search?${p.toString()}`);
  };

  return (
    <form ref={wrapRef} role="search" className="position-relative w-100" onSubmit={submit}>
      <div className="input-group">
        <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted" /></span>
        <input
          type="search"
          className="form-control border-start-0 ps-0"
          placeholder="Search by title, author or ISBN"
          aria-label="Search books"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="search-suggest"
        />
      </div>
      {open && results.length === 0 && q.trim().length >= 2 && loadedFor === q.trim() && (
        <ul className="search-suggest list-group shadow-sm" data-search-empty>
          <li className="list-group-item small text-muted">No books match “{q.trim()}”.</li>
          <li><Link href={`/request-book?title=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="list-group-item list-group-item-action small text-primary"><i className="bi bi-journal-plus me-2" />Can&apos;t find it? Request this book</Link></li>
        </ul>
      )}
      {open && results.length > 0 && (
        <ul id="search-suggest" className="search-suggest list-group shadow-sm" role="listbox">
          {results.map((b, i) => (
            <li key={b.id} role="option" aria-selected={i === active}>
              <Link href={`/books/${b.slug}`} onClick={() => setOpen(false)} className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${i === active ? "active" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.coverImage} alt="" width={28} height={42} className="rounded-1 object-fit-cover flex-shrink-0" />
                <span className="flex-grow-1 min-w-0">
                  <span className="d-block text-truncate small fw-semibold">{b.title}</span>
                  <span className="d-block text-truncate small opacity-75">{b.author}</span>
                </span>
                <span className="small tabular">{formatINR(b.price)}</span>
              </Link>
            </li>
          ))}
          <li><button type="submit" className="list-group-item list-group-item-action small text-primary">See all results for “{q.trim()}”</button></li>
        </ul>
      )}
    </form>
  );
}
