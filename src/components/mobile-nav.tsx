"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "./providers";

export function MobileNav() {
  const pathname = usePathname();
  const { cart, setCartOpen, user, openAuth } = useApp();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const item = "flex-fill d-flex flex-column align-items-center py-2 small text-decoration-none border-0 bg-transparent";
  const on = (p: string) => (pathname === p ? "text-primary fw-semibold" : "text-muted");
  return (
    <nav className="mobile-nav fixed-bottom bg-white border-top d-md-none no-print" aria-label="Mobile navigation">
      <div className="d-flex">
        <Link href="/" className={cn(item, on("/"))}><i className="bi bi-house fs-5" />Home</Link>
        <Link href="/search" className={cn(item, on("/search"))}><i className="bi bi-search fs-5" />Browse</Link>
        <button type="button" className={cn(item, "text-muted position-relative")} onClick={() => setCartOpen(true)}>
          <i className="bi bi-bag fs-5" />Cart
          {count > 0 && <span className="position-absolute badge rounded-pill bg-primary" style={{ top: 4, left: "58%", fontSize: ".6rem" }}>{count}</span>}
        </button>
        <Link href="/my-orders" className={cn(item, on("/my-orders"))} onClick={(e) => { if (!user) { e.preventDefault(); openAuth("signin", "/my-orders"); } }}><i className="bi bi-box-seam fs-5" />Orders</Link>
        {user ? (
          <Link href="/account" className={cn(item, on("/account"))}><i className="bi bi-person fs-5" />Account</Link>
        ) : (
          <button type="button" className={cn(item, "text-muted")} onClick={() => openAuth("signin")}><i className="bi bi-person fs-5" />Sign in</button>
        )}
      </div>
    </nav>
  );
}
