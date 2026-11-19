import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CartDrawer } from "@/components/cart-drawer";
import { SavedDrawer } from "@/components/saved-drawer";
import { ReaderModal } from "@/components/reader-modal";
import { SignupModal } from "@/components/auth/signup-modal";
import { getSessionUser } from "@/lib/session-user";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Bookslab · Connaught Place, New Delhi", template: "%s · Bookslab CP" },
  description: "Law, finance & tax, academic and technology books, curated in Connaught Place, New Delhi. Store pickup and Delhi NCR delivery.",
};

export const viewport: Viewport = { themeColor: "#FAF9F6", width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`}>
      <body>
        <Providers initialUser={user}>
          {children}
          <CartDrawer />
          <SavedDrawer />
          <ReaderModal />
          <SignupModal />
        </Providers>
      </body>
    </html>
  );
}
