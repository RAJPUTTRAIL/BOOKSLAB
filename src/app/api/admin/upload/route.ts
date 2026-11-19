import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { saveBookImage } from "@/lib/uploads";

/** multipart/form-data upload: field "files" (one or more). Returns public URLs under /uploads/books/. */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the images as multipart/form-data." }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No image files received." }, { status: 400 });
  if (files.length > 6) return NextResponse.json({ error: "Upload at most 6 images at a time." }, { status: 400 });
  try {
    const urls = [];
    for (const f of files) urls.push(await saveBookImage(f));
    return NextResponse.json({ ok: true, urls });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});
