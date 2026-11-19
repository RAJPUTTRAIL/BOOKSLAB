"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BookDTO } from "@/lib/catalog";
import type { SessionUser } from "@/lib/session-user";
import { GUEST_CART_KEY, GUEST_SAVED_KEY, LEGACY_KEYS, MAX_LINE_QTY, cartKey, type CartItem } from "@/lib/cart-types";

export type { SessionUser };

export type { CartItem };

type Toast = { id: number; kind: "success" | "danger" | "info"; title: string; body?: string };
type AuthTab = "signup" | "signin";

type Ctx = {
  user: SessionUser;
  setUser: (u: SessionUser | ((prev: SessionUser) => SessionUser)) => void;
  toast: (t: Omit<Toast, "id">) => void;
  cart: CartItem[];
  addToCart: (b: BookDTO, opts?: { kit?: boolean; qty?: number; silent?: boolean }) => void;
  setQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  saved: BookDTO[];
  toggleSaved: (b: BookDTO) => void;
  isSaved: (id: string) => boolean;
  savedOpen: boolean;
  setSavedOpen: (v: boolean) => void;
  auth: { open: boolean; tab: AuthTab; next?: string };
  openAuth: (tab?: AuthTab, next?: string) => void;
  closeAuth: () => void;
  reader: BookDTO | null;
  openReader: (b: BookDTO | null) => void;
  /** Sign out and wipe every trace of this account from the page and the browser. */
  signOut: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside <Providers>");
  return c;
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function forget(keys: string[]) {
  try {
    for (const k of keys) localStorage.removeItem(k);
  } catch {}
}

/** Remove everything one account could leave behind in this browser (cart, saved list, pincode, highlights, session id). */
function wipeAccountTraces() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k === GUEST_CART_KEY || k === GUEST_SAVED_KEY || LEGACY_KEYS.includes(k) || k === "bl_pin" || k.startsWith("bl_hl_") || k.startsWith("bookslab_cart_")) localStorage.removeItem(k);
    }
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("bl_")) sessionStorage.removeItem(k);
  } catch {}
}

const parseKey = (key: string) => {
  const [bookId, mode] = key.split(":");
  return { bookId, kit: mode === "kit" };
};

