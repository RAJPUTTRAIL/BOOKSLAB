import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User, type UserDoc } from "@/lib/models";
import { handle } from "@/lib/api";
import { findUserById } from "@/lib/auth/session";
import { passwordSchema } from "@/lib/auth/password";
import { sendVerificationCode, VERIFY_TTL_MIN } from "@/lib/auth/verify-email";
import { emailConfigured, emailConsoleFallback } from "@/lib/email";
import { logSecurity } from "@/lib/security-log";
import { STORE } from "@/lib/store-info";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().toLowerCase().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address — we'll send a verification code to it"),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, "").replace(/^0/, ""))
    .refine((s) => /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit Indian mobile number")
    .transform((s) => `+91${s}`),
  password: passwordSchema,
});

/**
 * Sign-up, step 1: save the details (unverified) and email a 6-digit code. No session yet —
 * the customer is signed in by /api/auth/verify-email once the code is confirmed.
 */
export const POST = handle(async (req: Request) => {
  const data = schema.parse(await req.json());
  if (!emailConfigured() && !emailConsoleFallback()) {
    console.error("[email] ✗ Sign-up attempted but RESEND_API_KEY is not set — verification codes can't be sent.");
    return NextResponse.json({ error: `We can't send verification emails right now, so new accounts can't be created. Please try again later or call the CP store on ${STORE.phone}.` }, { status: 503 });
  }
  await connectDB();

  const existing = await User.findOne({ email: data.email }).lean<UserDoc & { isEmailVerified?: boolean }>();
  if (existing && existing.isEmailVerified !== false) {
    return NextResponse.json({ error: "An account already exists for this email. Please sign in instead." }, { status: 409 });
  }
  // The mobile number must not belong to another verified account. An abandoned (unverified) sign-up holding it gives it up.
  const phoneOwner = await User.findOne({ phone: data.phone, _id: { $ne: existing?._id } }).lean<UserDoc & { isEmailVerified?: boolean }>();
  if (phoneOwner && phoneOwner.isEmailVerified !== false) {
    return NextResponse.json({ error: "This mobile number is already registered to another account.", field: "phone" }, { status: 409 });
  }
  if (phoneOwner) await User.updateOne({ _id: phoneOwner._id }, { $unset: { phone: 1 } });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const userId = existing
    ? (await User.updateOne({ _id: existing._id }, { $set: { name: data.name, phone: data.phone, passwordHash } }), String(existing._id))
    : String((await User.create({ name: data.name, email: data.email, phone: data.phone, passwordHash, isEmailVerified: false }))._id);
  const user = (await findUserById(userId))!;

  const r = await sendVerificationCode({ id: user.id, name: user.name, email: data.email, verificationOtpSentAt: user.verificationOtpSentAt });
  if (r.status === "failed") {
    await logSecurity("SIGNUP_EMAIL_FAILED", { userId, identifier: data.email, detail: `${r.result.sent ? "" : `${r.result.code}: ${r.result.reason}`}` });
    return NextResponse.json({ error: `We couldn't send a verification email to ${data.email} right now. Please check the address and try again in a few minutes, or call the CP store on ${STORE.phone}.` }, { status: 502 });
  }
  await logSecurity("SIGNUP_STARTED", { userId, identifier: data.email, detail: r.status === "sent" ? "Verification code emailed" : "Details updated; recent code still valid" });
  // Never include the code in the response — it only travels by email.
  return NextResponse.json({ ok: true, verificationRequired: true, email: data.email, ttlMinutes: VERIFY_TTL_MIN, resendIn: r.wait });
});
