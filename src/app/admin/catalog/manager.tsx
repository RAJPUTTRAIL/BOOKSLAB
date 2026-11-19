"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Modal } from "@/components/ui/overlay";
import { useApi, useApp } from "@/components/providers";
import { BOOK_CATEGORIES, BOOK_FORMATS } from "@/lib/constants";
import { cn, formatINR, pctOff } from "@/lib/utils";

export type AdminBook = {
  id: string; slug: string; title: string; subtitle: string; author: string; publisher: string; isbn: string; category: string;
  subcategory: string; format: string; mrp: number; discountedPrice: number; edition: string; year: number; pages: number; stock: number;
  description: string; coverImage: string; galleryImages: string[]; tags: string[]; isFeatured: boolean; cpPickup: boolean;
};
type Draft = Omit<AdminBook, "id" | "slug"> & { id?: string; slug?: string };

const EMPTY: Draft = {
  title: "", subtitle: "", author: "", publisher: "Bookslab Press", isbn: "", category: "Law", subcategory: "", format: "Paperback",
  mrp: 0, discountedPrice: 0, edition: "1st Edition", year: new Date().getFullYear(), pages: 0, stock: 0, description: "",
  coverImage: "", galleryImages: [], tags: [], isFeatured: false, cpPickup: true,
};

