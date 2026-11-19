import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { createSession, findUserById } from "@/lib/auth/session";
import { parseIdentifier } from "@/lib/auth/identifier";
import { publicUser } from "@/lib/auth/public-user";
import { passwordSchema } from "@/lib/auth/password";
import { logSecurity } from "@/lib/security-log";
import { diagnostics, exposeEmailDiagnostics, sendEmail, type EmailResult } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  identifier: z.string().trim().min(3, "Enter your email or mobile number"),
  password: passwordSchema,
});

/** Single-step sign-up: create the account and sign the customer in straight away. */
export const POST = handle(async (req: Request) => {
  const data = schema.parse(await req.json());
  const id = parseIdentifier(data.identifier);
  if (!id) return NextResponse.json({ error: "Enter a valid email address or 10-digit Indian mobile number." }, { status: 400 });
  await connectDB();
  if (await User.exists(id)) return NextResponse.json({ error: "An account already exists for this email/mobile. Please sign in instead." }, { status: 409 });

  const created = await User.create({ name: data.name, ...id, passwordHash: await bcrypt.hash(data.password, 10) });
  const user = (await findUserById(String(created._id)))!;
  await createSession({ id: user.id, role: user.role ?? "customer", name: user.name, tokenVersion: user.tokenVersion });
  await logSecurity("SIGNUP", { userId: user.id, identifier: data.identifier, detail: "Account created and signed in" });
  // Welcome email. In development we wait for Resend so the response says exactly what happened;
  // in production it's sent after the response so sign-up never waits on email.
  let email: EmailResult | null = null;
  if (user.email) {
    const send = () => sendEmail({ to: user.email!, tag: "welcome", ...welcomeEmail({ name: user.name, identifier: user.email! }) });
    if (exposeEmailDiagnostics()) email = await send();
    else after(send);
  }
  return NextResponse.json({ ok: true, user: publicUser(user), ...(email ? { email: diagnostics(email) } : {}) });
});
