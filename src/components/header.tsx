"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BannerContent } from "@/lib/content";
import { CategoryTabs } from "./category-tabs";
import { SearchBox } from "./search-box";
import { useApp } from "./providers";

export function Wordmark() {
  return (
    <Link href="/" className="text-decoration-none wordmark" aria-label="Bookslab, Connaught Place, New Delhi — home">
      Bookslab<small>Connaught Place, New Delhi</small>
    </Link>
  );
}

export function Header({ banner }: { banner: BannerContent }) {
  const { user, signOut, cart, saved, setCartOpen, setSavedOpen, openAuth, toast } = useApp();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [showBanner, setShowBanner] = useState(banner.active);
  const menuRef = useRef<HTMLDivElement>(null);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    setMenu(false);
    await signOut(); // clears cart + saved list in memory and in the browser before the next person signs in
    toast({ kind: "info", title: "You've been signed out" });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {showBanner && (
        <div className="bg-primary text-white small no-print">
          <div className="container d-flex align-items-center justify-content-center gap-2 py-2 position-relative px-5 text-center">
            <span>{banner.text}</span>
            {banner.code && <span className="badge bg-white text-primary font-mono">{banner.code}</span>}
            {banner.cta && <Link href={banner.href} className="link-light link-offset-2">{banner.cta}</Link>}
            <button type="button" className="btn-close btn-close-white btn-sm position-absolute end-0 me-3" aria-label="Dismiss announcement" onClick={() => setShowBanner(false)} />
          </div>
        </div>
      )}
      <header className="site-header sticky-top no-print">
        <div className="container py-2">
          <div className="d-flex align-items-center gap-3">
            <Wordmark />
            <div className="flex-grow-1 d-none d-lg-flex flex-column align-items-center px-xl-4">
              <div className="w-100" style={{ maxWidth: 600 }}>
                <Suspense fallback={<input className="form-control" disabled aria-label="Search" />}><SearchBox /></Suspense>
                <Suspense fallback={<div style={{ height: 34 }} />}><CategoryTabs className="mt-2 tabs-center" /></Suspense>
              </div>
            </div>
            <div className="d-flex align-items-center gap-1 ms-auto">
              <Link href="/request-book" className="btn btn-link text-body text-decoration-none px-2 d-none d-md-inline-flex align-items-center gap-1" title="Can't find a book? Request it">
                <i className="bi bi-journal-plus fs-5" /><span className="small d-none d-xl-inline">Request a Book</span>
              </Link>
              <Link href="/my-orders" className="btn btn-link text-body text-decoration-none px-2 d-none d-md-inline-flex align-items-center gap-1" onClick={(e) => { if (!user) { e.preventDefault(); openAuth("signin", "/my-orders"); } }}>
                <i className="bi bi-box-seam fs-5" /><span className="small d-none d-xl-inline">My Orders</span>
              </Link>
              <button type="button" className="btn btn-link text-body position-relative px-2" onClick={() => setSavedOpen(true)} aria-label={`Saved books (${saved.length})`}>
                <i className="bi bi-bookmark fs-5" />
                {saved.length > 0 && <span className="position-absolute top-0 start-100 translate-middle-x badge rounded-pill bg-secondary" style={{ fontSize: ".6rem" }}>{saved.length}</span>}
              </button>
              <button type="button" className="btn btn-link text-body position-relative px-2" onClick={() => setCartOpen(true)} aria-label={`Cart (${count} items)`}>
                <i className="bi bi-bag fs-5" />
                {count > 0 && <span className="position-absolute top-0 start-100 translate-middle-x badge rounded-pill bg-primary" style={{ fontSize: ".6rem" }}>{count}</span>}
              </button>
              {user ? (
                <div className="position-relative ms-1" ref={menuRef}>
                  <button type="button" className="btn btn-light btn-sm d-flex align-items-center gap-2 rounded-pill ps-1 pe-3" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
                    <span className="rounded-circle bg-primary text-white d-inline-grid fw-semibold" style={{ width: 28, height: 28, placeItems: "center", fontSize: ".8rem" }}>{user.name[0]}</span>
                    <span className="d-none d-sm-inline small">{user.name.split(" ")[0]}</span>
                  </button>
                  {menu && (
                    <div className="dropdown-menu dropdown-menu-end show shadow-sm mt-2" style={{ right: 0, left: "auto", minWidth: 230 }} role="menu">
                      <div className="px-3 py-2 small">
                        <div className="fw-semibold">{user.name}</div>
                        <div className="text-muted text-truncate">{user.identifier}</div>
                      </div>
                      <div className="dropdown-divider" />
                      <Link className="dropdown-item" href="/my-orders" onClick={() => setMenu(false)} role="menuitem"><i className="bi bi-box-seam me-2" />My Orders</Link>
                      <Link className="dropdown-item" href="/profile" onClick={() => setMenu(false)} role="menuitem"><i className="bi bi-person-gear me-2" />My Profile & Addresses</Link>
                      <Link className="dropdown-item" href="/account" onClick={() => setMenu(false)} role="menuitem"><i className="bi bi-person me-2" />Account overview</Link>
                      {user.role === "admin" && <Link className="dropdown-item" href="/admin" onClick={() => setMenu(false)} role="menuitem"><i className="bi bi-speedometer2 me-2" />Admin dashboard</Link>}
                      <button type="button" className="dropdown-item" onClick={logout} role="menuitem"><i className="bi bi-box-arrow-right me-2" />Sign out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-sm ms-1 px-3" onClick={() => openAuth("signup")}>Sign Up / Login</button>
              )}
            </div>
          </div>
          <div className="d-lg-none mt-2">
            <Suspense fallback={null}><SearchBox /></Suspense>
            <Suspense fallback={<div style={{ height: 34 }} />}><CategoryTabs className="mt-2" /></Suspense>
          </div>
        </div>
      </header>
    </>
  );
}