export function CatalogManager({ initial, openNew, prefill }: { initial: AdminBook[]; openNew: boolean; prefill?: { title: string; author: string; isbn: string } }) {
  const api = useApi();
  const router = useRouter();
  const { toast } = useApp();
  const [books, setBooks] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<Draft | null>(openNew ? { ...EMPTY, ...(prefill ?? {}) } : null);
  const [deleting, setDeleting] = useState<AdminBook | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return books.filter((b) =>
      (cat === "All" || b.category === cat) &&
      (stockFilter === "all" || (stockFilter === "low" ? b.stock < 40 && !isDigital(b) : b.stock === 0 && !isDigital(b))) &&
      (!t || `${b.title} ${b.author} ${b.isbn} ${b.subcategory}`.toLowerCase().includes(t)));
  }, [books, q, cat, stockFilter]);

  const payload = (d: Draft) => {
    const { id, slug, ...rest } = d;
    void id; void slug;
    return rest;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setErr("");
    try {
      const body = payload(editing);
      const d = await api<{ book: { id: string; slug: string } }>(editing.id ? `/api/admin/books/${editing.id}` : "/api/admin/books", body, editing.id ? "PUT" : "POST");
      const saved: AdminBook = { ...body, isbn: body.isbn.replace(/[-\s]/g, ""), id: d.book.id, slug: d.book.slug };
      setBooks((prev) => (editing.id ? prev.map((b) => (b.id === editing.id ? saved : b)) : [saved, ...prev]));
      toast({ kind: "success", title: editing.id ? "Changes saved" : "Book added", body: body.title });
      setEditing(null);
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/books/${deleting.id}`, undefined, "DELETE");
      setBooks((prev) => prev.filter((b) => b.id !== deleting.id));
      toast({ kind: "success", title: "Book deleted", body: deleting.title });
      setDeleting(null);
      router.refresh();
    } catch (e) {
      toast({ kind: "danger", title: "Couldn't delete", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div><div className="eyebrow">{books.length} titles</div><h1 className="h3 mb-0">Catalog & inventory</h1></div>
        <button type="button" className="btn btn-primary" onClick={() => { setErr(""); setEditing({ ...EMPTY }); }}><i className="bi bi-plus-lg me-1" />Add book</button>
      </div>

      <div className="card rounded-4">
        <div className="card-body border-bottom">
          <div className="row g-2">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
                <input className="form-control" placeholder="Search title, author, ISBN…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category filter">
                <option>All</option>{BOOK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Stock filter">
                <option value="all">All stock levels</option><option value="low">Low stock (&lt; 40)</option><option value="out">Out of stock</option>
              </select>
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th style={{ width: 64 }}>Cover</th><th>Book</th><th>ISBN</th><th>Category</th><th className="text-end">MRP</th><th className="text-end">Price</th><th className="text-end">Stock</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td><div style={{ width: 44 }}><BookCover src={b.coverImage} title={b.title} /></div></td>
                  <td style={{ minWidth: 220 }}>
                    <Link href={`/books/${b.slug}`} target="_blank" className="fw-semibold text-reset text-decoration-none">{b.title}</Link>
                    <div className="small text-muted">{b.author} · {b.edition}{b.isFeatured && <span className="badge text-bg-light border ms-2">Featured</span>}</div>
                  </td>
                  <td className="font-mono small">{b.isbn}</td>
                  <td className="small">{b.category}<div className="text-muted">{b.format}</div></td>
                  <td className="text-end tabular text-muted">{formatINR(b.mrp)}</td>
                  <td className="text-end tabular">{formatINR(b.discountedPrice)}<div className="small text-success">{pctOff(b.mrp, b.discountedPrice)}% off</div></td>
                  <td className="text-end tabular">{isDigital(b) ? <span className="text-muted small">Digital</span> : <span className={cn(b.stock === 0 ? "badge text-bg-danger" : b.stock < 40 ? "badge text-bg-warning" : "")}>{b.stock}</span>}</td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-light border btn-sm me-1" onClick={() => { setErr(""); setEditing({ ...b }); }} aria-label={`Edit ${b.title}`}><i className="bi bi-pencil" /></button>
                    <button type="button" className="btn btn-light border btn-sm text-danger" onClick={() => setDeleting(b)} aria-label={`Delete ${b.title}`}><i className="bi bi-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-center text-muted py-5 mb-0">No books match these filters.</p>}
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal open={!!editing} onClose={() => !busy && setEditing(null)} size="xl" scrollable title={editing?.id ? "Edit book" : "Add a book"}>
        {editing && (
          <form id="book-form" onSubmit={save}>
            <div className="row g-4">
              <div className="col-lg-4">
                <ImageUploader label="Front cover" value={editing.coverImage ? [editing.coverImage] : []} onChange={(u) => set("coverImage", u[0] ?? "")} />
                <hr />
                <ImageUploader label="Back cover & sample pages (optional)" hint="Up to 4 images · JPG, PNG, WebP or AVIF" value={editing.galleryImages} onChange={(u) => set("galleryImages", u)} multiple max={4} />
              </div>
              <div className="col-lg-8">
                <div className="row g-3">
                  <div className="col-12"><label className="form-label" htmlFor="f-title">Title</label><input id="f-title" className="form-control" value={editing.title} onChange={(e) => set("title", e.target.value)} required /></div>
                  <div className="col-12"><label className="form-label" htmlFor="f-sub">Subtitle <span className="text-muted fw-normal">(optional)</span></label><input id="f-sub" className="form-control" value={editing.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-author">Author</label><input id="f-author" className="form-control" value={editing.author} onChange={(e) => set("author", e.target.value)} required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-pub">Publisher</label><input id="f-pub" className="form-control" value={editing.publisher} onChange={(e) => set("publisher", e.target.value)} required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-isbn">ISBN-13</label><input id="f-isbn" className="form-control font-mono" value={editing.isbn} onChange={(e) => set("isbn", e.target.value)} placeholder="978-93-…" required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-cat">Category</label>
                    <select id="f-cat" className="form-select" value={editing.category} onChange={(e) => set("category", e.target.value)}>{BOOK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-subcat">Sub-category</label><input id="f-subcat" className="form-control" value={editing.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="e.g. Bare Acts, GST, CA Final" /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-format">Format</label>
                    <select id="f-format" className="form-select" value={editing.format} onChange={(e) => set("format", e.target.value)}>{BOOK_FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
                  </div>
                  <div className="col-6 col-md-3"><label className="form-label" htmlFor="f-mrp">MRP (₹)</label><input id="f-mrp" type="number" min={1} className="form-control tabular" value={editing.mrp || ""} onChange={(e) => set("mrp", Number(e.target.value))} required /></div>
                  <div className="col-6 col-md-3"><label className="form-label" htmlFor="f-price">Selling price (₹)</label><input id="f-price" type="number" min={1} className={cn("form-control tabular", editing.discountedPrice > editing.mrp && "is-invalid")} value={editing.discountedPrice || ""} onChange={(e) => set("discountedPrice", Number(e.target.value))} required />
                    {editing.mrp > 0 && editing.discountedPrice > 0 && <div className={cn("form-text", editing.discountedPrice > editing.mrp && "text-danger")}>{editing.discountedPrice > editing.mrp ? "Can't exceed MRP" : `${pctOff(editing.mrp, editing.discountedPrice)}% off`}</div>}
                  </div>
                  <div className="col-6 col-md-3"><label className="form-label" htmlFor="f-stock">Stock</label><input id="f-stock" type="number" min={0} className="form-control tabular" value={editing.stock} onChange={(e) => set("stock", Number(e.target.value))} required /></div>
                  <div className="col-6 col-md-3"><label className="form-label" htmlFor="f-pages">Pages</label><input id="f-pages" type="number" min={0} className="form-control tabular" value={editing.pages} onChange={(e) => set("pages", Number(e.target.value))} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-ed">Edition</label><input id="f-ed" className="form-control" value={editing.edition} onChange={(e) => set("edition", e.target.value)} required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="f-year">Edition year</label><input id="f-year" type="number" className="form-control tabular" value={editing.year} onChange={(e) => set("year", Number(e.target.value))} required /></div>
                  <div className="col-12"><label className="form-label" htmlFor="f-desc">Description</label><textarea id="f-desc" className="form-control" rows={3} value={editing.description} onChange={(e) => set("description", e.target.value)} required /></div>
                  <div className="col-12"><label className="form-label" htmlFor="f-tags">Tags <span className="text-muted fw-normal">(comma separated)</span></label><input id="f-tags" className="form-control" value={editing.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></div>
                  <div className="col-md-6"><div className="form-check form-switch"><input id="f-feat" className="form-check-input" type="checkbox" role="switch" checked={editing.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /><label className="form-check-label" htmlFor="f-feat">Featured on the storefront</label></div></div>
                  <div className="col-md-6"><div className="form-check form-switch"><input id="f-pick" className="form-check-input" type="checkbox" role="switch" checked={editing.cpPickup} onChange={(e) => set("cpPickup", e.target.checked)} /><label className="form-check-label" htmlFor="f-pick">Available for CP Store Pickup</label></div></div>
                </div>
              </div>
            </div>
            {err && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{err}</div>}
            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" className="btn btn-light border" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}{editing.id ? "Save changes" : "Add book"}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        size="sm"
        title="Delete this book?"
        footer={<>
          <button type="button" className="btn btn-light border" onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Delete</button>
        </>}
      >
        {deleting && (
          <div className="d-flex gap-3">
            <div style={{ width: 56, flexShrink: 0 }}><BookCover src={deleting.coverImage} title={deleting.title} /></div>
            <p className="small mb-0"><strong>{deleting.title}</strong> will be removed from the catalog, along with its uploaded images and any active offers. Past orders and invoices keep their details.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function isDigital(b: { format: string }) {
  return b.format === "E-book" || b.format === "Subscription";
}
