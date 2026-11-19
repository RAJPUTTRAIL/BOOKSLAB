import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { STORE } from "@/lib/store-info";

export function Footer() {
  return (
    <footer className="border-top bg-white mt-5 no-print">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="wordmark mb-2">Bookslab</div>
            <p className="text-muted small mb-3" style={{ maxWidth: 380 }}>A bookstore and academic publisher in the Inner Circle of Connaught Place, curating law, finance & tax, academic, technology and general titles for students and professionals.</p>
            <ul className="list-unstyled small text-muted mb-0">
              <li className="mb-1"><i className="bi bi-geo-alt me-2" />{STORE.address}</li>
              <li className="mb-1"><i className="bi bi-clock me-2" />{STORE.hours}</li>
              <li><i className="bi bi-telephone me-2" />{STORE.phone} · {STORE.email}</li>
            </ul>
          </div>
          <div className="col-6 col-lg-3 offset-lg-1">
            <div className="eyebrow mb-3">Browse</div>
            <ul className="list-unstyled small mb-0">
              {CATEGORIES.map((c) => <li key={c.key} className="mb-2"><Link href={`/search?c=${c.key}`} className="link-secondary text-decoration-none">{c.label}</Link></li>)}
              <li><Link href="/search?c=pickup" className="link-secondary text-decoration-none">CP Store Pickup</Link></li>
            </ul>
          </div>
          <div className="col-6 col-lg-3">
            <div className="eyebrow mb-3">Bookslab</div>
            <ul className="list-unstyled small mb-0">
              <li className="mb-2"><Link href="/#showcase" className="link-secondary text-decoration-none">2026 Compendium</Link></li>
              <li className="mb-2"><Link href="/#offers" className="link-secondary text-decoration-none">This week&apos;s offers</Link></li>
              <li className="mb-2"><Link href="/#kit-builder" className="link-secondary text-decoration-none">Build an exam kit</Link></li>
              <li className="mb-2"><Link href="/store" className="link-secondary text-decoration-none">Visit the CP store</Link></li>
              <li className="mb-2"><Link href="/request-book" className="link-secondary text-decoration-none">Request a Book</Link></li>
              <li><Link href="/account" className="link-secondary text-decoration-none">Your account</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-top py-3 text-center small text-muted">© {new Date().getFullYear()} Bookslab Publishing LLP · Connaught Place, New Delhi · Prices in ₹ INR, inclusive of applicable taxes</div>
    </footer>
  );
}
