"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { Modal } from "@/components/ui/overlay";
import { BOOK_REQUEST_STATUSES } from "@/lib/constants";
import type { BookRequestDTO } from "@/lib/book-requests";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

const BADGE: Record<string, string> = { New: "text-bg-warning", Sourcing: "text-bg-info", "Available at Store": "text-bg-success", "Not Available": "text-bg-secondary", Fulfilled: "text-bg-primary" };

/** wa.me link with a friendly, pre-filled message about the requested title. */
function whatsapp(r: BookRequestDTO) {
  const first = r.customerName.split(" ")[0];
  const msg = r.status === "Available at Store" && r.estimatedPrice
    ? `Hello ${first}, this is Bookslab, Connaught Place. Good news — "${r.bookTitle}" is available at our store for ${formatINR(r.estimatedPrice)}. Shall we keep ${r.quantity === 1 ? "a copy" : `${r.quantity} copies`} for you?`
    : `Hello ${first}, this is Bookslab, Connaught Place, about your request for "${r.bookTitle}".`;
  return `https://wa.me/${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

export function BookRequestsTable({ initial }: { initial: BookRequestDTO[] }) {
  const { toast } = useApp();
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState("Open");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BookRequestDTO | null>(null);
  const [form, setForm] = useState({ status: "New", estimatedPrice: "", adminReply: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOpen = (r: BookRequestDTO) => ["New", "Sourcing", "Available at Store"].includes(r.status);
  const counts = useMemo(() => Object.fromEntries(BOOK_REQUEST_STATUSES.map((s) => [s, list.filter((r) => r.status === s).length])), [list]);
  const shown = list.filter((r) =>
    (filter === "All" || (filter === "Open" ? isOpen(r) : r.status === filter)) &&
    (!q || `${r.bookTitle} ${r.authorOrPublisher} ${r.isbn} ${r.customerName} ${r.phone}`.toLowerCase().includes(q.toLowerCase())));

  const open = (r: BookRequestDTO) => {
    setEditing(r); setError("");
    setForm({ status: r.status === "New" ? "Sourcing" : r.status, estimatedPrice: r.estimatedPrice ? String(r.estimatedPrice) : "", adminReply: r.adminReply });
  };
  const save = async () => {
    if (!editing) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/book-requests/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: form.status, adminReply: form.adminReply, estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't update the request.");
      setList((p) => p.map((x) => (x.id === j.request.id ? j.request : x)));
      toast({ kind: "success", title: `${j.request.bookTitle}: ${j.request.status}` });
      setEditing(null);
      router.refresh(); // sidebar badge
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const catalogHref = (r: BookRequestDTO) => `/admin/catalog?new=1&title=${encodeURIComponent(r.bookTitle)}&author=${encodeURIComponent(r.authorOrPublisher)}&isbn=${encodeURIComponent(r.isbn)}`;

  return (
    <>
      <div className="mb-4"><div className="eyebrow">{counts.New} new</div><h1 className="h3 mb-0">Book Requests</h1><p className="small text-muted mb-0">Titles customers couldn&apos;t find in the catalog — newest first.</p></div>
      <ul className="nav nav-pills pill-tabs flex-nowrap scroll-x gap-1 mb-3">
        {["Open", ...BOOK_REQUEST_STATUSES, "All"].map((s) => (
          <li className="nav-item" key={s}>
            <button type="button" className={cn("nav-link", filter === s && "active")} onClick={() => setFilter(s)}>
              {s} <span className="text-muted small tabular">{s === "All" ? list.length : s === "Open" ? list.filter(isOpen).length : counts[s]}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="card rounded-4">
        <div className="card-body border-bottom"><input className="form-control" style={{ maxWidth: 420 }} placeholder="Search title, author, ISBN, customer or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requests" /></div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Date</th><th>Customer</th><th>Requested book</th><th>Author / ISBN</th><th className="text-center">Qty</th><th>Fulfilment</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} data-request-row={r.bookTitle}>
                  <td className="small text-muted text-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="small">
                    {r.customerName}{r.linkedAccount && <i className="bi bi-person-check ms-1 text-primary" title="Signed-in customer" />}
                    <div className="font-mono text-muted">{r.phone}</div>
                    <a href={whatsapp(r)} target="_blank" rel="noreferrer" className="small link-success text-decoration-none" data-whatsapp><i className="bi bi-whatsapp me-1" />WhatsApp</a>
                  </td>
                  <td className="small" style={{ maxWidth: 240 }}>
                    <div className="fw-semibold">{r.bookTitle}</div>
                    {r.editionOrYear && <div className="text-muted">{r.editionOrYear}</div>}
                    {r.notes && <div className="text-muted fst-italic">“{r.notes}”</div>}
                  </td>
                  <td className="small text-muted">{r.authorOrPublisher || "—"}{r.isbn && <div className="font-mono">{r.isbn}</div>}</td>
                  <td className="text-center tabular">{r.quantity}</td>
                  <td className="small">{r.preferredFulfillment}</td>
                  <td className="small">
                    <span className={`badge ${BADGE[r.status]}`} data-status>{r.status}</span>
                    {r.estimatedPrice != null && <div className="tabular mt-1">{formatINR(r.estimatedPrice)}</div>}
                    {r.adminReply && <div className="text-muted mt-1" style={{ maxWidth: 200 }}>{r.adminReply}</div>}
                  </td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-light border btn-sm me-1" onClick={() => open(r)} aria-label={`Update request for ${r.bookTitle}`}><i className="bi bi-pencil me-1" />Update</button>
                    <Link href={catalogHref(r)} className="btn btn-light border btn-sm" title="Convert to Store Catalog" aria-label={`Add ${r.bookTitle} to the catalog`} data-convert><i className="bi bi-journal-arrow-up" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="text-center text-muted py-5 mb-0">No requests in this view.</p>}
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => !busy && setEditing(null)}
        title="Update book request"
        footer={<>
          {editing && <Link href={catalogHref(editing)} className="btn btn-light border me-auto"><i className="bi bi-journal-arrow-up me-1" />Convert to Store Catalog</Link>}
          <button type="button" className="btn btn-light border" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}
      >
        {editing && (
          <>
            <div className="bg-paper border rounded-3 px-3 py-2 small mb-3"><strong>{editing.bookTitle}</strong> · {editing.quantity}× · {editing.customerName} ({editing.phone})</div>
            <div className="row g-3">
              <div className="col-sm-7">
                <label className="form-label" htmlFor="brq-status">Status</label>
                <select id="brq-status" className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {BOOK_REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-sm-5">
                <label className="form-label" htmlFor="brq-price">Estimated price {form.status === "Available at Store" && <span className="text-danger">*</span>}</label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input id="brq-price" className="form-control tabular" inputMode="numeric" value={form.estimatedPrice} onChange={(e) => setForm((f) => ({ ...f, estimatedPrice: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="per copy" />
                </div>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="brq-reply">Reply to the customer</label>
                <textarea id="brq-reply" className="form-control" rows={3} maxLength={500} value={form.adminReply} onChange={(e) => setForm((f) => ({ ...f, adminReply: e.target.value }))} placeholder="e.g. In stock at our CP counter — we'll hold a copy for you until Saturday." />
                <div className="form-text">{editing.linkedAccount ? "Shown on the customer's My Book Requests page." : "This customer wasn't signed in — reply on WhatsApp too."}</div>
              </div>
            </div>
            {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
          </>
        )}
      </Modal>
    </>
  );
}
