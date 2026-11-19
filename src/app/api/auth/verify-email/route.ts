import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { createSession, findUserById } from "@/lib/auth/session";
import { publicUser } from "@/lib/auth/public-user";
import { confirmVerificationCode, needsEmailVerification } from "@/lib/auth/verify-email";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
});

/** Sign-up, step 2: confirm the emailed code → account verified, signed in, welcome email sent. */
export const POST = handle(async (req: Request) => {
  const { email, code } = schema.parse(await req.json());
  await connectDB();
  const found = await User.findOne({ email }).select("_id").lean();
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user) return NextResponse.json({ error: "That code is invalid or has expired. Request a new one." }, { status: 400 });
  if (!needsEmailVerification(user)) return NextResponse.json({ error: "This email is already verified — please sign in." }, { status: 409 });

  try {
    await confirmVerificationCode(user, code);
  } catch (e) {
    await logSecurity("EMAIL_VERIFY_FAILED", { userId: user.id, identifier: email, detail: (e as Error).message });
    throw e;
  }
  const fresh = (await findUserById(user.id))!;
  await createSession({ id: fresh.id, role: fresh.role ?? "customer", name: fresh.name, tokenVersion: fresh.tokenVersion });
  await logSecurity("SIGNUP", { userId: fresh.id, identifier: email, detail: "Email verified; account created and signed in" });

  // Welcome email (never blocks or fails verification; errors are logged by sendEmail).
  await sendEmail({ to: email, tag: "welcome", ...welcomeEmail({ name: fresh.name, email, phone: fresh.phone ?? null, createdAt: (fresh as unknown as { createdAt: Date }).createdAt }) });
  return NextResponse.json({ ok: true, user: publicUser(fresh) });
});
