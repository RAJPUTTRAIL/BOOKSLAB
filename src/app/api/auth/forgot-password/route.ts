import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { parseIdentifier } from "@/lib/auth/identifier";
import { findUserById } from "@/lib/auth/session";
import { RESET_TTL_MIN, issueResetCode } from "@/lib/auth/reset";
import { logSecurity } from "@/lib/security-log";
import { emailConfigured, emailConsoleFallback, sendEmail } from "@/lib/email";
import { resetCodeEmail } from "@/lib/email-templates";
import { STORE } from "@/lib/store-info";

const schema = z.object({ identifier: z.string().trim().min(3, "Enter your registered email or mobile number") });

const UNAVAILABLE = `We couldn't send a reset email right now. Please try again in a few minutes, or call the Connaught Place store on ${STORE.phone}.`;

/**
 * Step 1 of "Forgot password": email a 6-character, 15-minute reset code via Resend.
 * The code is never returned to the browser. For unknown accounts the reply is the same generic
 * success, so this can't be used to check which emails are registered.
 */
export const POST = handle(async (req: Request) => {
  const { identifier } = schema.parse(await req.json());
  const id = parseIdentifier(identifier);
  if (!id) return NextResponse.json({ error: "Enter a valid email address or 10-digit Indian mobile number." }, { status: 400 });

  // Email isn't set up at all (no API key, and no local terminal fallback): say so for every input.
  if (!emailConfigured() && !emailConsoleFallback()) {
    console.error("[email] ✗ Password reset requested but RESEND_API_KEY is not set — add it to the environment variables and redeploy.");
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }

  const message = `If an account exists for ${identifier.trim()}, we've emailed a reset code to its registered email address. It's valid for ${RESET_TTL_MIN} minutes — check Spam / Promotions if it doesn't arrive.`;

  await connectDB();
  const found = await User.findOne(id).select("_id").lean();
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user) {
    await logSecurity("PASSWORD_RESET_UNKNOWN", { identifier, detail: "Reset requested for an unregistered email/mobile" });
    return NextResponse.json({ ok: true, message, ttlMinutes: RESET_TTL_MIN });
  }
  if (!user.email) {
    await logSecurity("PASSWORD_RESET_NO_EMAIL", { userId: user.id, identifier, detail: "Account has no email address for a reset code" });
    return NextResponse.json({ error: `This account doesn't have an email address, so we can't send a reset code. Please call the CP store on ${STORE.phone} and we'll help you sign in.` }, { status: 400 });
  }

  const code = await issueResetCode(user.id, user.resetPasswordRequestedAt);
  if (!code) return NextResponse.json({ error: "A code was sent moments ago — please wait 30 seconds before asking again." }, { status: 429 });

  const sent = await sendEmail({ to: user.email, tag: "password-reset", ...resetCodeEmail({ name: user.name, code, ttlMinutes: RESET_TTL_MIN }) });
  // sendEmail has already logged Resend's exact error and the fix in the server console.
  if (!sent.sent && !sent.printed) {
    await logSecurity("PASSWORD_RESET_EMAIL_FAILED", { userId: user.id, identifier, detail: `${sent.code}: ${sent.reason}` });
    return NextResponse.json({ error: UNAVAILABLE }, { status: 502 });
  }
  await logSecurity("PASSWORD_RESET_REQUESTED", { userId: user.id, identifier, detail: sent.sent ? `Reset code emailed (${sent.id})` : "Reset code printed to the server console (no RESEND_API_KEY, development)" });
  return NextResponse.json({ ok: true, message, ttlMinutes: RESET_TTL_MIN });
});
