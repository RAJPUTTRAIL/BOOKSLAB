import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addAddress, listAddresses } from "@/lib/addresses";

/** The signed-in customer's saved delivery addresses (default first). */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ addresses: await listAddresses(user.id) }, { headers: { "Cache-Control": "no-store" } });
});

/** Add an address. The first one (or one sent with isDefault: true) becomes the default. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { id, addresses } = await addAddress(user.id, await req.json());
  return NextResponse.json({ ok: true, id, addresses });
});
