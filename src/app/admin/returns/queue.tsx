"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { Modal } from "@/components/ui/overlay";
import { RETURN_FLOW, RETURN_STATUSES } from "@/lib/constants";
import type { OrderDTO } from "@/lib/orders";
import { methodLabel } from "@/lib/payment-display";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

export type AdminReturn = OrderDTO & { customer: string; contact: string };

const BADGE: Record<string, string> = { Requested: "text-bg-warning", Approved: "text-bg-primary", "Pickup Scheduled": "text-bg-info", Completed: "text-bg-success", Rejected: "text-bg-secondary" };
const ACTION: Record<string, { label: string; icon: string; tone: string }> = {
  Approved: { label: "Approve", icon: "bi-check2", tone: "btn-outline-primary" },
  "Pickup Scheduled": { label: "Schedule Pickup / CP Store Exchange", icon: "bi-truck", tone: "btn-outline-primary" },
  Completed: { label: "Mark Completed", icon: "bi-check2-all", tone: "btn-outline-success" },
  Rejected: { label: "Reject", icon: "bi-x-lg", tone: "btn-outline-danger" },
};
const SUGGEST: Record<string, (r: AdminReturn) => string> = {
  Approved: (r) => r.returnRequest!.requestType === "Replacement" ? "Approved — we'll send a fresh copy of the same edition." : "Approved — we'll arrange collection and refund once the book reaches us.",
  "Pickup Scheduled": (r) => r.deliveryType === "CP Store Pickup" ? "Please bring the book to our Connaught Place counter for an exchange (10 AM – 8 PM)." : "Our courier will collect the book within 2 working days.",
  Completed: (r) => r.returnRequest!.requestType === "Replacement" ? "Replacement copy dispatched from Connaught Place." : `Refund initiated to original ${r.payment.method === "UPI" ? "UPI" : r.payment.method === "CARD" ? "card" : "payment method"}.`,
  Rejected: () => "",
};

