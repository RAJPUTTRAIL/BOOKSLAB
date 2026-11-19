import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { cancelOrder } from "@/lib/orders";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ reason: z.string().trim().max(300).optional().default("") });

/** Customer self-service cancellation — allowed only while the order is Placed or Confirmed. Restocks the books. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const { reason } = schema.parse(await req.json().catch(() => ({})));
  const order = await cancelOrder({ orderId: id, by: "customer", userId: user.id, reason: reason || "No reason given" });
  await logSecurity("ORDER_CANCELLED", { userId: user.id, identifier: user.email ?? user.phone, detail: `${order.orderNumber}: ${order.cancellationReason}` });
  return NextResponse.json({ ok: true, order });
});
