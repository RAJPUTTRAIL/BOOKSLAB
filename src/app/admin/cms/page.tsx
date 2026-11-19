import { connectDB } from "@/lib/mongo";
import { Book, Drop, type BookDoc, type DropDoc } from "@/lib/models";
import { getContent } from "@/lib/content";
import { CmsEditor } from "./editor";

export const metadata = { title: "Homepage content" };
export const dynamic = "force-dynamic";

export default async function CmsPage() {
  await connectDB();
  const [content, books, drops] = await Promise.all([
    getContent(),
    Book.find().select("slug title discountedPrice mrp").sort({ title: 1 }).lean<BookDoc[]>(),
    Drop.find().sort({ createdAt: -1 }).limit(30).lean<DropDoc[]>(),
  ]);
  const opts = books.map((b) => ({ id: String(b._id), slug: b.slug, title: b.title, price: b.discountedPrice, mrp: b.mrp }));
  return (
    <CmsEditor
      content={JSON.parse(JSON.stringify(content))}
      books={opts}
      drops={drops.map((d) => {
        const b = opts.find((x) => x.id === String(d.bookId));
        return { id: String(d._id), bookTitle: b?.title ?? "Deleted book", mrp: b?.mrp ?? 0, discountPct: d.discountPct, label: d.label ?? "", endsAt: d.endsAt.toISOString(), active: d.active !== false };
      })}
    />
  );
}
