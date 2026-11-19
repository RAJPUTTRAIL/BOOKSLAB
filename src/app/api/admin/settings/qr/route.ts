import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { saveImage } from "@/lib/uploads";

/** Upload the store's own UPI QR image (multipart field "file"). It's applied when settings are saved. */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a QR code image to upload." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, url: await saveImage(file, "settings") });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});
