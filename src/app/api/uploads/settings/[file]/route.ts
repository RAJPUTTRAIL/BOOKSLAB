import { readFile } from "fs/promises";
import path from "path";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" };

/** Serves admin-uploaded settings images (e.g. the store's UPI QR) added after `next build`. Raster only. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w-]+\.(jpe?g|png|webp|avif)$/i.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), "public", "uploads", "settings", file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[path.extname(file).toLowerCase()], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
