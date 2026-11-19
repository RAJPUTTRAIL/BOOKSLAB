"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useApi, useApp, type SessionUser } from "../providers";
import { OtpInput } from "./otp-input";

type Tab = "signup" | "signin";
type View = "form" | "forgot" | "reset" | "verify";
type Result = { user: NonNullable<SessionUser> };

const SHOW_DEMO = process.env.NODE_ENV !== "production";

/** Sign-up (with one-time email verification) and direct sign-in. Used by SignupModal and the /auth page. */
export function AuthForm({ initialTab = "signup", onDone, compactHeader }: { initialTab?: Tab; onDone: (r: { role: string }) => void; compactHeader?: boolean }) {
  const api = useApi();
  const { toast, setUser } = useApp();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Email verification (sign-up step 2)
  const [verifyEmail, setVerifyEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [verifyNote, setVerifyNote] = useState("");
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);
  const goVerify = (email: string, wait: number, note = "") => {
    setVerifyEmail(email); setOtp(""); setResendIn(wait); setVerifyNote(note); setError(""); setView("verify");
  };
  const signedIn = (u: Result["user"], fresh: boolean) => {
    setUser(u); // switching identity makes <Providers> drop previous state and load only this user's cart
    toast({ kind: "success", title: fresh ? `Welcome to Bookslab, ${u.name.split(" ")[0]}` : `Welcome back, ${u.name.split(" ")[0]}` });
    onDone({ role: u.role });
  };
  const verifyCode = async (value?: string) => {
    const c = value ?? otp;
    if (!/^\d{6}$/.test(c)) return setError("Enter the 6-digit code from the email.");
    setBusy(true); setError("");
    try {
      const d = await api<Result>("/api/auth/verify-email", { email: verifyEmail, code: c });
      signedIn(d.user, true);
    } catch (err) {
      setError((err as Error).message); setOtp(""); setBusy(false);
    }
  };
  const resendCode = async () => {
    setError("");
    try {
      const d = await api<{ resendIn: number }>("/api/auth/resend-verification", { email: verifyEmail });
      setResendIn(d.resendIn); setOtp(""); setVerifyNote(`A new code is on its way to ${verifyEmail}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

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
    if (tab === "signup") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier.trim())) return setError("Enter a valid email address — we'll send a verification code to it.");
      if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a valid 10-digit mobile number.");
      if (!pwOk) return setError("Use at least 8 characters, including a letter and a number.");
    }
    setBusy(true);
    try {
      if (tab === "signup") {
        const d = await api<{ email: string; resendIn: number }>("/api/auth/signup", { name, email: identifier.trim(), phone, password });
        goVerify(d.email, d.resendIn);
        setBusy(false);
        return;
      }
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 403 && d.code === "EMAIL_NOT_VERIFIED") {
        goVerify(d.email, d.resendIn ?? 0, "Your email isn't verified yet — enter the code we just sent to finish creating your account.");
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(d.error ?? "Something went wrong. Please try again.");
      signedIn(d.user, false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (view === "verify") {
    return (
      <div className="fade-in" data-verify-email>
        <button type="button" className="btn btn-link btn-sm px-0 text-muted mb-2" onClick={() => { setView("form"); setTab("signup"); setError(""); }}><i className="bi bi-arrow-left me-1" />Use a different email</button>
        <div className="text-center mb-3">
          <div className="rounded-circle bg-primary-subtle text-primary d-inline-grid mb-2" style={{ width: 56, height: 56, placeItems: "center" }}><i className="bi bi-envelope-check fs-3" /></div>
          <h3 className="h5 mb-1">Check your email</h3>
          <p className="text-muted small mb-0">We sent a 6-digit code to <strong className="text-body" data-verify-target>{verifyEmail}</strong>. It&apos;s valid for 10 minutes.</p>
        </div>
        {verifyNote && <div className="alert alert-light border small py-2" role="status">{verifyNote}</div>}
        <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(""); }} onComplete={(v) => verifyCode(v)} disabled={busy} invalid={!!error} />
        {error && <div className="text-danger small text-center mt-2" role="alert">{error}</div>}
        <button type="button" className="btn btn-primary w-100 mt-4 py-2" disabled={busy || otp.length !== 6} onClick={() => verifyCode()}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}Verify &amp; Create Account
        </button>
        <div className="text-center small mt-3">
          {resendIn > 0
            ? <span className="text-muted">Didn&apos;t get it? You can resend in <span className="tabular" data-resend-timer>0:{String(resendIn).padStart(2, "0")}</span></span>
            : <button type="button" className="btn btn-link btn-sm p-0" onClick={resendCode}>Resend code</button>}
          <div className="text-muted mt-1">Check Spam / Promotions if it doesn&apos;t arrive in a minute.</div>
        </div>
      </div>
    );
  }

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
          <label className="form-label" htmlFor="auth-id">{tab === "signup" ? "Email" : "Email or Mobile"}</label>
          <input id="auth-id" type={tab === "signup" ? "email" : "text"} className="form-control" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete={tab === "signup" ? "email" : "username"} placeholder={tab === "signup" ? "you@example.com" : "you@example.com or 98100 12345"} required />
          {tab === "signup" && <div className="form-text">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</div>}
        </div>
        {tab === "signup" && (
          <div className="mb-3">
            <label className="form-label" htmlFor="auth-phone">Mobile</label>
            <div className="input-group">
              <span className="input-group-text">+91</span>
              <input id="auth-phone" className="form-control font-mono" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} autoComplete="tel-national" placeholder="98100 12345" required />
            </div>
          </div>
        )}
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
          {busy && <span className="spinner-border spinner-border-sm me-2" />}{tab === "signup" ? "Continue" : "Sign in"}
        </button>
        <p className="small text-muted text-center mt-3 mb-0"><i className="bi bi-lock me-1" />We never share your details.</p>
        {SHOW_DEMO && tab === "signin" && (
          <p className="small text-muted text-center mt-2 mb-0">Demo: <span className="font-mono">admin@bookslab.in / Admin@2026</span></p>
        )}
      </form>
    </div>
  );
}
