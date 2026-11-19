import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { parseIdentifier } from "@/lib/auth/identifier";
import { findUserById } from "@/lib/auth/session";
import { passwordSchema } from "@/lib/auth/password";
import { consumeResetCode } from "@/lib/auth/reset";
import { logSecurity } from "@/lib/security-log";

const schema = z
  .object({
    identifier: z.string().trim().min(3),
    code: z.string().trim().min(6, "Enter the 6-character code").max(12),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "The two passwords don't match", path: ["confirmPassword"] });

/** Step 2 of "Forgot password": verify the code and set the new password. */
export const POST = handle(async (req: Request) => {
  const { identifier, code, password } = schema.parse(await req.json());
  const id = parseIdentifier(identifier);
  await connectDB();
  const found = id ? await User.findOne(id).select("_id").lean() : null;
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user) return NextResponse.json({ error: "That code is invalid or has expired. Request a new one." }, { status: 400 });
  try {
    await consumeResetCode(user, code, password);
  } catch (e) {
    await logSecurity("PASSWORD_RESET_FAILED", { userId: user.id, identifier, detail: (e as Error).message });
    throw e;
  }
  await logSecurity("PASSWORD_RESET", { userId: user.id, identifier, detail: "Password changed with a reset code; other sessions signed out" });
  return NextResponse.json({ ok: true });
});
