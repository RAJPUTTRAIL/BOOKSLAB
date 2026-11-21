import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { CLEARED } from "@/lib/auth/email-change";
import { connectDB } from "@/lib/mongo";
import { User } from "@/lib/models";

/** Abandon an email change in progress. */
export const POST = handle(async () => {
  const user = await requireUser();
  await connectDB();
  await User.updateOne({ _id: user.id }, { $set: CLEARED });
  return NextResponse.json({ ok: true, step: "NONE" });
});
