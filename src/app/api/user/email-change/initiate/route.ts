import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { CHANGE_STEP_MIN, CHANGE_TTL_MIN, issueChangeCode } from "@/lib/auth/email-change";
import { emailChangeOldCode } from "@/lib/email-templates";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { logSecurity } from "@/lib/security-log";

/** Step 1A — email a 6-digit code to the CURRENT address (also used for "Resend code"). Never returns the code. */
export const POST = handle(async () => {
  const user = await requireUser();
  if (!user.email) {
    // Older phone-only accounts have no current email to confirm: go straight to adding one.
    await connectDB();
    await User.updateOne({ _id: user.id }, { $set: { emailChangeStep: "VERIFY_NEW", emailChangeStepExpires: new Date(Date.now() + CHANGE_STEP_MIN * 60_000), pendingNewEmail: null, emailChangeOtp: null } });
    return NextResponse.json({ ok: true, step: "VERIFY_NEW", currentEmail: null, resendIn: 0 });
  }
  const { resendIn } = await issueChangeCode(
    user, user.email,
    { emailChangeStep: "VERIFY_OLD", pendingNewEmail: null, emailChangeStepExpires: null },
    (code) => emailChangeOldCode({ name: user.name, code, ttlMinutes: CHANGE_TTL_MIN }),
    "email-change-old",
  );
  await logSecurity("EMAIL_CHANGE_STARTED", { userId: user.id, identifier: user.email, detail: "Code sent to the current email" });
  return NextResponse.json({ ok: true, step: "VERIFY_OLD", currentEmail: user.email, pendingNewEmail: null, resendIn });
});
