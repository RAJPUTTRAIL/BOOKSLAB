import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, createSession, findUserById, requireUser } from "@/lib/auth/session";
import { CLEARED, checkChangeCode, emailChangeState } from "@/lib/auth/email-change";
import { profileOf, publicUser } from "@/lib/auth/public-user";
import { emailChangedNotice } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email") });

/**
 * Step 2B — confirm the code sent to the new email, then switch the account to it.
 * Other devices are signed out (tokenVersion bump); this one gets a fresh session.
 * The old address receives a security notice.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { code } = schema.parse(await req.json());
  const state = emailChangeState(user);
  if (state.step !== "VERIFY_NEW" || !user.pendingNewEmail) throw new HttpError(409, "There's no new email waiting to be confirmed — start again with “Change Email”.");
  try {
    await checkChangeCode(user, code);
  } catch (e) {
    await logSecurity("EMAIL_CHANGE_NEW_FAILED", { userId: user.id, identifier: user.email ?? user.phone, detail: (e as Error).message });
    throw e;
  }
  const oldEmail = user.email ?? null;
  const newEmail = user.pendingNewEmail;
  await connectDB();
  if (await User.exists({ email: newEmail, _id: { $ne: user.id } })) {
    await User.updateOne({ _id: user.id }, { $set: CLEARED });
    throw new HttpError(409, "That email was just registered to another account. Please choose a different one.");
  }
  const r = await User.updateOne(
    { _id: user.id, emailChangeStep: "VERIFY_NEW", pendingNewEmail: newEmail, emailChangeOtp: user.emailChangeOtp },
    { $set: { ...CLEARED, email: newEmail, isEmailVerified: true, resetPasswordToken: null, resetPasswordExpires: null }, $inc: { tokenVersion: 1 } },
  );
  if (!r.modifiedCount) throw new HttpError(409, "That code was already used. Start again with “Change Email”.");

  const fresh = (await findUserById(user.id))!;
  await createSession({ id: fresh.id, role: fresh.role ?? "customer", name: fresh.name, tokenVersion: fresh.tokenVersion }); // stay signed in here
  await logSecurity("EMAIL_CHANGED", { userId: fresh.id, identifier: newEmail, detail: `${oldEmail ?? "(none)"} → ${newEmail}; other sessions signed out` });
  if (oldEmail) await sendEmail({ to: oldEmail, tag: "email-changed", ...emailChangedNotice({ name: fresh.name, oldEmail, newEmail }) });
  return NextResponse.json({ ok: true, profile: profileOf(fresh), user: publicUser(fresh) });
});