export function Providers({ initialUser, children }: { initialUser: SessionUser; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>(initialUser);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saved, setSaved] = useState<BookDTO[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [auth, setAuth] = useState<{ open: boolean; tab: AuthTab; next?: string }>({ open: false, tab: "signup" });
  const [reader, openReader] = useState<BookDTO | null>(null);
  const hydrated = useRef(false);

  const uid = user?.id ?? null;
  const uidRef = useRef<string | null>(uid); // identity that owns the cart currently on screen
  const prevUid = useRef<string | null | undefined>(undefined); // undefined → first run
  const queue = useRef<Promise<void>>(Promise.resolve()); // server cart writes run one at a time, in order
  const pending = useRef(0);

  useEffect(() => setUser(initialUser), [initialUser]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);

  /**
   * The signed-in identity decides where the cart comes from:
   *  • guest            → this browser's `bookslab_guest_cart`
   *  • signed in as X   → only X's cart from MongoDB (/api/cart), after merging any guest cart once
   *  • X signed out     → nothing at all; every per-account browser key is wiped
   * Whenever the identity changes the visible cart is emptied *first*, so the previous
   * person's items can never appear, even for a frame.
   */
  useEffect(() => {
    const prev = prevUid.current;
    prevUid.current = uid;
    uidRef.current = uid;
    forget(LEGACY_KEYS); // the old shared keys are what leaked carts between accounts
    let live = true;

    if (!uid) {
      if (prev) {
        setCart([]);
        setSaved([]);
        wipeAccountTraces();
      } else {
        setCart(load<CartItem[]>(GUEST_CART_KEY, []));
        setSaved(load<BookDTO[]>(GUEST_SAVED_KEY, []));
      }
      hydrated.current = true;
      return;
    }

    setCart([]);
    setSaved([]);
    hydrated.current = true;
    (async () => {
      const guestCart = load<CartItem[]>(GUEST_CART_KEY, []);
      const guestSaved = load<BookDTO[]>(GUEST_SAVED_KEY, []);
      try {
        const cartRes = guestCart.length
          ? await fetch("/api/cart/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: guestCart.map((i) => ({ bookId: i.bookId, kit: i.kit, quantity: Math.min(MAX_LINE_QTY, i.qty) })) }) })
          : await fetch("/api/cart", { cache: "no-store" });
        if (guestSaved.length) {
          await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merge: guestSaved.map((b) => b.id) }) });
        }
        const savedRes = await fetch("/api/wishlist", { cache: "no-store" });
        if (cartRes.ok) forget([GUEST_CART_KEY, GUEST_SAVED_KEY]); // merged exactly once
        const [c, w] = await Promise.all([cartRes.json().catch(() => ({})), savedRes.json().catch(() => ({}))]);
        if (!live || uidRef.current !== uid) return; // identity changed while loading — discard
        if (Array.isArray(c.items)) setCart(c.items);
        if (Array.isArray(w.books)) setSaved(w.books);
      } catch {}
    })();
    return () => { live = false; };
  }, [uid]);

  // Only a guest cart / saved list is ever written to the browser.
  // An empty list removes its key, so nothing is left behind after sign-out.
  useEffect(() => { if (hydrated.current && !uidRef.current) (cart.length ? save(GUEST_CART_KEY, cart) : forget([GUEST_CART_KEY])); }, [cart]);
  useEffect(() => { if (hydrated.current && !uidRef.current) (saved.length ? save(GUEST_SAVED_KEY, saved) : forget([GUEST_SAVED_KEY])); }, [saved]);

  /** Queue a write to the signed-in user's server cart; the final response replaces local state. */
  const syncCart = useCallback((request: () => Promise<Response>) => {
    const owner = uidRef.current;
    if (!owner) return;
    pending.current++;
    queue.current = queue.current.then(async () => {
      try {
        if (uidRef.current !== owner) return;
        const res = await request();
        const d = await res.json().catch(() => ({}));
        if (uidRef.current !== owner) return;
        if (res.status === 401) { setUser(null); return; } // session ended → treated as sign-out
        if (!res.ok) toast({ kind: "danger", title: d.error ?? "Couldn't update your cart." });
        if (pending.current === 1 && Array.isArray(d.items)) setCart(d.items);
        else if (!res.ok) {
          const fresh = await fetch("/api/cart", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
          if (fresh?.items && uidRef.current === owner) setCart(fresh.items);
        }
      } catch {
      } finally {
        pending.current--;
      }
    });
  }, [toast]);

  const json = (method: string, body?: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  const addToCart = useCallback<Ctx["addToCart"]>(
    (b, opts = {}) => {
      const kit = !!opts.kit;
      const qty = opts.qty ?? 1;
      const key = cartKey(b.id, kit);
      setCart((prev) => {
        const found = prev.find((i) => i.key === key);
        if (found) return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_LINE_QTY, i.qty + qty), price: b.price } : i));
        return [...prev, { key, bookId: b.id, slug: b.slug, title: b.title, author: b.author, price: b.price, mrp: b.mrp, coverImage: b.coverImage, category: b.category, digital: b.digital, qty: Math.min(MAX_LINE_QTY, qty), kit }];
      });
      syncCart(() => fetch("/api/cart", json("POST", { bookId: b.id, kit, quantity: Math.min(MAX_LINE_QTY, qty), mode: "add" })));
      if (!opts.silent) toast({ kind: "success", title: "Added to your cart", body: b.title });
    },
    [toast, syncCart],
  );
  const setQty = useCallback((key: string, qty: number) => {
    const q = Math.min(MAX_LINE_QTY, qty);
    setCart((prev) => (q <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty: q } : i))));
    const { bookId, kit } = parseKey(key);
    syncCart(() => fetch("/api/cart", json("POST", { bookId, kit, quantity: Math.max(0, q), mode: "set" })));
  }, [syncCart]);
  const removeFromCart = useCallback((key: string) => {
    setCart((p) => p.filter((i) => i.key !== key));
    const { bookId, kit } = parseKey(key);
    syncCart(() => fetch(`/api/cart?bookId=${encodeURIComponent(bookId)}&kit=${kit ? 1 : 0}`, { method: "DELETE" }));
  }, [syncCart]);
  const clearCart = useCallback(() => {
    setCart([]);
    syncCart(() => fetch("/api/cart", { method: "DELETE" }));
  }, [syncCart]);

  const signOut = useCallback(async () => {
    uidRef.current = null; // stop any queued cart writes from applying
    setCart([]);
    setSaved([]);
    setCartOpen(false);
    setSavedOpen(false);
    openReader(null);
    wipeAccountTraces();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const isSaved = useCallback((id: string) => saved.some((w) => w.id === id), [saved]);
  const toggleSaved = useCallback(
    (b: BookDTO) => {
      const on = !saved.some((w) => w.id === b.id);
      setSaved((prev) => (on ? [b, ...prev] : prev.filter((w) => w.id !== b.id)));
      if (!user) {
        toast({ kind: "info", title: on ? "Saved for later" : "Removed from saved" });
        return;
      }
      fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId: b.id, on }) })
        .then((r) => (r.ok ? toast({ kind: "info", title: on ? "Saved to your reading list" : "Removed from your reading list" }) : null))
        .catch(() => {});
    },
    [saved, user, toast],
  );

  const openAuth = useCallback((tab: AuthTab = "signup", next?: string) => setAuth({ open: true, tab, next }), []);
  const closeAuth = useCallback(() => setAuth((a) => ({ ...a, open: false })), []);

  const value = useMemo<Ctx>(
    () => ({ user, setUser, toast, cart, addToCart, setQty, removeFromCart, clearCart, cartOpen, setCartOpen, saved, toggleSaved, isSaved, savedOpen, setSavedOpen, auth, openAuth, closeAuth, reader, openReader, signOut }),
    [user, toast, cart, addToCart, setQty, removeFromCart, clearCart, cartOpen, saved, toggleSaved, isSaved, savedOpen, auth, openAuth, closeAuth, reader, signOut],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <ActivityTracker />
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1090, marginBottom: "env(safe-area-inset-bottom, 0px)" }} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast show border-0 shadow-sm" role="status">
            <div className="toast-body d-flex align-items-start gap-2">
              <i className={`bi ${t.kind === "success" ? "bi-check-circle-fill text-success" : t.kind === "danger" ? "bi-exclamation-circle-fill text-danger" : "bi-info-circle-fill text-primary"} mt-1`} />
              <div className="flex-grow-1">
                <div className="fw-semibold">{t.title}</div>
                {t.body && <div className="small text-muted">{t.body}</div>}
              </div>
              <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
            </div>
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

