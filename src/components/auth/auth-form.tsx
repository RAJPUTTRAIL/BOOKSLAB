"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useApi, useApp, type SessionUser } from "../providers";

type Tab = "signup" | "signin";
type View = "form" | "forgot" | "reset";
type Result = { user: NonNullable<SessionUser> };

const SHOW_DEMO = process.env.NODE_ENV !== "production";

/** Single-step sign-up / sign-in. Used by SignupModal and the /auth page. */
export function AuthForm({ initialTab = "signup", onDone, compactHeader }: { initialTab?: Tab; onDone: (r: { role: string }) => void; compactHeader?: boolean }) {
  const api = useApi();
  const { toast, setUser } = useApp();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Forgot-password flow
  const [view, setView] = useState<View>("form");
  const [notice, setNotice] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => setTab(initialTab), [initialTab]);

  const openForgot = () => {
    setError(""); setNotice(""); setResetId(identifier); setView("forgot");
  };
  const backToSignIn = (msg = "") => {
    setView("form"); setTab("signin"); setError(""); setNotice(msg); setCode(""); setNewPw(""); setConfirmPw("");
  };

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const d = await api<{ message: string }>("/api/auth/forgot-password", { identifier: resetId });
      setResetInfo(d.message);
      setCode("");
      setView("reset");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newPwOk = newPw.length >= 8 && /[A-Za-z]/.test(newPw) && /\d/.test(newPw);
  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPwOk) return setError("Use at least 8 characters, including a letter and a number.");
    if (newPw !== confirmPw) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await api("/api/auth/reset-password", { identifier: resetId, code, password: newPw, confirmPassword: confirmPw });
      setIdentifier(resetId);
      setPassword("");
      backToSignIn("Your password has been updated. Sign in with your new password.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pwOk = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (tab === "signup" && !pwOk) return setError("Use at least 8 characters, including a letter and a number.");
    setBusy(true);
    try {
      const d = await api<Result>(
        tab === "signup" ? "/api/auth/signup" : "/api/auth/login",
        tab === "signup" ? { name, identifier, password } : { identifier, password },
      );
      // Switching identity here makes <Providers> drop any previous state and load only this user's cart.
      setUser(d.user);
      toast({ kind: "success", title: tab === "signup" ? `Welcome to Bookslab, ${d.user.name.split(" ")[0]}` : `Welcome back, ${d.user.name.split(" ")[0]}` });
      onDone({ role: d.user.role });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (view === "forgot") {
    return (
      <div className="fade-in">
        <button type="button" className="btn btn-link btn-sm px-0 text-muted mb-2" onClick={() => backToSignIn()}><i className="bi bi-arrow-left me-1" />Back to sign in</button>
        <h3 className="h5 mb-1">Reset your password</h3>
        <p className="text-muted small mb-4">Enter the email or mobile number you registered with. We&apos;ll send you a 6-character code that&apos;s valid for 15 minutes.</p>
        <form onSubmit={requestCode} noValidate>
          <label className="form-label" htmlFor="reset-id">Email or Mobile</label>
          <input id="reset-id" className="form-control mb-3" value={resetId} onChange={(e) => setResetId(e.target.value)} autoComplete="username" placeholder="you@example.com or 98100 12345" autoFocus required />
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary w-100 py-2" disabled={busy || resetId.trim().length < 3}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}Send reset code
          </button>
        </form>
      </div>
    );
  }

  if (view === "reset") {
    return (
      <div className="fade-in">
        <button type="button" className="btn btn-link btn-sm px-0 text-muted mb-2" onClick={() => { setView("forgot"); setError(""); }}><i className="bi bi-arrow-left me-1" />Use a different email or mobile</button>
        <h3 className="h5 mb-1">Set a new password</h3>
        <p className="text-muted small mb-3">{resetInfo}</p>
        <form onSubmit={resetPassword} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="reset-code">Reset code</label>
            <input id="reset-code" className="form-control font-mono text-uppercase" style={{ letterSpacing: ".3em" }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} autoComplete="one-time-code" inputMode="text" placeholder="ABC123" autoFocus required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="reset-pw">New Password</label>
            <input id="reset-pw" type={showPw ? "text" : "password"} className="form-control" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
            <div className={cn("form-text", newPw && (newPwOk ? "text-success" : "text-warning-emphasis"))}>{newPw && newPwOk ? <><i className="bi bi-check2 me-1" />Looks good</> : "At least 8 characters, with a letter and a number."}</div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="reset-pw2">Confirm New Password</label>
            <div className="input-group">
              <input id="reset-pw2" type={showPw ? "text" : "password"} className={cn("form-control", confirmPw && confirmPw !== newPw && "is-invalid")} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
              <button type="button" className="btn btn-light border" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide passwords" : "Show passwords"}><i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} /></button>
            </div>
          </div>
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary w-100 py-2" disabled={busy || code.length !== 6}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}Update password
          </button>
          <div className="text-center mt-3"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => requestCode()} disabled={busy}>Send a new code</button></div>
        </form>
      </div>
    );
  }

  return (
    <div>
      {notice && <div className="alert alert-success small py-2 d-flex gap-2" role="status"><i className="bi bi-check-circle-fill" /><span>{notice}</span></div>}
      {!compactHeader && (
        <p className="text-muted small mb-3">{tab === "signup" ? "Create an account to track orders, save books and check out faster." : "Welcome back. Sign in with your email or mobile number."}</p>
      )}
      <ul className="nav nav-pills nav-fill pill-tabs bg-paper border rounded-pill p-1 mb-4" role="tablist">
        {(["signup", "signin"] as const).map((t) => (
          <li className="nav-item" key={t} role="presentation">
            <button type="button" role="tab" aria-selected={tab === t} className={cn("nav-link w-100", tab === t && "active")} onClick={() => { setTab(t); setError(""); setNotice(""); }}>
              {t === "signup" ? "Create Account" : "Sign In"}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} noValidate>
        {tab === "signup" && (
          <div className="mb-3">
            <label className="form-label" htmlFor="auth-name">Full Name</label>
            <input id="auth-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Riya Sharma" required />
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="auth-id">Email or Mobile</label>
          <input id="auth-id" className="form-control" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="you@example.com or 98100 12345" required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="auth-pw">Password</label>
          <div className="input-group">
            <input id="auth-pw" type={showPw ? "text" : "password"} className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "signup" ? "new-password" : "current-password"} required />
            <button type="button" className="btn btn-light border" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
              <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} />
            </button>
          </div>
          {tab === "signup" && (
            <div className={cn("form-text", password && (pwOk ? "text-success" : "text-warning-emphasis"))}>
              {password && pwOk ? <><i className="bi bi-check2 me-1" />Looks good</> : "At least 8 characters, with a letter and a number."}
            </div>
          )}
          {tab === "signin" && (
            <div className="text-end mt-1"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none small" onClick={openForgot}>Forgot Password?</button></div>
          )}
        </div>
        {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary w-100 py-2" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}{tab === "signup" ? "Create account" : "Sign in"}
        </button>
        <p className="small text-muted text-center mt-3 mb-0"><i className="bi bi-lock me-1" />We never share your details.</p>
        {SHOW_DEMO && tab === "signin" && (
          <p className="small text-muted text-center mt-2 mb-0">Demo: <span className="font-mono">admin@bookslab.in / Admin@2026</span></p>
        )}
      </form>
    </div>
  );
}
