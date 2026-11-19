import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User, isId, type UserDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ role: z.enum(["customer", "admin"]) });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = schema.parse(await req.json());
  if (id === admin.id && body.role === "customer") return NextResponse.json({ error: "You can't remove your own admin role." }, { status: 400 });
  if (!isId(id)) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await connectDB();
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { role: body.role } },
    { new: true },
  ).lean<UserDoc>();
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const who = admin.email ?? admin.phone;
  await logSecurity("ROLE_CHANGED", { userId: id, identifier: user.email ?? user.phone, detail: `Set to ${body.role} by ${who}` });
  return NextResponse.json({ ok: true, user: { role: user.role } });
});
