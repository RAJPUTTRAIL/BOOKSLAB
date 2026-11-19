import { getCurrentUser } from "@/lib/auth/session";
import { STORE } from "@/lib/store-info";
import { ContactForm } from "./form";

export const metadata = { title: "Contact us", description: "Questions about an order, a book or a bulk purchase? Write to the Bookslab team in Connaught Place." };
export const dynamic = "force-dynamic";

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="container py-5" style={{ maxWidth: 960 }}>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="eyebrow mb-1">Contact us</div>
          <h1 className="h3 mb-1">How can we help?</h1>
          <p className="text-muted">Write to us about an order, a title or a bulk purchase — we usually reply within one working day.</p>
          <ContactForm initial={{ name: user?.name ?? "", email: user?.email ?? "", phone: (user?.phone ?? "").replace(/^\+91/, ""), orderNumber: (sp.order ?? "").slice(0, 40), topic: sp.topic ?? "" }} />
        </div>
        <div className="col-lg-5">
          <div className="card rounded-4">
            <div className="card-body p-4 small">
              <h2 className="h6">Visit or call</h2>
              <p className="mb-2"><i className="bi bi-geo-alt me-2 text-primary" />{STORE.address}</p>
              <p className="mb-2"><i className="bi bi-clock me-2 text-primary" />{STORE.hours}</p>
              <p className="mb-2"><i className="bi bi-telephone me-2 text-primary" />{STORE.phone}</p>
              <p className="mb-0"><i className="bi bi-envelope me-2 text-primary" />{STORE.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
