import "server-only";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { HttpError } from "@/lib/auth/session";

export const RESET_TTL_MIN = 15;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_COOLDOWN_SEC = 30;


// No 0/O, 1/I/L — easy to read back from a screen or SMS.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[\s-]/g, "");

/**
 * Create a fresh reset code for the account (only its bcrypt hash is stored).
 * Returns the plain code so the caller can deliver it — or null if a code was issued moments ago.
 */
export async function issueResetCode(userId: string, requestedAt: Date | null | undefined) {
  if (requestedAt && Date.now() - requestedAt.getTime() < RESET_COOLDOWN_SEC * 1000) return null;
  const code = newCode();
  await connectDB();
  await User.updateOne(
    { _id: userId },
    { $set: { resetPasswordToken: await bcrypt.hash(code, 10), resetPasswordExpires: new Date(Date.now() + RESET_TTL_MIN * 60_000), resetPasswordAttempts: 0, resetPasswordRequestedAt: new Date() } },
  );
  return code;
}

/** Check a code and, if valid, set the new password, clear the reset fields and sign out other sessions. */
export async function consumeResetCode(user: { id: string; resetPasswordToken?: string | null; resetPasswordExpires?: Date | null; resetPasswordAttempts?: number | null }, code: string, newPassword: string) {
  const invalid = new HttpError(400, "That code is invalid or has expired. Request a new one.");
  if (!user.resetPasswordToken || !user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) throw invalid;
  if ((user.resetPasswordAttempts ?? 0) >= RESET_MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Request a new code.");
  await connectDB();
  if (!(await bcrypt.compare(normalizeCode(code), user.resetPasswordToken))) {
    const left = RESET_MAX_ATTEMPTS - (user.resetPasswordAttempts ?? 0) - 1;
    await User.updateOne({ _id: user.id }, left <= 0 ? { $set: { resetPasswordToken: null, resetPasswordExpires: null }, $inc: { resetPasswordAttempts: 1 } } : { $inc: { resetPasswordAttempts: 1 } });
    throw new HttpError(400, left > 0 ? `That code doesn't match. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many attempts. Request a new code.");
  }
  // Conditional on the same token, so one code can only ever be used once.
  const r = await User.updateOne(
    { _id: user.id, resetPasswordToken: user.resetPasswordToken },
    { $set: { passwordHash: await bcrypt.hash(newPassword, 10), resetPasswordToken: null, resetPasswordExpires: null, resetPasswordAttempts: 0, resetPasswordRequestedAt: null, isEmailVerified: true, verificationOtp: null, verificationOtpExpires: null }, $inc: { tokenVersion: 1 } }, // the emailed code proves the inbox
  );
  if (!r.modifiedCount) throw invalid;
}
