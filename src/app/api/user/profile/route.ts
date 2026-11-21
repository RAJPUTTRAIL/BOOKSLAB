import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { createSession, findUserById, requireUser } from "@/lib/auth/session";
import { parseIdentifier } from "@/lib/auth/identifier";
import { profileOf, publicUser } from "@/lib/auth/public-user";
import { logSecurity } from "@/lib/security-log";

/** The signed-in customer's profile. */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ profile: profileOf(user) }, { headers: { "Cache-Control": "no-store" } });
});

const schema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name").max(80),
    email: z.string().trim().max(120).default(""),
    phone: z.string().trim().max(20).default(""),
  })
  .refine((d) => d.email || d.phone, { message: "Keep at least an email address or a mobile number — you sign in with it.", path: ["email"] });

/**
 * Update name and primary phone (phone must not belong to another account). The email can only be
 * changed through the two-step /api/user/email-change flow. Addresses: /api/user/addresses.
 */
export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());

  const email: string | null = user.email ?? null;
  if ((body.email || "").toLowerCase() !== (email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "To change your email, use “Change Email” — we'll confirm both your current and new address.", field: "email" }, { status: 400 });
  }
  let phone: string | null = null;
  if (!email && !body.phone) return NextResponse.json({ error: "Keep a mobile number — it's how you sign in.", field: "phone" }, { status: 400 });
  if (body.phone) {
    const p = parseIdentifier(body.phone);
    if (!p || !("phone" in p)) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number.", field: "phone" }, { status: 400 });
    phone = p.phone;
  }

  await connectDB();
  if (phone && (await User.exists({ phone, _id: { $ne: user.id } }))) return NextResponse.json({ error: "That mobile number is already registered to another account.", field: "phone" }, { status: 409 });

  const $set: Record<string, unknown> = { name: body.name };
  const $unset: Record<string, 1> = {};
  if (phone) $set.phone = phone; else $unset.phone = 1;
  await User.updateOne({ _id: user.id }, Object.keys($unset).length ? { $set, $unset } : { $set }); // unique indexes still guard races (→ 409)

  const fresh = (await findUserById(user.id))!;
  await createSession({ id: fresh.id, role: fresh.role ?? "customer", name: fresh.name, tokenVersion: fresh.tokenVersion }); // navbar name updates without re-login
  const changed = [user.name !== fresh.name && "name", (user.email ?? "") !== (fresh.email ?? "") && "email", (user.phone ?? "") !== (fresh.phone ?? "") && "phone"].filter(Boolean).join(", ");
  if (changed) await logSecurity("PROFILE_UPDATED", { userId: fresh.id, identifier: fresh.email ?? fresh.phone, detail: `Changed: ${changed}` });
  return NextResponse.json({ ok: true, profile: profileOf(fresh), user: publicUser(fresh) });
});
