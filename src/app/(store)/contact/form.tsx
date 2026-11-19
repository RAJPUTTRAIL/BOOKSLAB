"use client";

import { useState } from "react";
import { CONTACT_TOPICS } from "@/lib/constants";
import type { ContactInput, ContactResponse } from "@/lib/contact";

type Init = { name: string; email: string; phone: string; orderNumber: string; topic: string };

export function ContactForm({ initial }: { initial: Init }) {
  const [f, setF] = useState<ContactInput>({
    name: initial.name, email: initial.email, phone: initial.phone, orderNumber: initial.orderNumber, message: "", website: "",
    topic: (CONTACT_TOPICS as readonly string[]).includes(initial.topic) ? (initial.topic as ContactInput["topic"]) : initial.orderNumber ? "Order help" : "Book availability",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = (await res.json().catch(() => ({ error: "Unexpected response from the server." }))) as ContactResponse;
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "Couldn't send your message.");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card rounded-4" data-contact-sent>
        <div className="card-body p-4">
          <h2 className="h5"><i className="bi bi-check-circle-fill text-success me-2" />Message sent</h2>
          <p className="text-muted mb-3">Thank you, {f.name.split(" ")[0]}. Our Connaught Place team will reply to <strong className="text-body">{f.email}</strong>, usually within one working day.</p>
          <button type="button" className="btn btn-light border btn-sm" onClick={() => { setSent(false); setF((x) => ({ ...x, message: "", orderNumber: "" })); }}>Send another message</button>
        </div>
      </div>
    );
  }

  return (
    <form className="card rounded-4" onSubmit={submit} noValidate>
      <div className="card-body p-4">
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="c-name">Name</label>
            <input id="c-name" className="form-control" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="c-email">Email</label>
            <input id="c-email" type="email" className="form-control" value={f.email} onChange={(e) => set("email", e.target.value.trim())} autoComplete="email" maxLength={120} />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="c-phone">Mobile <span className="text-muted fw-normal">(optional)</span></label>
            <div className="input-group"><span className="input-group-text">+91</span><input id="c-phone" className="form-control font-mono" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel-national" /></div>
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="c-topic">Topic</label>
            <select id="c-topic" className="form-select" value={f.topic} onChange={(e) => set("topic", e.target.value as ContactInput["topic"])}>
              {CONTACT_TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {(f.topic === "Order help" || f.topic === "Returns") && (
            <div className="col-sm-6">
              <label className="form-label" htmlFor="c-order">Order number <span className="text-muted fw-normal">(if any)</span></label>
              <input id="c-order" className="form-control font-mono" value={f.orderNumber} onChange={(e) => set("orderNumber", e.target.value.toUpperCase().slice(0, 40))} placeholder="BL-CP-1051-26" />
            </div>
          )}
          <div className="col-12">
            <label className="form-label" htmlFor="c-msg">Message</label>
            <textarea id="c-msg" className="form-control" rows={5} maxLength={2000} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="How can we help?" />
            <div className="form-text text-end">{f.message.length}/2000</div>
          </div>
        </div>
        <div className="visually-hidden" aria-hidden="true"><label htmlFor="c-website">Website</label><input id="c-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></div>
        {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
      </div>
      <div className="card-footer bg-transparent border-0 px-4 pb-4 pt-0">
        <button type="submit" className="btn btn-primary px-4" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Send message</button>
      </div>
    </form>
  );
}
