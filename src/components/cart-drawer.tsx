"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { computeTotals, FREE_DELIVERY_THRESHOLD, kitTier } from "@/lib/pricing";
import { formatINR } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { Offcanvas } from "./ui/overlay";
import { useApp } from "./providers";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, removeFromCart, user, openAuth } = useApp();
  const router = useRouter();
  const t = computeTotals(cart.map((i) => ({ price: i.price, quantity: i.qty, kit: i.kit, digital: i.digital })), { fulfillment: "DELIVERY" });
  const physical = cart.some((i) => !i.digital);
  const afterBundle = t.subtotal - t.bundleDiscount;
  const progress = Math.min(100, Math.round((afterBundle / FREE_DELIVERY_THRESHOLD) * 100));
  const kit = kitTier(t.kitCount);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const checkout = () => {
    setCartOpen(false);
    if (user) router.push("/checkout");
    else openAuth("signin", "/checkout");
  };

  return (
    <Offcanvas
      open={cartOpen}
      onClose={() => setCartOpen(false)}
      title={<>Your cart <span className="text-muted fw-normal fs-6">({count})</span></>}
      footer={
        cart.length > 0 && (
          <>
            <dl className="row small mb-2 g-0">
              <dt className="col-7 fw-normal text-muted">Subtotal</dt><dd className="col-5 text-end mb-1 tabular">{formatINR(t.subtotal)}</dd>
              {t.bundleDiscount > 0 && (<><dt className="col-7 fw-normal text-muted">Kit savings ({t.kitPct}%)</dt><dd className="col-5 text-end mb-1 text-success tabular">−{formatINR(t.bundleDiscount)}</dd></>)}
              <dt className="col-7 fw-normal text-muted">Delivery</dt><dd className="col-5 text-end mb-1 tabular">{t.deliveryFee ? formatINR(t.deliveryFee) : "Free"}</dd>
              <dt className="col-7 fs-6">Total</dt><dd className="col-5 text-end mb-0 fs-6 fw-semibold tabular">{formatINR(t.total)}</dd>
            </dl>
            <p className="small text-muted mb-3">Free pickup from our Connaught Place store is available at checkout.</p>
            <button type="button" className="btn btn-primary w-100 py-2" onClick={checkout}>
              {user ? "Proceed to checkout" : "Sign in to check out"}
            </button>
          </>
        )
      }
    >
      {physical && (
        <div className="px-3 py-3 border-bottom bg-paper">
          <div className="small mb-2">
            {afterBundle >= FREE_DELIVERY_THRESHOLD ? (
              <span className="text-success"><i className="bi bi-check2-circle me-1" />Free Delhi NCR delivery unlocked</span>
            ) : (
              <>Add <strong className="tabular">{formatINR(FREE_DELIVERY_THRESHOLD - afterBundle)}</strong> more for free delivery</>
            )}
          </div>
          <div className="progress" role="progressbar" aria-label="Progress to free delivery" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ height: 6 }}>
            <div className="progress-bar bg-primary" style={{ width: `${progress}%`, transition: "width .4s ease" }} />
          </div>
        </div>
      )}
      {t.kitCount > 0 && (
        <div className="alert alert-light border small mx-3 mt-3 mb-0">
          <i className="bi bi-collection me-1" /> Kit of {t.kitCount}: {kit.tier ? `${kit.pct}% off kit items` : "no discount yet"}
          {kit.next && ` · add ${kit.next.min - t.kitCount} more for ${kit.next.pct}%`}
        </div>
      )}
      {cart.length === 0 ? (
        <div className="text-center px-4 py-5">
          <i className="bi bi-bag fs-1 text-muted" />
          <p className="fw-semibold mt-3 mb-1">Your cart is empty</p>
          <p className="text-muted small">Browse the shelves and add what you need.</p>
          <Link href="/search" className="btn btn-outline-primary mt-2" onClick={() => setCartOpen(false)}>Browse books</Link>
        </div>
      ) : (
        <ul className="list-unstyled mb-0 px-3">
          {cart.map((i) => (
            <li key={i.key} className="d-flex gap-3 py-3 border-bottom">
              <Link href={`/books/${i.slug}`} onClick={() => setCartOpen(false)} style={{ width: 56, flexShrink: 0 }}>
                <BookCover src={i.coverImage} title={i.title} />
              </Link>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold small lh-sm">{i.title}</div>
                <div className="text-muted small">{i.author}</div>
                {i.kit && <span className="badge text-bg-light border mt-1">Kit item</span>}
                <div className="d-flex align-items-center justify-content-between mt-2">
                  <div className="input-group input-group-sm" style={{ width: 108 }}>
                    <button className="btn btn-light" type="button" onClick={() => setQty(i.key, i.qty - 1)} aria-label="Decrease quantity"><i className="bi bi-dash" /></button>
                    <span className="form-control text-center tabular">{i.qty}</span>
                    <button className="btn btn-light" type="button" onClick={() => setQty(i.key, i.qty + 1)} aria-label="Increase quantity"><i className="bi bi-plus" /></button>
                  </div>
                  <span className="price small">{formatINR(i.price * i.qty)}</span>
                </div>
              </div>
              <button type="button" className="btn btn-link btn-sm text-muted p-0 align-self-start" onClick={() => removeFromCart(i.key)} aria-label={`Remove ${i.title}`}>
                <i className="bi bi-x-lg" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Offcanvas>
  );
}
