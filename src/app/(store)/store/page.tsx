import { BookCard } from "@/components/book-card";
import { DeliveryEstimator } from "@/components/delivery-estimator";
import { filterFor, listBooks } from "@/lib/catalog";
import { STORE } from "@/lib/store-info";

export const metadata = { title: "Our Connaught Place store" };

export default async function StorePage() {
  const inStore = await listBooks({ ...filterFor("pickup"), isFeatured: true }, 8, { rating: -1 });
  return (
    <div className="container py-5">
      <div className="eyebrow mb-2">Visit us</div>
      <h1 className="display-6 fw-bold mb-4">Bookslab, Connaught Place</h1>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card rounded-4 h-100">
            <div className="card-body p-4">
              <ul className="list-unstyled mb-4">
                <li className="mb-3 d-flex gap-3"><i className="bi bi-geo-alt fs-5 text-primary" /><span><strong>{STORE.name}</strong><br />{STORE.address}</span></li>
                <li className="mb-3 d-flex gap-3"><i className="bi bi-train-front fs-5 text-primary" />{STORE.landmark}</li>
                <li className="mb-3 d-flex gap-3"><i className="bi bi-clock fs-5 text-primary" />{STORE.hours}</li>
                <li className="mb-3 d-flex gap-3"><i className="bi bi-bag-check fs-5 text-primary" />{STORE.pickupWindow}</li>
                <li className="mb-3 d-flex gap-3"><i className="bi bi-chat-square-text fs-5 text-primary" />Ask our staff for edition advice — we keep the latest amendments in stock</li>
                <li className="d-flex gap-3"><i className="bi bi-telephone fs-5 text-primary" />{STORE.phone} · {STORE.email}</li>
              </ul>
              <a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Open in Google Maps</a>
            </div>
          </div>
        </div>
        <div className="col-lg-5"><DeliveryEstimator /></div>
      </div>
      {inStore.length > 0 && (
        <>
          <h2 className="h4 mt-5 mb-4">On our shelves today</h2>
          <div className="row row-cols-2 row-cols-md-4 g-4">
            {inStore.map((b) => <div className="col" key={b.id}><BookCard book={b} /></div>)}
          </div>
        </>
      )}
    </div>
  );
}
