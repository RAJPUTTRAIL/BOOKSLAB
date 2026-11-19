import "server-only";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/mongo";
import { Book } from "@/lib/models";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "books");
export const SETTINGS_DIR = path.join(process.cwd(), "public", "uploads", "settings");
export const RETURNS_DIR = path.join(process.cwd(), "public", "uploads", "returns");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Sniff the real image type from magic bytes (never trust the client-sent MIME type). */
function sniff(buf: Buffer): "jpg" | "png" | "webp" | "avif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(buf.toString("ascii", 8, 12))) return "avif";
  return null;
}

export async function saveBookImage(file: File) {
  return saveImage(file, "books");
}

/** Validate (by magic bytes) and store an image under public/uploads/<folder>/ with a random name. */
export async function saveImage(file: File, folder: "books" | "settings" | "returns") {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" is larger than 5 MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error(`"${file.name}" isn't a JPG, PNG, WebP or AVIF image.`);
  const dir = folder === "books" ? UPLOAD_DIR : folder === "settings" ? SETTINGS_DIR : RETURNS_DIR;
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${folder}/${name}`;
}

/** Delete locally uploaded images that no book references any more (seed covers are kept). */
export async function removeUnusedUploads(urls: (string | null | undefined)[]) {
  for (const url of new Set(urls)) {
    const m = url?.match(/^\/uploads\/books\/([\w-]+\.(?:jpe?g|png|webp|avif))$/i);
    if (!m || !url) continue;
    await connectDB();
    const inUse = await Book.exists({ $or: [{ coverImage: url }, { galleryImages: url }] });
    if (!inUse) await unlink(path.join(UPLOAD_DIR, m[1])).catch(() => {});
  }
}

/** Remove a previously uploaded settings image (e.g. the store's old UPI QR). */
export async function removeSettingsImage(url: string | null | undefined) {
  const m = url?.match(/^\/uploads\/settings\/([\w-]+\.(?:jpe?g|png|webp|avif))$/i);
  if (m) await unlink(path.join(SETTINGS_DIR, m[1])).catch(() => {});
}
