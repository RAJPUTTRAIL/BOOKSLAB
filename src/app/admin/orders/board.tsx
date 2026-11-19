"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApi, useApp } from "@/components/providers";
import { CancelOrderModal } from "@/components/cancel-order-modal";
import type { OrderDTO } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_BADGE, isClosed, statusesFor } from "@/lib/order-status";
import { cn, formatDateTime, formatINR } from "@/lib/utils";
import { methodLabel, paymentBadge } from "@/lib/payment-display";
import { Modal } from "@/components/ui/overlay";
import { PAYMENT_LABEL, PAYMENT_METHODS, PAYMENT_STATUSES, type PaymentMethod } from "@/lib/constants";

export type AdminOrder = OrderDTO & { customer: string; contact: string };

export function OrdersBoard({ initial, initialStatus }: { initial: AdminOrder[]; initialStatus: string }) {
  const api = useApi();
  const { toast } = useApp();
  const [orders, setOrders] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("All");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null);
  const [editing, setEditing] = useState<AdminOrder | null>(null);

  const summary = useMemo(() => {
    const sum = (f: (o: AdminOrder) => boolean) => orders.filter(f).reduce((s, o) => s + o.totalAmount, 0);
    const pendingOffline = (o: AdminOrder) => o.payment.status === "Pending" && o.status !== "Cancelled" && (o.payment.method === "COD" || o.payment.method === "PAY_AT_STORE");
    return {
      paid: sum((o) => o.payment.status === "Paid"), paidN: orders.filter((o) => o.payment.status === "Paid").length,
      pending: sum(pendingOffline), pendingCod: orders.filter((o) => pendingOffline(o) && o.payment.method === "COD").length, pendingStore: orders.filter((o) => pendingOffline(o) && o.payment.method === "PAY_AT_STORE").length,
      refunded: sum((o) => o.payment.status === "Refunded"), refundedN: orders.filter((o) => o.payment.status === "Refunded").length,
    };
  }, [orders]);

  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length])), [orders]);
  const list = orders.filter(
    (o) =>
      (status === "All" || o.status === status) &&
      (type === "All" || o.deliveryType === type) &&
      (!q || `${o.orderNumber} ${o.customer} ${o.contact} ${o.shippingAddress.pincode} ${o.cancellationReason ?? ""} ${o.payment.transactionId ?? ""} ${o.payment.method}`.toLowerCase().includes(q.toLowerCase())),
  );

  const replace = (o: OrderDTO) => setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...o } : x)));

  const update = async (o: AdminOrder, next: string) => {
    if (next === o.status) return;
    if (next === "Cancelled") return setCancelling(o);
    setBusy(o.id);
    try {
      const d = await api<{ order: OrderDTO }>(`/api/admin/orders/${o.id}`, { status: next }, "PATCH");
      replace(d.order);
      toast({ kind: "success", title: `${o.orderNumber} updated`, body: next });
    } catch (e) {
      toast({ kind: "danger", title: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (o: AdminOrder) => {
    setBusy(o.id);
    try {
      const d = await api<{ order: OrderDTO }>(`/api/admin/orders/${o.id}`, { paymentStatus: "Paid" }, "PATCH");
      replace(d.order);
      toast({ kind: "success", title: `${o.orderNumber} marked as paid`, body: d.order.payment.transactionId ?? undefined });
    } catch (e) {
      toast({ kind: "danger", title: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const confirmCancel = async (reason: string) => {
    if (!cancelling) return;
    const d = await api<{ order: OrderDTO }>(`/api/admin/orders/${cancelling.id}`, { status: "Cancelled", reason: reason || undefined }, "PATCH");
    replace(d.order);
    toast({ kind: "success", title: `${cancelling.orderNumber} cancelled`, body: "Stock has been restored." });
    setCancelling(null);
  };

  return (
    <>
      <div className="mb-4"><div className="eyebrow">{orders.length} orders</div><h1 className="h3 mb-0">Orders &amp; payments</h1></div>
      <div className="row g-3 mb-4" data-summary>
        {[
          ["bi-check2-circle", "Total Collected", summary.paid, `${summary.paidN} paid orders`, "paid"],
          ["bi-hourglass-split", "Pending COD / Store Pickups", summary.pending, `${summary.pendingCod} COD · ${summary.pendingStore} at store`, "pending"],
          ["bi-arrow-counterclockwise", "Refunded", summary.refunded, `${summary.refundedN} refunds`, "refunded"],
        ].map(([icon, label, value, sub, key]) => (
          <div className="col-md-4" key={key as string}>
            <div className="card rounded-4 h-100" data-summary-card={key as string}>
              <div className="card-body">
                <div className="small text-muted"><i className={`bi ${icon} me-1`} />{label}</div>
                <div className="fs-4 fw-semibold tabular" data-amount>{formatINR(value as number)}</div>
                <div className="small text-muted">{sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ul className="nav nav-pills pill-tabs flex-nowrap scroll-x gap-1 mb-3">
        {["All", ...ORDER_STATUSES].map((s) => (
          <li className="nav-item" key={s}>
            <button type="button" className={cn("nav-link", status === s && "active")} onClick={() => setStatus(s)}>
              {s} <span className="text-muted small tabular">{s === "All" ? orders.length : counts[s]}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="card rounded-4">
        <div className="card-body border-bottom">
          <div className="row g-2">
            <div className="col-md-8"><input className="form-control" placeholder="Search order number, customer, pincode or cancellation reason" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></div>
            <div className="col-md-4">
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Delivery type">
                <option>All</option><option>CP Store Pickup</option><option>Home Delivery</option>
              </select>
            </div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th className="text-end">Total</th><th>Payment Method</th><th>Payment Status</th><th>Status</th><th className="text-end">Invoice</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className={o.status === "Cancelled" ? "table-light" : undefined}>
                  <td><div className="font-mono small fw-semibold">{o.orderNumber}</div><div className="small text-muted">{formatDateTime(o.createdAt)}</div></td>
                  <td className="small">{o.customer}<div className="text-muted">{o.shippingAddress.phone || o.contact}</div></td>
                  <td className="small text-muted" style={{ maxWidth: 240 }}><div className="text-truncate">{o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</div></td>
                  <td className="small">{o.deliveryType}<div className="text-muted">{o.deliveryType === "Home Delivery" ? `PIN ${o.shippingAddress.pincode}` : "Inner Circle"} · {o.etaText}</div></td>
                  <td className="text-end tabular">{formatINR(o.totalAmount)}{o.codFee > 0 && <div className="small text-muted">incl. COD fee</div>}</td>
                  <td className="small text-nowrap">{methodLabel(o.payment)}{o.payment.upiId && <div className="text-muted font-mono">{o.payment.upiId}</div>}</td>
                  <td className="small" style={{ minWidth: 150 }} data-payment-cell>
                    <span className={`badge ${paymentBadge(o.payment, o.status).tone}`}>{o.payment.status === "Pending" && o.status === "Cancelled" ? "Not charged" : o.payment.status}</span>
                    {o.payment.transactionId && <div className="font-mono text-muted mt-1" style={{ fontSize: ".75rem" }}>{o.payment.transactionId}</div>}
                    {o.payment.status === "Refunded" && <div className="text-muted" style={{ fontSize: ".75rem" }}>Refund {o.payment.refundId}</div>}
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {o.payment.status === "Pending" && o.status !== "Cancelled" && (o.payment.method === "COD" || o.payment.method === "PAY_AT_STORE") && (
                        <button type="button" className="btn btn-outline-success btn-sm" disabled={busy === o.id} onClick={() => markPaid(o)}>
                          <i className="bi bi-cash-coin me-1" />Mark as Paid
                        </button>
                      )}
                      <button type="button" className="btn btn-light border btn-sm" onClick={() => setEditing(o)} aria-label={`Edit payment for ${o.orderNumber}`}><i className="bi bi-pencil me-1" />Edit</button>
                    </div>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    {isClosed(o.status) ? (
                      <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                    ) : (
                      <select className="form-select form-select-sm" value={o.status} disabled={busy === o.id} onChange={(e) => update(o, e.target.value)} aria-label={`Status of ${o.orderNumber}`}>
                        {statusesFor(o.deliveryType).filter((s) => s !== "Placed" || o.status === "Placed").map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )}
                    {o.status === "Cancelled" && (
                      <div className="small mt-1">
                        <span className="text-body">{o.cancellationReason ?? "No reason given"}</span>
                        <div className="text-muted">By {o.cancelledBy ?? "—"}{o.cancelledAt ? ` · ${formatDateTime(o.cancelledAt)}` : ""}</div>
                      </div>
                    )}
                  </td>
                  <td className="text-end"><Link href={`/invoice/${o.id}`} className="btn btn-light border btn-sm" aria-label={`Invoice for ${o.orderNumber}`}><i className="bi bi-receipt" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-center text-muted py-5 mb-0">No orders in this view.</p>}
        </div>
      </div>
      <EditPaymentModal order={editing} onClose={() => setEditing(null)} onSaved={(o) => { replace(o); setEditing(null); toast({ kind: "success", title: `${o.orderNumber} payment updated`, body: `${PAYMENT_LABEL[o.payment.method]} · ${o.payment.status}` }); }} />
      <CancelOrderModal
        audience="admin"
        order={cancelling && { id: cancelling.id, orderNumber: cancelling.orderNumber, totalAmount: cancelling.totalAmount, itemCount: cancelling.items.reduce((s, i) => s + i.quantity, 0), paidWith: cancelling.payment.status === "Paid" ? methodLabel(cancelling.payment) : null }}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
    </>
  );
}

function EditPaymentModal({ order, onClose, onSaved }: { order: AdminOrder | null; onClose: () => void; onSaved: (o: OrderDTO) => void }) {
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [status, setStatus] = useState("Pending");
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!order) return;
    setMethod(order.payment.method); setStatus(order.payment.status); setTxn(order.payment.transactionId ?? ""); setError(""); setBusy(false);
  }, [order]);
  if (!order) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const allowed = PAYMENT_METHODS.filter((m) => (order.deliveryType === "CP Store Pickup" ? m !== "COD" : m !== "PAY_AT_STORE"));
  const save = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment: { method, status, transactionId: txn.trim() || null } }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't update the payment.");
      onSaved(j.order);
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  };
  return (
    <Modal open onClose={() => !busy && onClose()} title={`Payment · ${order.orderNumber}`}
      footer={<>
        <button type="button" className="btn btn-light border" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save payment</button>
      </>}>
      <div className="d-flex justify-content-between bg-paper border rounded-3 px-3 py-2 mb-3 small">
        <span>{order.customer} · {order.deliveryType}</span><span className="fw-semibold tabular">{formatINR(order.totalAmount)}</span>
      </div>
      <div className="row g-3">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pm-method">Payment method</label>
          <select id="pm-method" className="form-select" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {allowed.map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>)}
          </select>
          {method !== order.payment.method && <div className="form-text">e.g. the customer paid by UPI at the door instead of cash.</div>}
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="pm-status">Payment status</label>
          <select id="pm-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="pm-txn">Transaction ID <span className="text-muted fw-normal">(optional)</span></label>
          <input id="pm-txn" className="form-control font-mono" value={txn} onChange={(e) => setTxn(e.target.value)} maxLength={64} placeholder="e.g. UPI ref 412345678901 or BSL-UPI-…" />
          <div className="form-text">Record the UPI reference / receipt number once money is received.</div>
        </div>
      </div>
      {status === "Refunded" && order.payment.status !== "Refunded" && <div className="alert alert-light border small py-2 mt-3 mb-0">Marking as Refunded records the refund only — make sure the money has been returned to the customer.</div>}
      {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
    </Modal>
  );
}
