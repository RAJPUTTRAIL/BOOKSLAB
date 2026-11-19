import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { createSession, findUserById, requireUser } from "@/lib/auth/session";
import { passwordSchema } from "@/lib/auth/password";
import { logSecurity } from "@/lib/security-log";

const schema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "The two new passwords don't match", path: ["confirmPassword"] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "Choose a password you haven't used here", path: ["newPassword"] });

/** Change password while signed in. Other devices are signed out; this one stays signed in. */
export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const { currentPassword, newPassword } = schema.parse(await req.json());
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    await logSecurity("PASSWORD_CHANGE_FAILED", { userId: user.id, identifier: user.email ?? user.phone, detail: "Wrong current password" });
    return NextResponse.json({ error: "Your current password is incorrect.", field: "currentPassword" }, { status: 400 });
  }
  await connectDB();
  await User.updateOne({ _id: user.id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 10), resetPasswordToken: null, resetPasswordExpires: null }, $inc: { tokenVersion: 1 } });
  const fresh = (await findUserById(user.id))!;
  await createSession({ id: fresh.id, role: fresh.role ?? "customer", name: fresh.name, tokenVersion: fresh.tokenVersion });
  await logSecurity("PASSWORD_CHANGED", { userId: user.id, identifier: user.email ?? user.phone, detail: "Changed from profile; other sessions signed out" });
  return NextResponse.json({ ok: true });
});
