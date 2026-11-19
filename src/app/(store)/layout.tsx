import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileNav } from "@/components/mobile-nav";
import { DbNotice } from "@/components/db-notice";
import { getContent, DEFAULT_BANNER } from "@/lib/content";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const banner = await getContent().then((c) => c.banner).catch(() => ({ ...DEFAULT_BANNER, active: false }));
  return (
    <div className="has-mobile-nav d-flex flex-column min-vh-100">
      <Header banner={banner} />
      <main className="flex-grow-1">
        <DbNotice />
        {children}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
