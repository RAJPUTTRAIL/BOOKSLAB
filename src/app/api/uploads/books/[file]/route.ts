import { readFile } from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/mongo";
import { Book, type BookDoc } from "@/lib/models";
import { coverSvg } from "@/lib/cover-svg";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml" };

/** Serves files from public/uploads/books that were added after `next build` (see next.config rewrites). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w-]+\.(jpe?g|png|webp|avif|svg)$/i.test(file)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).toLowerCase();
  // Only our generated seed covers may be SVG; admin uploads are raster-only.
  if (ext === ".svg" && !file.startsWith("seed-")) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), "public", "uploads", "books", file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    // Seed covers are generated files that aren't committed (e.g. on Vercel). Draw them from the book record.
    const m = file.match(/^seed-([a-z0-9-]+?)(-back)?\.svg$/);
    if (m) {
      try {
        await connectDB();
        const book = await Book.findOne({ slug: m[1] }).select("title subtitle author category edition").lean<BookDoc>();
        if (book) {
          const svg = coverSvg({ title: book.title, subtitle: book.subtitle ?? "", author: book.author, category: book.category, edition: book.edition, variant: m[2] ? "back" : "front" });
          return new Response(svg, {
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            },
          });
        }
      } catch {}
    }
    return new Response("Not found", { status: 404 });
  }
}
