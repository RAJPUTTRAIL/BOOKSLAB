import "server-only";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { HttpError, type AppUser } from "@/lib/auth/session";
import { sendEmail, type EmailResult } from "@/lib/email";
import { verifyEmailCode } from "@/lib/email-templates";

export const VERIFY_TTL_MIN = 10;
export const VERIFY_COOLDOWN_SEC = 30;
export const VERIFY_MAX_ATTEMPTS = 5;

/** Accounts created before email verification existed have no flag — they count as verified. */
export const needsEmailVerification = (u: Pick<AppUser, "isEmailVerified"> & { isEmailVerified?: boolean | null }) => u.isEmailVerified === false;

export const cooldownLeft = (sentAt: Date | null | undefined) =>
  sentAt ? Math.max(0, Math.ceil(VERIFY_COOLDOWN_SEC - (Date.now() - sentAt.getTime()) / 1000)) : 0;

/**
 * Issue a fresh 6-digit code (100000–999999; only its bcrypt hash is stored) and email it via Resend.
 * Respects the 30-second resend cooldown: returns { sent: false, wait } instead of sending again.
 */
export async function sendVerificationCode(user: { id: string; name: string; email: string; verificationOtpSentAt?: Date | null }) {
  const wait = cooldownLeft(user.verificationOtpSentAt);
  if (wait > 0) return { status: "cooldown" as const, wait };
  const code = String(randomInt(100000, 1000000));
  await connectDB();
  await User.updateOne(
    { _id: user.id },
    { $set: { verificationOtp: await bcrypt.hash(code, 10), verificationOtpExpires: new Date(Date.now() + VERIFY_TTL_MIN * 60_000), verificationOtpAttempts: 0, verificationOtpSentAt: new Date() } },
  );
  const result: EmailResult = await sendEmail({ to: user.email, tag: "verify-email", ...verifyEmailCode({ name: user.name, code, ttlMinutes: VERIFY_TTL_MIN }) });
  if (!result.sent && !result.printed) {
    // Let them try again straight away rather than waiting out a cooldown for an email that never went.
    await User.updateOne({ _id: user.id }, { $set: { verificationOtpSentAt: null } });
    return { status: "failed" as const, result };
  }
  return { status: "sent" as const, wait: VERIFY_COOLDOWN_SEC };
}

/** Check a code. On success the account becomes verified and the code is cleared (single use). */
export async function confirmVerificationCode(user: AppUser, code: string) {
  const invalid = new HttpError(400, "That code is invalid or has expired. Request a new one.");
  if (!needsEmailVerification(user)) return; // already verified
  if (!user.verificationOtp || !user.verificationOtpExpires || user.verificationOtpExpires.getTime() < Date.now()) throw invalid;
  if ((user.verificationOtpAttempts ?? 0) >= VERIFY_MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Tap “Resend code” for a new one.");
  await connectDB();
  if (!(await bcrypt.compare(code.trim(), user.verificationOtp))) {
    const left = VERIFY_MAX_ATTEMPTS - (user.verificationOtpAttempts ?? 0) - 1;
    await User.updateOne({ _id: user.id }, left <= 0 ? { $set: { verificationOtp: null, verificationOtpExpires: null }, $inc: { verificationOtpAttempts: 1 } } : { $inc: { verificationOtpAttempts: 1 } });
    throw new HttpError(400, left > 0 ? `That code doesn't match. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many attempts. Tap “Resend code” for a new one.");
  }
  const r = await User.updateOne(
    { _id: user.id, verificationOtp: user.verificationOtp },
    { $set: { isEmailVerified: true, verificationOtp: null, verificationOtpExpires: null, verificationOtpAttempts: 0, verificationOtpSentAt: null } },
  );
  if (!r.modifiedCount) throw invalid;
}
