"use client";

import { useEffect, useState } from "react";
import { ADDRESS_LABELS } from "@/lib/constants";
import { NCR_CITIES, NCR_STATES, type Address } from "@/lib/address-schema";
import { estimateDelivery } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Modal } from "./ui/overlay";

const LABEL_ICON: Record<string, string> = { Home: "bi-house", Office: "bi-briefcase", College: "bi-mortarboard", Other: "bi-geo-alt" };
export const labelIcon = (l: string) => LABEL_ICON[l] ?? "bi-geo-alt";

type Draft = { label: Address["label"]; recipientName: string; phone: string; street: string; city: string; state: string; pincode: string; isDefault: boolean };
const blank = (name = "", phone = ""): Draft => ({ label: "Home", recipientName: name, phone, street: "", city: "New Delhi", state: "Delhi", pincode: "", isDefault: false });

/**
 * Add / edit a delivery address. Saves to the signed-in account via /api/user/addresses and
 * hands back the updated list (and the id of the saved address).
 */
export function AddressModal({
  open, onClose, editing, defaults, onSaved, forceDefault,
}: {
  open: boolean;
  onClose: () => void;
  editing: Address | null;
  defaults?: { name?: string; phone?: string };
  onSaved: (addresses: Address[], savedId: string) => void;
  forceDefault?: boolean; // first address is always the default
}) {
  const [d, setD] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setD(editing ? { ...editing, phone: editing.phone.replace(/^\+91/, "") } : { ...blank(defaults?.name, defaults?.phone?.replace(/^\+91/, "")), isDefault: !!forceDefault });
  }, [open, editing, defaults?.name, defaults?.phone, forceDefault]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const eta = /^\d{6}$/.test(d.pincode) ? estimateDelivery(d.pincode) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/user/addresses/${editing.id}` : "/api/user/addresses", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't save this address.");
      onSaved(j.addresses, editing?.id ?? j.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={editing ? "Edit address" : "Add a new address"}
      footer={
        <>
          <button type="button" className="btn btn-light border" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="address-form" className="btn btn-primary" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden />}{editing ? "Save changes" : "Save address"}
          </button>
        </>
      }
    >
      <form id="address-form" onSubmit={save} noValidate>
        <fieldset className="mb-3">
          <legend className="form-label small fw-semibold">Save as</legend>
          <div className="d-flex flex-wrap gap-2">
            {ADDRESS_LABELS.map((l) => (
              <label key={l} className={cn("btn btn-sm rounded-pill", d.label === l ? "btn-primary" : "btn-light border")}>
                <input type="radio" className="visually-hidden" name="addr-label" checked={d.label === l} onChange={() => set("label", l)} />
                <i className={`bi ${labelIcon(l)} me-1`} />{l === "College" ? "College / Hostel" : l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row g-3">
          <div className="col-sm-7">
            <label className="form-label" htmlFor="a-name">Recipient name</label>
            <input id="a-name" className="form-control" value={d.recipientName} onChange={(e) => set("recipientName", e.target.value)} autoComplete="name" required />
          </div>
          <div className="col-sm-5">
            <label className="form-label" htmlFor="a-phone">Phone</label>
            <div className="input-group">
              <span className="input-group-text">+91</span>
              <input id="a-phone" className="form-control font-mono" inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98100 12345" autoComplete="tel-national" required />
            </div>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="a-street">Street address</label>
            <textarea id="a-street" rows={2} className="form-control" value={d.street} onChange={(e) => set("street", e.target.value)} placeholder="House / flat, street, area, landmark" autoComplete="street-address" required />
          </div>
          <div className="col-sm-5">
            <label className="form-label" htmlFor="a-city">City</label>
            <input id="a-city" className="form-control" list="a-cities" value={d.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" required />
            <datalist id="a-cities">{NCR_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="col-sm-4">
            <label className="form-label" htmlFor="a-state">State</label>
            <input id="a-state" className="form-control" list="a-states" value={d.state} onChange={(e) => set("state", e.target.value)} autoComplete="address-level1" required />
            <datalist id="a-states">{NCR_STATES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="col-sm-3">
            <label className="form-label" htmlFor="a-pin">Pincode</label>
            <input id="a-pin" className="form-control font-mono" inputMode="numeric" value={d.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="110001" autoComplete="postal-code" required />
          </div>
        </div>
        {eta && <div className="small text-muted mt-2"><i className="bi bi-truck me-1" />{eta.ok ? <>Delivery here: <strong className="text-body">{eta.label}</strong></> : eta.label}</div>}
        {!(editing?.isDefault) && (
          <div className="form-check mt-3">
            <input id="a-default" type="checkbox" className="form-check-input" checked={d.isDefault || !!forceDefault} disabled={!!forceDefault} onChange={(e) => set("isDefault", e.target.checked)} />
            <label className="form-check-label small" htmlFor="a-default">{forceDefault ? "This will be your default address" : "Make this my default address"}</label>
          </div>
        )}
        {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
      </form>
    </Modal>
  );
}
