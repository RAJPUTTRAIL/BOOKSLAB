import { Hero } from "@/components/home/hero";
import { Showcase } from "@/components/home/showcase";
import { BookRow } from "@/components/home/book-row";
import { Offers } from "@/components/home/offers";
import { KitBuilder } from "@/components/home/kit-builder";
import { DeliveryEstimator } from "@/components/delivery-estimator";
import { Reveal } from "@/components/reveal";
import { activeDrops, listBooks, type BookDTO } from "@/lib/catalog";
import { DEFAULT_BANNER, DEFAULT_HERO, DEFAULT_SHOWCASE, getContent } from "@/lib/content";
import { STORE } from "@/lib/store-info";

export default async function HomePage() {
  // If the database is unavailable, render the page shell; <DbNotice /> in the layout explains how to fix it.
  const [{ hero, showcase }, all, offers] = await Promise.all([getContent(), listBooks({}, 300), activeDrops()]).catch(
    () => [{ hero: DEFAULT_HERO, showcase: DEFAULT_SHOWCASE, banner: DEFAULT_BANNER }, [] as BookDTO[], [] as Awaited<ReturnType<typeof activeDrops>>] as const,
  );
  const bySlug = (s: string) => all.find((b) => b.slug === s);
  const bundle = hero.bundleBookSlugs.map(bySlug).filter((b): b is BookDTO => !!b);
  const addonSlugs = new Set(showcase.editions.flatMap((e) => e.addonSlugs));
  const pick = (category: string) =>
    all.filter((b) => b.category === category).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.rating - a.rating).slice(0, 4);

  return (
    <>
      <Hero hero={hero} bundle={bundle} />
      <BookRow id="finance" eyebrow="Finance & Tax" title="GST, Income Tax, Customs & Corporate" blurb="Practitioner editions updated for the Income-tax Act, 2025 and recent GST changes." books={pick("Finance & Tax")} href="/search?c=finance" />
      <BookRow id="law" eyebrow="Law & Legal" title="Bare Acts to the bench" blurb="BNS, BNSS and BSA with concordances, commentaries and solved papers." books={pick("Law")} href="/search?c=law" />
      <Showcase content={showcase} book={bySlug(showcase.bookSlug) ?? null} addons={all.filter((b) => addonSlugs.has(b.slug))} />
      <BookRow id="academic" eyebrow="Academic · CA / CS / CMA" title="Foundation to Final" blurb="Institute-aligned modules, scanners and practice banks." books={pick("Academic")} href="/search?c=academic" />
      <Offers offers={offers} />
      <BookRow id="tech" eyebrow="Tech & AI" title="Technology, data & management" blurb="Practical books on AI, systems and running a modern practice." books={pick("Tech & Management")} href="/search?c=tech" />
      <KitBuilder books={all} />
      <BookRow id="general" eyebrow="General reading" title="For the curious professional" blurb="Writing, study skills, personal finance and the story of Connaught Place." books={pick("General")} href="/search?c=general" />
      <section className="py-5">
        <div className="container">
          <Reveal>
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="card rounded-4 h-100">
                  <div className="card-body">
                    <div className="eyebrow mb-2">Visit us</div>
                    <h3 className="h5">{STORE.name}, Connaught Place</h3>
                    <ul className="list-unstyled small text-muted mb-3">
                      <li className="mb-1"><i className="bi bi-geo-alt me-2" />{STORE.address}</li>
                      <li className="mb-1"><i className="bi bi-train-front me-2" />{STORE.landmark}</li>
                      <li><i className="bi bi-clock me-2" />{STORE.hours}</li>
                    </ul>
                    <a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-light border btn-sm">Get directions</a>
                  </div>
                </div>
              </div>
              <div className="col-lg-4"><DeliveryEstimator compact /></div>
              <div className="col-lg-4">
                <div className="card rounded-4 h-100">
                  <div className="card-body">
                    <div className="eyebrow mb-2">Ordering with us</div>
                    <h3 className="h5">Simple, and easy to change</h3>
                    <ul className="list-unstyled small text-muted mb-3">
                      <li className="mb-1"><i className="bi bi-cash-coin me-2" />Pay by cash, UPI or card on collection or delivery</li>
                      <li className="mb-1"><i className="bi bi-arrow-counterclockwise me-2" />Cancel online any time before dispatch</li>
                      <li><i className="bi bi-bag-check me-2" />Your cart is saved to your account on every device</li>
                    </ul>
                    <a href="/my-orders" className="btn btn-light border btn-sm">My Orders</a>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