export function ReturnsQueue({ initial }: { initial: AdminReturn[] }) {
  const { toast } = useApp();
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState<string>("Open");
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const [acting, setActing] = useState<{ r: AdminReturn; status: string } | null>(null);
  const [note, setNote] = useState("");
  const [resellable, setResellable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOpen = (r: AdminReturn) => !["Completed", "Rejected"].includes(r.returnRequest!.status);
  const counts = useMemo(() => Object.fromEntries(RETURN_STATUSES.map((s) => [s, list.filter((r) => r.returnRequest!.status === s).length])), [list]);
  const shown = list.filter((r) => (filter === "All" ? true : filter === "Open" ? isOpen(r) : r.returnRequest!.status === filter));

  const open = (r: AdminReturn, status: string) => {
    setActing({ r, status }); setError(""); setResellable(false);
    setNote(status === r.returnRequest!.status ? r.returnRequest!.adminNote : SUGGEST[status]?.(r) ?? "");
  };
  const save = async () => {
    if (!acting) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/returns/${acting.r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: acting.status, adminNote: note, resellable }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't update the request.");
      setList((p) => p.map((x) => (x.id === j.order.id ? { ...x, ...j.order } : x)));
      toast({ kind: "success", title: `${acting.r.orderNumber}: ${j.order.returnRequest.status}`, body: note || undefined });
      setActing(null);
      router.refresh(); // updates the sidebar badge
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4"><div className="eyebrow">{counts.Requested} awaiting review</div><h1 className="h3 mb-0">Returns &amp; Replacements</h1></div>
      <ul className="nav nav-pills pill-tabs flex-nowrap scroll-x gap-1 mb-3">
        {["Open", ...RETURN_STATUSES, "All"].map((s) => (
          <li className="nav-item" key={s}>
            <button type="button" className={cn("nav-link", filter === s && "active")} onClick={() => setFilter(s)}>
              {s} <span className="text-muted small tabular">{s === "All" ? list.length : s === "Open" ? list.filter(isOpen).length : counts[s]}</span>
            </button>
          </li>
        ))}
      </ul>

      {shown.length === 0 ? (
        <div className="card rounded-4"><div className="card-body text-center text-muted py-5"><i className="bi bi-inbox fs-2 d-block mb-2" />No requests in this view.</div></div>
      ) : (
        <div className="d-grid gap-3">
          {shown.map((o) => {
            const r = o.returnRequest!;
            const next = RETURN_FLOW[r.status] ?? [];
            return (
              <div key={o.id} className="card rounded-4" data-return-row={o.orderNumber}>
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <div>
                      <span className="font-mono fw-semibold">{o.orderNumber}</span>
                      <span className="badge text-bg-light border ms-2">{r.requestType}</span>
                      <div className="small text-muted">{o.customer} · <span className="font-mono">{o.contact}</span> · requested {formatDateTime(r.requestedAt)}</div>
                    </div>
                    <span className={`badge ${BADGE[r.status]} align-self-start`} data-status>{r.status}</span>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-7">
                      <div className="small"><span className="text-muted">Books:</span> {r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</div>
                      <div className="small"><span className="text-muted">Reason:</span> {r.reason}</div>
                      {r.description && <div className="small text-muted fst-italic mt-1">“{r.description}”</div>}
                      <div className="small text-muted mt-1">{o.deliveryType} · paid {formatINR(o.totalAmount)} by {methodLabel(o.payment)} ({o.payment.status}) · delivered {o.deliveredAt ? formatDateTime(o.deliveredAt) : "—"}</div>
                      {r.adminNote && <div className="small mt-2"><i className="bi bi-chat-left-text me-1 text-primary" />{r.adminNote}</div>}
                      {r.status === "Completed" && r.requestType === "Return & Refund" && <div className="small text-success mt-1">Refunded {formatINR(r.refundAmount)}{r.resellable ? " · returned to stock" : " · not restocked"}</div>}
                    </div>
                    <div className="col-md-5">
                      <div className="d-flex gap-2 flex-wrap">
                        {r.proofImages.map((src, i) => (
                          <button key={src} type="button" className="p-0 border rounded-3 overflow-hidden bg-white" style={{ width: 72, height: 72 }} onClick={() => setLightbox({ src, title: `${o.orderNumber} · photo ${i + 1} of ${r.proofImages.length}` })} aria-label={`View proof photo ${i + 1}`} data-proof>
                            <img src={src} alt="" className="w-100 h-100" style={{ objectFit: "cover" }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 border-top pt-3 mt-3">
                    {next.map((s) => (
                      <button key={s} type="button" className={`btn btn-sm ${ACTION[s].tone}`} onClick={() => open(o, s)}><i className={`bi ${ACTION[s].icon} me-1`} />{ACTION[s].label}</button>
                    ))}
                    {next.length > 0 && <button type="button" className="btn btn-sm btn-light border ms-auto" onClick={() => open(o, r.status)}><i className="bi bi-pencil me-1" />Edit note</button>}
                    <Link href={`/invoice/${o.id}`} className={cn("btn btn-sm btn-light border", next.length === 0 && "ms-auto")}><i className="bi bi-receipt me-1" />Invoice</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title={lightbox?.title} size="lg">
        {lightbox && <img src={lightbox.src} alt={lightbox.title} className="w-100 rounded-3" style={{ maxHeight: "70vh", objectFit: "contain", background: "#f3f2ee" }} data-lightbox-img />}
      </Modal>

      <Modal
        open={!!acting}
        onClose={() => !busy && setActing(null)}
        title={acting ? (acting.status === acting.r.returnRequest!.status ? "Update note" : ACTION[acting.status]?.label) : ""}
        footer={<>
          <button type="button" className="btn btn-light border" onClick={() => setActing(null)} disabled={busy}>Cancel</button>
          <button type="button" className={`btn ${acting?.status === "Rejected" ? "btn-danger" : "btn-primary"}`} onClick={save} disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>}
      >
        {acting && (
          <>
            <div className="bg-paper border rounded-3 px-3 py-2 small mb-3">{acting.r.orderNumber} · {acting.r.returnRequest!.requestType} · {acting.r.returnRequest!.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</div>
            <label className="form-label small fw-semibold" htmlFor="rr-note">Note for the customer {acting.status === "Rejected" && <span className="text-danger">*</span>}</label>
            <textarea id="rr-note" className="form-control" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={acting.status === "Rejected" ? "Explain why the request can't be accepted" : "Pickup / exchange / refund instructions"} />
            <div className="form-text">Shown on the customer&apos;s My Orders page.</div>
            {acting.status === "Completed" && acting.r.returnRequest!.requestType === "Replacement" && (
              <div className="alert alert-light border small py-2 mt-3 mb-0"><i className="bi bi-box-seam me-1" />Completing deducts {acting.r.returnRequest!.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")} from stock for the replacement copies.</div>
            )}
            {acting.status === "Completed" && acting.r.returnRequest!.requestType === "Return & Refund" && (
              <>
                <div className="alert alert-light border small py-2 mt-3">
                  <i className="bi bi-arrow-counterclockwise me-1" />Refund of {formatINR(acting.r.returnRequest!.items.reduce((s, i) => s + i.price * i.quantity, 0))}
                  {acting.r.payment.status === "Paid" ? ` to ${methodLabel(acting.r.payment)} — the order will be marked Refunded.` : " — nothing was paid online for this order, so no refund is issued."}
                </div>
                <div className="form-check">
                  <input id="rr-resell" type="checkbox" className="form-check-input" checked={resellable} onChange={(e) => setResellable(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="rr-resell">Returned copies are in sellable condition — add them back to stock</label>
                </div>
              </>
            )}
            {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
          </>
        )}
      </Modal>
    </>
  );
}
