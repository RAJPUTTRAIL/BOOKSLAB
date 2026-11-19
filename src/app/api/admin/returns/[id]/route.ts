import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { RETURN_STATUSES } from "@/lib/constants";
import { updateReturn } from "@/lib/returns";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ status: z.enum(RETURN_STATUSES), adminNote: z.string().trim().max(500).optional(), resellable: z.boolean().optional() });

/** Admin: update a return / replacement request (id = order id). */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = schema.parse(await req.json());
  const order = await updateReturn(id, body);
  await logSecurity("RETURN_UPDATED", { userId: admin.id, identifier: admin.email ?? admin.phone, detail: `${order.orderNumber}: ${order.returnRequest?.status}${body.adminNote ? ` — ${body.adminNote}` : ""}` });
  return NextResponse.json({ ok: true, order });
});