/** Session-time heartbeat feeding the admin "average session time" metric. */
function ActivityTracker() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  useEffect(() => {
    let sid = "";
    try {
      sid = sessionStorage.getItem("bl_sid") ?? "";
      if (!sid) sessionStorage.setItem("bl_sid", (sid = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`));
    } catch {
      sid = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    }
    let since = Date.now();
    const send = (beacon = false) => {
      const seconds = Math.min(60, Math.round((Date.now() - since) / 1000));
      since = Date.now();
      if (seconds < 1) return;
      const body = JSON.stringify({ sid, seconds, path: pathRef.current });
      if (beacon) navigator.sendBeacon?.("/api/activity", new Blob([body], { type: "application/json" }));
      else fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    };
    const iv = setInterval(() => document.visibilityState === "visible" && send(), 30_000);
    const onVis = () => (document.visibilityState === "hidden" ? send(true) : (since = Date.now()));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return null;
}

/** POST/PUT/… JSON helper that surfaces the server's error message. */
export function useApi() {
  const router = useRouter();
  const ctx = useContext(AppCtx);
  return useCallback(
    async <T = Record<string, unknown>,>(url: string, body?: unknown, method = "POST"): Promise<T> => {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && !url.startsWith("/api/auth")) {
        if (ctx) ctx.openAuth("signin", window.location.pathname);
        else router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      return data as T;
    },
    [router, ctx],
  );
}
