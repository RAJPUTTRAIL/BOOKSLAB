import "server-only";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { HttpError, type AppUser } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";
import { STORE } from "@/lib/store-info";

export const CHANGE_TTL_MIN = 10; // each code
export const CHANGE_STEP_MIN = 15; // time allowed to finish step 2 after confirming the old email
export const CHANGE_COOLDOWN_SEC = 30;
export const CHANGE_MAX_ATTEMPTS = 5;

export type EmailChangeState = { step: "NONE" | "VERIFY_OLD" | "VERIFY_NEW"; currentEmail: string | null; pendingNewEmail: string | null; resendIn: number };

const cooldown = (sentAt: Date | null | undefined) => (sentAt ? Math.max(0, Math.ceil(CHANGE_COOLDOWN_SEC - (Date.now() - sentAt.getTime()) / 1000)) : 0);

/** The current step, treating an expired VERIFY_NEW window as NONE. */
export function emailChangeState(u: AppUser): EmailChangeState {
  let step = (u.emailChangeStep ?? "NONE") as EmailChangeState["step"];
  if (step === "VERIFY_NEW" && u.emailChangeStepExpires && u.emailChangeStepExpires.getTime() < Date.now()) step = "NONE";
  if (step === "VERIFY_OLD" && (!u.emailChangeOtpExpires || u.emailChangeOtpExpires.getTime() < Date.now())) step = "NONE";
  return { step, currentEmail: u.email ?? null, pendingNewEmail: step === "VERIFY_NEW" ? u.pendingNewEmail ?? null : null, resendIn: cooldown(u.emailChangeOtpSentAt) };
}

const UNAVAILABLE = `We couldn't send the email right now. Please try again in a few minutes, or call the CP store on ${STORE.phone}.`;

/** Create a code (only its hash is stored), save it with the given state, and email it. */
export async function issueChangeCode(
  u: AppUser,
  to: string,
  set: Record<string, unknown>,
  template: (code: string) => { subject: string; html: string; text: string },
  tag: string,
) {
  const wait = cooldown(u.emailChangeOtpSentAt);
  if (wait > 0) throw new HttpError(429, `Please wait ${wait}s before requesting another code.`);
  const code = String(randomInt(100000, 1000000));
  await connectDB();
  await User.updateOne(
    { _id: u.id },
    { $set: { ...set, emailChangeOtp: await bcrypt.hash(code, 10), emailChangeOtpExpires: new Date(Date.now() + CHANGE_TTL_MIN * 60_000), emailChangeOtpAttempts: 0, emailChangeOtpSentAt: new Date() } },
  );
  const r = await sendEmail({ to, tag, ...template(code) });
  if (!r.sent && !r.printed) {
    await User.updateOne({ _id: u.id }, { $set: { emailChangeOtpSentAt: null } }); // allow an immediate retry
    throw new HttpError(502, UNAVAILABLE);
  }
  return { resendIn: CHANGE_COOLDOWN_SEC };
}

/** Check a code for the expected step. Wrong codes count; after 5 the code is voided. */
export async function checkChangeCode(u: AppUser, code: string) {
  const invalid = new HttpError(400, "That code is invalid or has expired. Tap “Resend code” for a new one.");
  if (!u.emailChangeOtp || !u.emailChangeOtpExpires || u.emailChangeOtpExpires.getTime() < Date.now()) throw invalid;
  if ((u.emailChangeOtpAttempts ?? 0) >= CHANGE_MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Tap “Resend code” for a new one.");
  await connectDB();
  if (!(await bcrypt.compare(code.trim(), u.emailChangeOtp))) {
    const left = CHANGE_MAX_ATTEMPTS - (u.emailChangeOtpAttempts ?? 0) - 1;
    await User.updateOne({ _id: u.id }, left <= 0 ? { $set: { emailChangeOtp: null, emailChangeOtpExpires: null }, $inc: { emailChangeOtpAttempts: 1 } } : { $inc: { emailChangeOtpAttempts: 1 } });
    throw new HttpError(400, left > 0 ? `That code doesn't match. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many attempts. Tap “Resend code” for a new one.");
  }
}

export const CLEARED = { emailChangeStep: "NONE", pendingNewEmail: null, emailChangeOtp: null, emailChangeOtpExpires: null, emailChangeOtpAttempts: 0, emailChangeOtpSentAt: null, emailChangeStepExpires: null };
