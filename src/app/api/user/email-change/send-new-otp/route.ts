import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth/session";
import { CHANGE_TTL_MIN, emailChangeState, issueChangeCode } from "@/lib/auth/email-change";
import { emailChangeNewCode } from "@/lib/email-templates";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({
  newEmail: z.string().trim().toLowerCase().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address"),
});

/** Step 2A — only after the current email is confirmed: email a code to the NEW address (also "Resend code"). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { newEmail } = schema.parse(await req.json());
  if (emailChangeState(user).step !== "VERIFY_NEW") throw new HttpError(403, "Confirm your current email first — start again with “Change Email”.");
  if (newEmail === (user.email ?? "").toLowerCase()) throw new HttpError(400, "That's already your email address.");
  await connectDB();
  if (await User.exists({ email: newEmail, _id: { $ne: user.id } })) throw new HttpError(409, "That email is already registered to another account.");

  const { resendIn } = await issueChangeCode(
    user, newEmail,
    { pendingNewEmail: newEmail },
    (code) => emailChangeNewCode({ name: user.name, code, ttlMinutes: CHANGE_TTL_MIN }),
    "email-change-new",
  );
  await logSecurity("EMAIL_CHANGE_NEW_SENT", { userId: user.id, identifier: user.email ?? user.phone, detail: `Code sent to ${newEmail}` });
  return NextResponse.json({ ok: true, step: "VERIFY_NEW", currentEmail: user.email ?? null, pendingNewEmail: newEmail, resendIn });
});
