import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { deleteAddress, setDefaultAddress, updateAddress } from "@/lib/addresses";

type Ctx = { params: Promise<{ id: string }> };

/** Edit an address (send isDefault: true to also make it the default). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return NextResponse.json({ ok: true, addresses: await updateAddress(user.id, id, await req.json()) });
});

/** PATCH { isDefault: true } — set as default (every other address is un-set in the same update). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  z.object({ isDefault: z.literal(true) }).parse(await req.json());
  return NextResponse.json({ ok: true, addresses: await setDefaultAddress(user.id, id) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return NextResponse.json({ ok: true, addresses: await deleteAddress(user.id, id) });
});
