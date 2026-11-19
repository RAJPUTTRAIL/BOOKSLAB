import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";
import { handle } from "@/lib/api";
import { findUserById } from "@/lib/auth/session";
import { needsEmailVerification, sendVerificationCode, VERIFY_COOLDOWN_SEC } from "@/lib/auth/verify-email";
import { STORE } from "@/lib/store-info";

const schema = z.object({ email: z.string().trim().toLowerCase().min(3) });

/** Send a new verification code (30-second cooldown). Same reply for unknown/verified emails. */
export const POST = handle(async (req: Request) => {
  const { email } = schema.parse(await req.json());
  await connectDB();
  const found = await User.findOne({ email }).select("_id").lean();
  const user = found ? await findUserById(String(found._id)) : null;
  if (!user || !needsEmailVerification(user) || !user.email) return NextResponse.json({ ok: true, resendIn: VERIFY_COOLDOWN_SEC });
  const r = await sendVerificationCode({ id: user.id, name: user.name, email: user.email, verificationOtpSentAt: user.verificationOtpSentAt });
  if (r.status === "cooldown") return NextResponse.json({ error: `Please wait ${r.wait}s before requesting another code.`, resendIn: r.wait }, { status: 429 });
  if (r.status === "failed") return NextResponse.json({ error: `We couldn't send the email right now. Please try again in a few minutes, or call the CP store on ${STORE.phone}.` }, { status: 502 });
  return NextResponse.json({ ok: true, resendIn: r.wait });
});
