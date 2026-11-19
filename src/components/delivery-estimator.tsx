"use client";

import { useEffect, useState } from "react";
import { estimateDelivery, pickupEta, type Eta } from "@/lib/delivery";
import { STORE } from "@/lib/store-info";
import { cn } from "@/lib/utils";

const QUICK = [["110001", "CP"], ["110017", "Saket"], ["110007", "North Campus"], ["201301", "Noida"], ["122002", "Gurugram"]] as const;

export function DeliveryEstimator({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [pin, setPin] = useState("");
  const [eta, setEta] = useState<Eta | null>(null);

  useEffect(() => { try { const p = localStorage.getItem("bl_pin"); if (p) setPin(p); } catch {} }, []);
  useEffect(() => {
    const tick = () => setEta(mode === "PICKUP" ? pickupEta() : pin.length === 6 ? estimateDelivery(pin) : null);
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [pin, mode]);
  const update = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setPin(clean);
    try { localStorage.setItem("bl_pin", clean); } catch {}
  };

  return (
    <div className={cn("card rounded-4 h-100", !compact && "p-lg-2")}>
      <div className="card-body">
        <h3 className="h6 mb-3"><i className="bi bi-truck me-2 text-primary" />Delivery & pickup times</h3>
        <div className="btn-group w-100 mb-3" role="group" aria-label="How would you like to receive your order?">
          <button type="button" className={cn("btn btn-outline-primary", mode === "DELIVERY" && "active")} onClick={() => setMode("DELIVERY")}>Home Delivery</button>
          <button type="button" className={cn("btn btn-outline-primary", mode === "PICKUP" && "active")} onClick={() => setMode("PICKUP")}>CP Store Pickup</button>
        </div>
        {mode === "DELIVERY" && (
          <>
            <label htmlFor={`pin-${compact ? "c" : "f"}`} className="form-label small">Pincode</label>
            <input id={`pin-${compact ? "c" : "f"}`} className="form-control font-mono" inputMode="numeric" value={pin} onChange={(e) => update(e.target.value)} placeholder="e.g. 110001" />
            <div className="d-flex flex-wrap gap-1 mt-2">
              {QUICK.map(([p, l]) => (
                <button key={p} type="button" className={cn("btn btn-sm rounded-pill", pin === p ? "btn-primary" : "btn-light border")} onClick={() => update(p)}>{l}</button>
              ))}
            </div>
          </>
        )}
        {eta && (
          <div className={cn("mt-3 p-3 rounded-3", eta.ok ? "bg-paper border" : "alert alert-warning mb-0")} aria-live="polite">
            {eta.ok ? (
              <>
                <div className="small text-muted">{eta.zone}</div>
                <div className="fw-semibold fs-5">{eta.label}</div>
                <div className="small text-muted">{eta.detail}</div>
              </>
            ) : <span className="small">{eta.label}</span>}
          </div>
        )}
        {mode === "PICKUP" && <p className="small text-muted mt-3 mb-0">{STORE.landmark}. Bring your order number and we'll have it ready at the counter.</p>}
      </div>
    </div>
  );
}
