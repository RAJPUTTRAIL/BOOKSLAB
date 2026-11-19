"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { CancelOrderModal } from "@/components/cancel-order-modal";
import { ReturnRequestModal } from "@/components/return-request-modal";
import { useApi, useApp } from "@/components/providers";
import type { OrderDTO } from "@/lib/orders";
import type { BookRequestDTO } from "@/lib/book-requests";
import { STATUS_BADGE, STATUS_ICON, canCustomerCancel, progressFor } from "@/lib/order-status";
import { REFUND_NOTICE, methodLabel, paymentBadge } from "@/lib/payment-display";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

type Covers = Record<string, { cover: string; slug: string }>;
const FILTERS = ["All", "Active", "Delivered", "Cancelled"] as const;

export function MyOrders({ initial, covers, firstName, requests: initialRequests, initialTab }: { initial: OrderDTO[]; covers: Covers; firstName: string; requests: BookRequestDTO[]; initialTab: "orders" | "requests" }) {
  const api = useApi();
  const { toast } = useApp();
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [cancelling, setCancelling] = useState<OrderDTO | null>(null);
  const [banner, setBanner] = useState<OrderDTO | null>(null);
  const [returning, setReturning] = useState<OrderDTO | null>(null);
  const [returnBanner, setReturnBanner] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "requests">(initialTab);
  const [requests, setRequests] = useState(initialRequests);

  // Pick up admin updates (e.g. a return being approved) when the customer comes back to this tab.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/orders", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.orders && setOrders(d.orders)).catch(() => {});
      fetch("/api/book-requests", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.requests && setRequests(d.requests)).catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  const active = (o: OrderDTO) => o.status !== "Delivered" && o.status !== "Cancelled";
  const list = orders.filter((o) => filter === "All" || (filter === "Active" ? active(o) : o.status === filter));

  const confirmCancel = async (reason: string) => {
    if (!cancelling) return;
    const d = await api<{ order: OrderDTO }>(`/api/orders/${cancelling.id}/cancel`, { reason });
    setOrders((prev) => prev.map((o) => (o.id === d.order.id ? d.order : o)));
    setBanner(d.order);
    setCancelling(null);
    toast({ kind: "success", title: `Order ${d.order.orderNumber} cancelled` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container py-5" style={{ maxWidth: 960 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <div className="eyebrow mb-1">Your orders</div>
          <h1 className="h3 mb-0">My Orders</h1>
          <p className="text-muted mb-0 small">Hello {firstName} — you can cancel an order online until it is ready for pickup or out for delivery.</p>
        </div>
        <ul className="nav nav-pills pill-tabs gap-1">
          {FILTERS.map((f) => (
            <li className="nav-item" key={f}>
              <button type="button" className={cn("nav-link", filter === f && "active")} onClick={() => setFilter(f)}>
                {f} <span className="text-muted small tabular">{f === "All" ? orders.length : orders.filter((o) => (f === "Active" ? active(o) : o.status === f)).length}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={tab === "orders"} className={cn("nav-link", tab === "orders" && "active")} onClick={() => setTab("orders")}><i className="bi bi-box-seam me-1" />Orders <span className="text-muted small">{orders.length}</span></button>
        </li>
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={tab === "requests"} className={cn("nav-link", tab === "requests" && "active")} onClick={() => setTab("requests")} data-tab="requests"><i className="bi bi-journal-plus me-1" />My Book Requests <span className="text-muted small">{requests.length}</span></button>
        </li>
      </ul>
      {tab === "requests" ? <BookRequests requests={requests} /> : (<>
      {banner && (
        <div className="alert alert-light border border-success-subtle d-flex gap-3 align-items-start" role="status">
          <i className="bi bi-check-circle-fill text-success fs-5" />
          <div className="flex-grow-1">
            <div className="fw-semibold">Order {banner.orderNumber} has been cancelled</div>
            <div className="small text-muted">
              The {banner.items.reduce((s, i) => s + i.quantity, 0) === 1 ? "book has" : "books have"} been returned to our shelves.{" "}
              {banner.payment.status === "Refunded" ? `${REFUND_NOTICE.replace(/\.$/, "")} (${formatINR(banner.totalAmount)}).` : "Nothing was charged."}
              {banner.cancellationReason && banner.cancellationReason !== "No reason given" ? ` Reason noted: “${banner.cancellationReason}”.` : ""}
            </div>
          </div>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setBanner(null)} />
        </div>
      )}

      {returnBanner && (
        <div className="alert alert-light border border-success-subtle d-flex gap-3 align-items-start" role="status">
          <i className="bi bi-check-circle-fill text-success fs-5" />
          <div className="flex-grow-1 small">{returnBanner}</div>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setReturnBanner(null)} />
        </div>
      )}
      {orders.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-box-seam fs-1 text-muted" />
          <p className="fw-semibold mt-3 mb-1">No orders yet</p>
          <p className="text-muted">When you place an order, you can follow it here.</p>
          <Link href="/search" className="btn btn-primary">Browse books</Link>
        </div>
      ) : list.length === 0 ? (
        <p className="text-muted text-center py-5">No {filter.toLowerCase()} orders.</p>
      ) : (
        <div className="d-grid gap-4">
          {list.map((o) => <OrderCard key={o.id} order={o} covers={covers} onCancel={() => setCancelling(o)} onReturn={() => setReturning(o)} />)}
        </div>
      )}

      </>)}
      <ReturnRequestModal
        order={returning}
        onClose={() => setReturning(null)}
        onSubmitted={(o) => {
          setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));
          setReturning(null);
          setReturnBanner(`Your ${o.returnRequest?.requestType === "Replacement" ? "replacement" : "return"} request for ${o.orderNumber} has been sent. We usually review requests within one working day.`);
          toast({ kind: "success", title: "Request submitted" });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <CancelOrderModal
        order={cancelling && { id: cancelling.id, orderNumber: cancelling.orderNumber, totalAmount: cancelling.totalAmount, itemCount: cancelling.items.reduce((s, i) => s + i.quantity, 0), paidWith: cancelling.payment.status === "Paid" ? methodLabel(cancelling.payment) : null }}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

const RETURN_BADGE: Record<string, string> = {
  Requested: "text-bg-light border", Approved: "text-bg-primary", "Pickup Scheduled": "text-bg-info", Completed: "text-bg-success", Rejected: "text-bg-secondary",
};

function ReturnStatusCard({ o }: { o: OrderDTO }) {
  const r = o.returnRequest!;
  return (
    <div className="border rounded-3 bg-paper p-3 mb-3" data-return-card>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
        <span className="small fw-semibold"><i className={`bi ${r.requestType === "Replacement" ? "bi-arrow-repeat" : "bi-arrow-return-left"} me-1 text-primary`} />{r.requestType === "Replacement" ? "Replacement request" : "Return & refund request"}</span>
        <span className={`badge ${RETURN_BADGE[r.status] ?? "text-bg-light"}`} data-return-status>{r.status}</span>
      </div>
      <div className="small text-muted">{r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")} · {r.reason} · requested {formatDateTime(r.requestedAt)}</div>
      {r.adminNote && <div className="small mt-2" data-admin-note><i className="bi bi-chat-left-text me-1 text-primary" /><span className="text-muted">From Bookslab:</span> {r.adminNote}</div>}
      {r.status === "Completed" && r.requestType === "Return & Refund" && r.refundAmount > 0 && <div className="small text-success mt-1">{formatINR(r.refundAmount)} refunded to your original payment method.</div>}
    </div>
  );
}

function OrderCard({ order: o, covers, onCancel, onReturn }: { order: OrderDTO; covers: Covers; onCancel: () => void; onReturn: () => void }) {
  const steps = progressFor(o.deliveryType);
  const at = (steps as readonly string[]).indexOf(o.status);
  const cancelled = o.status === "Cancelled";
  return (
    <article className="card rounded-4" aria-labelledby={`o-${o.id}`}>
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <div>
            <div id={`o-${o.id}`} className="font-mono fw-semibold">{o.orderNumber}</div>
            <div className="small text-muted">Placed {formatDateTime(o.createdAt)} · {o.deliveryType}</div>
          </div>
          <div className="text-end">
            <span className={`badge ${STATUS_BADGE[o.status] ?? "text-bg-light"} fs-6 fw-medium`}><i className={`bi ${STATUS_ICON[o.status] ?? "bi-circle"} me-1`} />{o.status}</span>
            <div className="fw-semibold tabular mt-1">{formatINR(o.totalAmount)}</div>
            <span className={`badge ${paymentBadge(o.payment, o.status).tone} fw-normal`} data-payment>{paymentBadge(o.payment, o.status).text}</span>
            {o.payment.transactionId && o.payment.status !== "Pending" && <div className="small text-muted mt-1">Txn <span className="font-mono">{o.payment.transactionId}</span></div>}
          </div>
        </div>

        {!cancelled && at >= 0 && (
          <ol className="order-progress list-unstyled d-flex mb-4" aria-label="Order progress">
            {steps.map((s, i) => (
              <li key={s} className={cn("flex-fill", i <= at && "done", i === at && "current")} aria-current={i === at ? "step" : undefined}>
                <span className="dot" aria-hidden />
                <span className="label small">{s}</span>
              </li>
            ))}
          </ol>
        )}

        {o.payment.status === "Refunded" && (
          <div className="alert alert-light border small py-2 d-flex gap-2 align-items-start mb-3" role="status" data-refund>
            <i className="bi bi-arrow-counterclockwise text-primary" />
            <span>{REFUND_NOTICE} <span className="text-muted">{formatINR(o.totalAmount)} to your {methodLabel(o.payment)}{o.payment.refundId ? ` · Ref ${o.payment.refundId}` : ""}</span></span>
          </div>
        )}
        {o.returnRequest && <ReturnStatusCard o={o} />}
        {cancelled && (
          <div className="bg-paper border rounded-3 px-3 py-2 small mb-3">
            <i className="bi bi-x-circle me-2 text-muted" />
            Cancelled {o.cancelledAt ? formatDateTime(o.cancelledAt) : ""}{o.cancelledBy === "admin" ? " by the Bookslab store" : ""}
            {o.cancellationReason && <> · <span className="text-muted">Reason:</span> {o.cancellationReason}</>}
          </div>
        )}

        <ul className="list-unstyled mb-3">
          {o.items.map((it, i) => {
            const c = it.bookId ? covers[it.bookId] : undefined;
            return (
              <li key={i} className="d-flex align-items-center gap-3 py-2 border-top">
                <div style={{ width: 40 }}><BookCover src={c?.cover ?? ""} title={it.title} /></div>
                <div className="flex-grow-1 min-w-0">
                  {c ? <Link href={`/books/${c.slug}`} className="small text-body text-decoration-none d-block text-truncate">{it.title}</Link> : <span className="small d-block text-truncate">{it.title}</span>}
                  <span className="small text-muted">Qty {it.quantity}{it.kit ? " · kit" : ""} · {it.format}</span>
                </div>
                <span className="small tabular">{formatINR(it.price * it.quantity)}</span>
              </li>
            );
          })}
        </ul>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-top pt-3">
          <div className="small text-muted">
            <i className={`bi ${o.deliveryType === "CP Store Pickup" ? "bi-shop" : "bi-geo-alt"} me-1`} />
            {o.shippingAddress.line}{o.shippingAddress.pincode && o.deliveryType === "Home Delivery" ? ` · ${o.shippingAddress.pincode}` : ""}
            {!cancelled && o.status !== "Delivered" && o.etaText ? <> · <strong className="text-body">{o.etaText}</strong></> : null}
          </div>
          <div className="d-flex gap-2">
            <Link href={`/invoice/${o.id}`} className="btn btn-light border btn-sm"><i className="bi bi-receipt me-1" />Invoice</Link>
            {canCustomerCancel(o.status) && (
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={onCancel}><i className="bi bi-x-lg me-1" />Cancel Order</button>
            )}
            {o.returnWindow && !o.returnRequest && (o.returnWindow.open
              ? <button type="button" className="btn btn-outline-primary btn-sm" onClick={onReturn} title={`Available until ${formatDateTime(o.returnWindow.closesAt)}`}><i className="bi bi-arrow-repeat me-1" />Return / Replace</button>
              : <span className="small text-muted align-self-center" data-window-closed>7-day return window closed</span>)}
          </div>
        </div>
      </div>
    </article>
  );
}

const REQ_BADGE: Record<string, string> = { New: "text-bg-light border", Sourcing: "text-bg-info", "Available at Store": "text-bg-success", "Not Available": "text-bg-secondary", Fulfilled: "text-bg-primary" };
const REQ_HINT: Record<string, string> = {
  New: "Received — our sourcing desk will look into it shortly.",
  Sourcing: "We're checking with publishers and distributors.",
  "Available at Store": "Good news — it's in. Reply on WhatsApp or visit the CP store to reserve your copy.",
  "Not Available": "We couldn't source this title right now.",
  Fulfilled: "Completed — thank you for asking us.",
};

function BookRequests({ requests }: { requests: BookRequestDTO[] }) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-journal-plus fs-1 text-muted" />
        <p className="fw-semibold mt-3 mb-1">No book requests yet</p>
        <p className="text-muted">Can&apos;t find a title in our catalog? Ask our Connaught Place sourcing desk.</p>
        <Link href="/request-book" className="btn btn-primary">Request a Book</Link>
      </div>
    );
  }
  return (
    <div className="d-grid gap-3" data-requests>
      {requests.map((r) => (
        <article key={r.id} className="card rounded-4" data-request={r.bookTitle}>
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <div className="fw-semibold">{r.bookTitle}</div>
                <div className="small text-muted">{[r.authorOrPublisher, r.editionOrYear, r.isbn && `ISBN ${r.isbn}`].filter(Boolean).join(" · ") || "—"}</div>
                <div className="small text-muted">{r.quantity} {r.quantity === 1 ? "copy" : "copies"} · {r.preferredFulfillment} · requested {formatDateTime(r.createdAt)}</div>
              </div>
              <div className="text-end">
                <span className={`badge ${REQ_BADGE[r.status] ?? "text-bg-light"}`} data-request-status>{r.status}</span>
                {r.estimatedPrice != null && r.status !== "Not Available" && <div className="fw-semibold tabular mt-1" data-request-price>{formatINR(r.estimatedPrice)}<span className="small text-muted fw-normal"> /copy</span></div>}
              </div>
            </div>
            <p className="small text-muted mt-2 mb-0">{REQ_HINT[r.status]}</p>
            {r.adminReply && <div className="small mt-2" data-request-reply><i className="bi bi-chat-left-text me-1 text-primary" /><span className="text-muted">From Bookslab:</span> {r.adminReply}</div>}
          </div>
        </article>
      ))}
      <div className="text-center"><Link href="/request-book" className="btn btn-light border btn-sm"><i className="bi bi-plus-lg me-1" />Request another book</Link></div>
    </div>
  );
}
