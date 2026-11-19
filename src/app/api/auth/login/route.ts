import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { createSession, findUserById } from "@/lib/auth/session";
import { parseIdentifier } from "@/lib/auth/identifier";
import { publicUser } from "@/lib/auth/public-user";
import { logSecurity } from "@/lib/security-log";

const schema = z.object({ identifier: z.string().trim().min(3, "Enter your email or mobile number"), password: z.string().min(1, "Enter your password").max(200) });

/** Single-step sign-in: email/mobile + password → session cookie. */
export const POST = handle(async (req: Request) => {
  const { identifier, password } = schema.parse(await req.json());
  const id = parseIdentifier(identifier);
  await connectDB();
  const found = id ? await User.findOne(id).select("_id").lean() : null;
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await logSecurity("LOGIN_FAILED", { userId: user?.id, identifier, detail: "Incorrect email/mobile or password" });
    return NextResponse.json({ error: "That email/mobile and password don't match our records." }, { status: 401 });
  }
  await createSession({ id: user.id, role: user.role ?? "customer", name: user.name, tokenVersion: user.tokenVersion });
  await logSecurity("LOGIN", { userId: user.id, identifier, detail: "Signed in" });
  return NextResponse.json({ ok: true, user: publicUser(user) });
});
