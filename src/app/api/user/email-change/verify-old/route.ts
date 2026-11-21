import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth/session";
import { CHANGE_STEP_MIN, checkChangeCode, emailChangeState } from "@/lib/auth/email-change";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email") });

/** Step 1B — confirm the code sent to the current email; unlocks entering a new email for 15 minutes. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { code } = schema.parse(await req.json());
  if (emailChangeState(user).step !== "VERIFY_OLD") throw new HttpError(409, "There's no email change in progress — start again with “Change Email”.");
  try {
    await checkChangeCode(user, code);
  } catch (e) {
    await logSecurity("EMAIL_CHANGE_OLD_FAILED", { userId: user.id, identifier: user.email, detail: (e as Error).message });
    throw e;
  }
  await connectDB();
  const r = await User.updateOne(
    { _id: user.id, emailChangeStep: "VERIFY_OLD", emailChangeOtp: user.emailChangeOtp },
    { $set: { emailChangeStep: "VERIFY_NEW", emailChangeStepExpires: new Date(Date.now() + CHANGE_STEP_MIN * 60_000), emailChangeOtp: null, emailChangeOtpExpires: null, emailChangeOtpAttempts: 0, emailChangeOtpSentAt: null } },
  );
  if (!r.modifiedCount) throw new HttpError(409, "That code was already used. Start again with “Change Email”.");
  await logSecurity("EMAIL_CHANGE_OLD_VERIFIED", { userId: user.id, identifier: user.email, detail: "Current email confirmed" });
  return NextResponse.json({ ok: true, step: "VERIFY_NEW", currentEmail: user.email ?? null, pendingNewEmail: null, resendIn: 0 });
});
