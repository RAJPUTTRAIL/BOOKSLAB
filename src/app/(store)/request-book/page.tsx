import { getCurrentUser } from "@/lib/auth/session";
import { RequestBookForm } from "./form";

export const metadata = { title: "Request a book", description: "Can't find a title? Our Connaught Place sourcing desk will find it for you." };
export const dynamic = "force-dynamic";

export default async function RequestBookPage({ searchParams }: { searchParams: Promise<{ title?: string; author?: string; isbn?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  return (
    <RequestBookForm
      signedIn={!!user}
      initial={{
        customerName: user?.name ?? "",
        phone: (user?.phone ?? user?.addresses?.find((a) => a.isDefault)?.phone ?? "").replace(/^\+91/, ""),
        email: user?.email ?? "",
        bookTitle: (sp.title ?? "").slice(0, 200),
        authorOrPublisher: (sp.author ?? "").slice(0, 120),
        isbn: (sp.isbn ?? "").replace(/[^\dXx-]/g, "").slice(0, 17),
      }}
    />
  );
}
