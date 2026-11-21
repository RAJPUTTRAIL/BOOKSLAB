"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp, type SessionUser } from "@/components/providers";
import { AddressModal, labelIcon } from "@/components/address-modal";
import { OtpInput } from "@/components/auth/otp-input";
import { Modal } from "@/components/ui/overlay";
import type { Address } from "@/lib/address-schema";
import { cn } from "@/lib/utils";

type Profile = { name: string; email: string; phone: string };
const localPhone = (p: string) => p.replace(/^\+91/, "");

type ChangeState = { step: "NONE" | "VERIFY_OLD" | "VERIFY_NEW"; currentEmail: string | null; pendingNewEmail: string | null; resendIn: number };

export function ProfileSettings({ initial, initialAddresses, initialEmailChange }: { initial: Profile; initialAddresses: Address[]; initialEmailChange: ChangeState }) {
  const [profile, setProfile] = useState(initial); // latest saved details (used to pre-fill new addresses)
  return (
    <div className="container py-5" style={{ maxWidth: 880 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
        <div>
          <div className="eyebrow mb-1">My Profile & Addresses</div>
          <h1 className="h3 mb-0">Edit your details</h1>
          <p className="text-muted small mb-0">Keep your contact details and delivery addresses up to date for a faster checkout.</p>
        </div>
        <Link href="/my-orders" className="btn btn-light border btn-sm"><i className="bi bi-box-seam me-1" />My Orders</Link>
      </div>
      <div className="row g-4">
        <div className="col-lg-7"><DetailsCard initial={initial} onSaved={setProfile} emailChange={initialEmailChange} /></div>
        <div className="col-lg-5"><PasswordCard /></div>
        <div className="col-12"><AddressesCard initial={initialAddresses} owner={profile} /></div>
      </div>
    </div>
  );
}

function DetailsCard({ initial, onSaved, emailChange }: { initial: Profile; onSaved: (p: Profile) => void; emailChange: ChangeState }) {
  const { setUser, openAuth } = useApp();
  const [form, setForm] = useState<Profile>({ name: initial.name, email: initial.email, phone: localPhone(initial.phone) });
  const [changing, setChanging] = useState(emailChange.step !== "NONE"); // resume a change in progress
  const [emailChanged, setEmailChanged] = useState<string | null>(null);
  const [saved, setSaved] = useState<Profile>(form);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setForm((f) => ({ ...f, [k]: v })); setSuccess(false); };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setSuccess(false);
    try {
      const res = await fetch("/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 401) { openAuth("signin", "/profile"); return; }
        setError({ msg: d.error ?? "Couldn't save your details.", field: d.field });
        return;
      }
      const next: Profile = { name: d.profile.name, email: d.profile.email, phone: localPhone(d.profile.phone) };
      setForm(next); setSaved(next); setSuccess(true); onSaved(next);
      setUser(d.user as SessionUser); // header name / identifier update immediately
    } catch {
      setError({ msg: "Couldn't save your details. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const invalid = (f: string) => error?.field === f;

  return (
    <form className="card rounded-4 h-100" onSubmit={submit} noValidate>
      <div className="card-body p-4">
        <h2 className="h5 mb-1">Personal details</h2>
        <p className="small text-muted mb-4">You can sign in with either your email or your mobile number.</p>
        {success && (
          <div className="alert alert-success small py-2 d-flex gap-2 align-items-start" role="status">
            <i className="bi bi-check-circle-fill" /><span>Your details have been saved.</span>
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="p-name">Full Name</label>
          <input id="p-name" className="form-control" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="p-phone">Primary Phone Number</label>
            <div className="input-group">
              <span className="input-group-text">+91</span>
              <input id="p-phone" className={cn("form-control font-mono", invalid("phone") && "is-invalid")} inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98100 12345" autoComplete="tel-national" />
            </div>
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="p-email">Email Address</label>
            <div className="input-group">
              <input id="p-email" type="email" className="form-control bg-light" value={form.email} placeholder="No email yet" readOnly aria-describedby="p-email-help" />
              {!changing && <button type="button" className="btn btn-light border" onClick={() => setChanging(true)} data-change-email>{form.email ? "Change Email" : "Add Email"}</button>}
            </div>
            <div id="p-email-help" className="form-text">{form.email ? "Your sign-in email. Changing it needs a code from your current and new address." : "Add an email to receive order updates."}</div>
          </div>
        </div>

        {changing && (
          <EmailChangeFlow
            initial={emailChange.step === "NONE" ? null : emailChange}
            onCancel={() => setChanging(false)}
            onChanged={(p, u) => {
              const next: Profile = { name: p.name, email: p.email, phone: localPhone(p.phone) };
              setForm((f) => ({ ...f, email: p.email })); setSaved((sv) => ({ ...sv, email: p.email })); onSaved({ ...next, name: saved.name, phone: saved.phone });
              setUser(u as SessionUser); setChanging(false); setEmailChanged(p.email);
            }}
          />
        )}
        {emailChanged && (
          <div className="alert alert-success small py-2 mt-3 d-flex gap-2 align-items-start" role="status" data-email-changed>
            <i className="bi bi-check-circle-fill" /><span>Your email is now <strong>{emailChanged}</strong>. We&apos;ve let your previous address know, and other devices have been signed out.</span>
          </div>
        )}
        {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error.msg}</div>}
      </div>
      <div className="card-footer bg-transparent border-0 px-4 pb-4 pt-0 d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-light border" disabled={!dirty || busy} onClick={() => { setForm(saved); setError(null); }}>Discard changes</button>
        <button type="submit" className="btn btn-primary" disabled={!dirty || busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save details</button>
      </div>
    </form>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const ok = next.length >= 8 && /[A-Za-z]/.test(next) && /\d/.test(next);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(false);
    if (!ok) return setError("Use at least 8 characters, including a letter and a number.");
    if (next !== confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/user/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: cur, newPassword: next, confirmPassword: confirm }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error ?? "Couldn't change your password.");
      setCur(""); setNext(""); setConfirm(""); setSuccess(true);
    } finally {
      setBusy(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <form className="card rounded-4 h-100" onSubmit={submit} noValidate>
      <div className="card-body p-4">
        <h2 className="h5 mb-1">Change Password</h2>
        <p className="small text-muted mb-4">You&apos;ll stay signed in here; other devices will be signed out.</p>
        {success && <div className="alert alert-success small py-2 d-flex gap-2" role="status"><i className="bi bi-check-circle-fill" /><span>Your password has been changed.</span></div>}
        <div className="mb-3">
          <label className="form-label" htmlFor="pw-cur">Current Password</label>
          <input id="pw-cur" type={type} className="form-control" value={cur} onChange={(e) => { setCur(e.target.value); setSuccess(false); }} autoComplete="current-password" required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="pw-new">New Password</label>
          <input id="pw-new" type={type} className="form-control" value={next} onChange={(e) => { setNext(e.target.value); setSuccess(false); }} autoComplete="new-password" required />
          <div className={cn("form-text", next && (ok ? "text-success" : "text-warning-emphasis"))}>{next && ok ? <><i className="bi bi-check2 me-1" />Looks good</> : "At least 8 characters, with a letter and a number."}</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="pw-confirm">Confirm New Password</label>
          <input id="pw-confirm" type={type} className={cn("form-control", confirm && confirm !== next && "is-invalid")} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </div>
        <div className="form-check mb-3">
          <input id="pw-show" type="checkbox" className="form-check-input" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <label className="form-check-label small" htmlFor="pw-show">Show passwords</label>
        </div>
        {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
        <button type="submit" className="btn btn-outline-primary w-100" disabled={busy || !cur || !next || !confirm}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Update password</button>
      </div>
    </form>
  );
}

function AddressesCard({ initial, owner }: { initial: Address[]; owner: Profile }) {
  const { toast } = useApp();
  const [list, setList] = useState(initial);
  const [modal, setModal] = useState<{ open: boolean; editing: Address | null }>({ open: false, editing: null });
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (url: string, init: RequestInit, success: string) => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Something went wrong.");
    setList(d.addresses);
    toast({ kind: "success", title: success });
  };
  const makeDefault = async (a: Address) => {
    setBusy(a.id);
    try { await call(`/api/user/addresses/${a.id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }, `${a.label} is now your default address`); }
    catch (e) { toast({ kind: "danger", title: (e as Error).message }); }
    finally { setBusy(null); }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(deleting.id);
    try { await call(`/api/user/addresses/${deleting.id}`, { method: "DELETE" }, "Address deleted"); setDeleting(null); }
    catch (e) { toast({ kind: "danger", title: (e as Error).message }); }
    finally { setBusy(null); }
  };

  return (
    <div className="card rounded-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">Saved delivery addresses</h2>
            <p className="small text-muted mb-0">Your default address is pre-selected at checkout.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ open: true, editing: null })}><i className="bi bi-plus-lg me-1" />Add New Address</button>
        </div>
        {list.length === 0 ? (
          <div className="text-center border rounded-3 bg-paper py-4">
            <i className="bi bi-geo-alt fs-3 text-muted" />
            <p className="small text-muted mb-0 mt-2">No saved addresses yet. Add your Home, Office or College address for one-tap checkout.</p>
          </div>
        ) : (
          <div className="row row-cols-1 row-cols-md-2 g-3">
            {list.map((a) => (
              <div className="col" key={a.id}>
                <div className={cn("border rounded-3 p-3 h-100 d-flex flex-column", a.isDefault ? "border-primary bg-primary-subtle" : "bg-white")} data-address={a.label}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="fw-semibold"><i className={`bi ${labelIcon(a.label)} me-2 text-primary`} />{a.label === "College" ? "College / Hostel" : a.label}</span>
                    {a.isDefault && <span className="badge text-bg-primary">Default</span>}
                  </div>
                  <div className="small">{a.recipientName} · <span className="font-mono">{a.phone}</span></div>
                  <div className="small text-muted flex-grow-1">{a.street}<br />{a.city}, {a.state} {a.pincode}</div>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button type="button" className="btn btn-light border btn-sm" onClick={() => setModal({ open: true, editing: a })}><i className="bi bi-pencil me-1" />Edit</button>
                    <button type="button" className="btn btn-light border btn-sm" onClick={() => setDeleting(a)}><i className="bi bi-trash me-1" />Delete</button>
                    {!a.isDefault && <button type="button" className="btn btn-outline-primary btn-sm ms-auto" disabled={busy === a.id} onClick={() => makeDefault(a)}>Set as Default</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AddressModal
        open={modal.open}
        editing={modal.editing}
        defaults={{ name: owner.name, phone: owner.phone }}
        forceDefault={list.length === 0}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={(addresses) => { setList(addresses); toast({ kind: "success", title: modal.editing ? "Address updated" : "Address saved" }); setModal({ open: false, editing: null }); }}
      />
      <Modal
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        title="Delete this address?"
        footer={<>
          <button type="button" className="btn btn-light border" onClick={() => setDeleting(null)} disabled={!!busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={!!busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Delete address</button>
        </>}
      >
        {deleting && <p className="small mb-0"><strong>{deleting.label}</strong> — {deleting.street}, {deleting.city} {deleting.pincode}{deleting.isDefault && list.length > 1 ? <><br /><span className="text-muted">Your next saved address will become the default.</span></> : null}</p>}
      </Modal>
    </div>
  );
}

/** Two-step email change: confirm the current address, then verify the new one. */
function EmailChangeFlow({ initial, onCancel, onChanged }: {
  initial: ChangeState | null;
  onCancel: () => void;
  onChanged: (profile: { name: string; email: string; phone: string }, user: unknown) => void;
}) {
  const [st, setSt] = useState<ChangeState | null>(initial);
  const [code, setCode] = useState("");
  const [newEmail, setNewEmail] = useState(initial?.pendingNewEmail ?? "");
  const [resendIn, setResendIn] = useState(initial?.resendIn ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const call = async <T,>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`/api/user/email-change/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
    return j as T;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); setCode(""); } finally { setBusy(false); }
  };

  // Start (or resend) step 1 when the flow opens without a change in progress.
  const start = () => run(async () => {
    const d = await call<ChangeState>("initiate");
    setSt(d); setResendIn(d.resendIn); setCode(""); setNote(d.step === "VERIFY_OLD" ? "" : "");
  });
  useEffect(() => { if (!initial) start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyOld = (c = code) => run(async () => {
    const d = await call<ChangeState>("verify-old", { code: c });
    setSt(d); setCode(""); setResendIn(0); setNote("");
  });
  const sendNew = () => run(async () => {
    const d = await call<ChangeState>("send-new-otp", { newEmail: newEmail.trim() });
    setSt(d); setResendIn(d.resendIn); setCode(""); setNote(`Code sent to ${d.pendingNewEmail}.`);
  });
  const confirmNew = (c = code) => run(async () => {
    const d = await call<{ profile: { name: string; email: string; phone: string }; user: unknown }>("confirm-new", { code: c });
    onChanged(d.profile, d.user);
  });
  const cancel = async () => { await fetch("/api/user/email-change/cancel", { method: "POST" }).catch(() => {}); onCancel(); };

  const resendLink = (onClick: () => void) =>
    resendIn > 0
      ? <span className="text-muted">Resend code in <span className="tabular" data-resend-timer>0:{String(resendIn).padStart(2, "0")}</span></span>
      : <button type="button" className="btn btn-link btn-sm p-0" onClick={onClick} disabled={busy}>Resend code</button>;

  const newSent = st?.step === "VERIFY_NEW" && !!st.pendingNewEmail;

  return (
    <div className="border rounded-3 bg-paper p-3 mt-3 fade-in" data-email-change={st?.step ?? "STARTING"}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong className="small">Change email address</strong>
        <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={cancel} disabled={busy}>Cancel</button>
      </div>

      {!st && <div className="small text-muted"><span className="spinner-border spinner-border-sm me-2" />Sending a security code…</div>}

      {st?.step === "VERIFY_OLD" && (
        <>
          <p className="small mb-3">We sent a 6-digit security code to your current email (<strong data-old-email>{st.currentEmail}</strong>). It&apos;s valid for 10 minutes.</p>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={(v) => verifyOld(v)} disabled={busy} invalid={!!error} />
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 small">
            {resendLink(start)}
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6} onClick={() => verifyOld()}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />}Verify Current Email
            </button>
          </div>
        </>
      )}

      {st?.step === "VERIFY_NEW" && (
        <>
          {st.currentEmail && <span className="badge text-bg-success mb-3" data-old-verified><i className="bi bi-check-circle me-1" />Current email verified</span>}
          <label className="form-label small" htmlFor="p-new-email">New Email Address</label>
          <div className="input-group mb-2">
            <input id="p-new-email" type="email" className="form-control" value={newEmail} onChange={(e) => { setNewEmail(e.target.value.trim()); setError(""); }} placeholder="new@example.com" autoComplete="email" disabled={busy} />
            <button type="button" className="btn btn-outline-primary" onClick={sendNew} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail) || (newSent && resendIn > 0 && newEmail === st.pendingNewEmail)}>
              {newSent && newEmail === st.pendingNewEmail ? "Resend Code" : "Send Verification Code"}
            </button>
          </div>
          {newSent && (
            <>
              <p className="small mb-2">{note || <>Enter the 6-digit code we sent to <strong>{st.pendingNewEmail}</strong>.</>}</p>
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={(v) => confirmNew(v)} disabled={busy} invalid={!!error} />
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 small">
                {resendIn > 0 ? resendLink(sendNew) : <span className="text-muted">Didn&apos;t get it? Check Spam, or resend above.</span>}
                <button type="button" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6} onClick={() => confirmNew()}>
                  {busy && <span className="spinner-border spinner-border-sm me-2" />}Confirm &amp; Update Email
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
    </div>
  );
}
