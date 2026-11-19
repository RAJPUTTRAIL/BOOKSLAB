"use client";

import { useEffect, useState } from "react";
import { CANCEL_REASONS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { Modal } from "./ui/overlay";

export type CancelTarget = { id: string; orderNumber: string; totalAmount: number; itemCount: number; paidWith?: string | null };

/**
 * Sober confirmation dialog for cancelling an order, with an optional reason.
 * Used by customers on /my-orders and by staff on /admin/orders.
 */
export function CancelOrderModal({
  order, onClose, onConfirm, audience = "customer",
}: {
  order: CancelTarget | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  audience?: "customer" | "admin";
}) {
  const [choice, setChoice] = useState<string>("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order) { setChoice(""); setOther(""); setError(""); setBusy(false); }
  }, [order]);

  const reason = choice === "Other" ? other.trim() || "Other" : choice;

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!order}
      onClose={() => !busy && onClose()}
      title="Cancel this order?"
      footer={
        <>
          <button type="button" className="btn btn-light border" onClick={onClose} disabled={busy}>Keep order</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden />}Cancel order
          </button>
        </>
      }
    >
      {order && (
        <>
          <div className="d-flex justify-content-between align-items-center bg-paper border rounded-3 px-3 py-2 mb-3">
            <span className="font-mono small fw-semibold">{order.orderNumber}</span>
            <span className="small text-muted">{order.itemCount} {order.itemCount === 1 ? "item" : "items"} · {formatINR(order.totalAmount)}</span>
          </div>
          <p className="small text-muted">
            {audience === "customer"
              ? order.paidWith
                ? `The books go back on our shelves straight away, and the ${formatINR(order.totalAmount)} you paid by ${order.paidWith} is refunded to the same account (3–5 business days).`
                : "The books go back on our shelves straight away. Nothing has been charged."
              : order.paidWith
                ? `Stock is restored and the ${formatINR(order.totalAmount)} paid by ${order.paidWith} is refunded automatically. The customer sees the reason on My Orders.`
                : "The books will be returned to stock and the customer will see the reason on their My Orders page."}
          </p>
          <fieldset>
            <legend className="form-label small fw-semibold">Reason <span className="text-muted fw-normal">(optional)</span></legend>
            <div className="d-grid gap-2">
              {CANCEL_REASONS.map((r) => (
                <label key={r} className={`border rounded-3 px-3 py-2 d-flex align-items-center gap-2 ${choice === r ? "border-primary bg-primary-subtle" : "bg-white"}`} style={{ cursor: "pointer" }}>
                  <input type="radio" className="form-check-input m-0" name="cancel-reason" checked={choice === r} onChange={() => setChoice(r)} />
                  <span className="small">{r}</span>
                </label>
              ))}
            </div>
            {choice === "Other" && (
              <textarea className="form-control mt-2" rows={2} maxLength={300} placeholder="Tell us a little more (optional)" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Other reason" autoFocus />
            )}
          </fieldset>
          {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
        </>
      )}
    </Modal>
  );
}
