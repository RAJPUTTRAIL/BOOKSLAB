import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createReturn } from "@/lib/returns";
import { logSecurity } from "@/lib/security-log";

/** Customer: request a replacement or a return & refund on a delivered order (7-day window). */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const order = await createReturn(user.id, id, await req.json());
  await logSecurity("RETURN_REQUESTED", { userId: user.id, identifier: user.email ?? user.phone, detail: `${order.orderNumber}: ${order.returnRequest?.requestType} — ${order.returnRequest?.reason}` });
  return NextResponse.json({ ok: true, order });
});
