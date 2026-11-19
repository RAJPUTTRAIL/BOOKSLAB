import { readFile } from "fs/promises";
import path from "path";

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
    return new Response("Not found", { status: 404 });
  }
}
