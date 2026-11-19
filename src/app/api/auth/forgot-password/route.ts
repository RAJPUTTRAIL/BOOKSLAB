import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { parseIdentifier } from "@/lib/auth/identifier";
import { findUserById } from "@/lib/auth/session";
import { RESET_TTL_MIN, issueResetCode, resetPreview } from "@/lib/auth/reset";
import { logSecurity } from "@/lib/security-log";
import { diagnostics, exposeEmailDiagnostics, sendEmail, type EmailResult } from "@/lib/email";
import { resetCodeEmail } from "@/lib/email-templates";

const schema = z.object({ identifier: z.string().trim().min(3, "Enter your registered email or mobile number") });

/**
 * Step 1 of "Forgot password": issue a 6-character, 15-minute reset code.
 * The response is the same whether or not the account exists, so this can't be used to probe
 * which emails/phones are registered (except in local preview mode, which shows the code).
 */
export const POST = handle(async (req: Request) => {
  const { identifier } = schema.parse(await req.json());
  const id = parseIdentifier(identifier);
  if (!id) return NextResponse.json({ error: "Enter a valid email address or 10-digit Indian mobile number." }, { status: 400 });
  // Codes go to the account's email (there is no SMS provider), so the reply says so — identically for every input.
  const message = `If an account exists for ${identifier.trim()}, we've emailed a reset code to its registered email address. It's valid for ${RESET_TTL_MIN} minutes.`;

  await connectDB();
  const found = await User.findOne(id).select("_id").lean();
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user) {
    await logSecurity("PASSWORD_RESET_UNKNOWN", { identifier, detail: "Reset requested for an unregistered email/mobile" });
    return NextResponse.json({ ok: true, message, ttlMinutes: RESET_TTL_MIN });
  }
  const code = await issueResetCode(user.id, user.resetPasswordRequestedAt);
  if (!code) return NextResponse.json({ error: "A code was sent moments ago — please wait 30 seconds before asking again." }, { status: 429 });

  // Deliver the code. sendEmail falls back to a terminal log when RESEND_API_KEY is missing.
  let delivery = "not delivered: account has no email (SMS isn't set up)";
  let email: EmailResult | null = null;
  if (user.email) {
    email = await sendEmail({ to: user.email, tag: "password-reset", ...resetCodeEmail({ name: user.name, code, ttlMinutes: RESET_TTL_MIN }) });
    delivery = email.sent ? `emailed (${email.id})` : `email not sent: ${email.reason}`;
  } else {
    console.log(`\n┌──────── Password reset code (no email on account — add an SMS provider) ────────\n│ ${identifier}: ${code}\n└────────────────────────────────────────────────────────────\n`);
  }
  if (resetPreview() && user.email) console.log(`\n┌──────── Bookslab password reset (dev preview) ────────\n│ Code for ${identifier}: ${code}\n└────────────────────────────────────────────────────────\n`);
  await logSecurity("PASSWORD_RESET_REQUESTED", { userId: user.id, identifier, detail: `Reset code ${delivery}` });
  return NextResponse.json({
    ok: true, message, ttlMinutes: RESET_TTL_MIN,
    ...(resetPreview() ? { devCode: code } : {}),
    // Dev-only delivery report (never in production: the reply must look the same for every input).
    ...(exposeEmailDiagnostics() ? { email: email ? diagnostics(email) : { sent: false, error: "Account has no email address", code: "no_email" } } : {}),
  });
});
