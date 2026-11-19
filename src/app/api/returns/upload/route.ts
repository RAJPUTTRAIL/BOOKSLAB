import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { saveImage } from "@/lib/uploads";

/** Customer proof photos for a return (multipart field "files", 1–3 images, ≤ 5 MB each). */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (files.length > 3) return NextResponse.json({ error: "Upload up to 3 photos." }, { status: 400 });
  try {
    const urls = [];
    for (const f of files) urls.push(await saveImage(f, "returns"));
    return NextResponse.json({ ok: true, urls });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});
