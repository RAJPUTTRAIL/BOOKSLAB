import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/mongo";
import { ContactMessage } from "@/lib/models";
import { handle } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { contactSchema, type ContactResponse } from "@/lib/contact";
import { CONTACT_TO, sendEmail } from "@/lib/email";
import { contactNotificationEmail } from "@/lib/email-templates";

/**
 * POST /api/contact — save the message, then email it to the store inbox via Resend
 * (Reply-To = the customer). The message is stored first, so nothing is lost if email fails.
 */
export const POST = handle(async (req: Request) => {
  const body = contactSchema.parse(await req.json());
  if (body.website) return NextResponse.json<ContactResponse>({ error: "Something went wrong." }, { status: 400 });

  let ip: string | null = null;
  try { const h = await headers(); ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"); } catch {}
  const user = await getCurrentUser().catch(() => null);

  await connectDB();
  const hourAgo = new Date(Date.now() - 3600_000);
  const recent = await ContactMessage.countDocuments({ createdAt: { $gte: hourAgo }, $or: [{ email: body.email }, ...(ip ? [{ ip }] : [])] });
  if (recent >= 5) return NextResponse.json<ContactResponse>({ error: "You've sent several messages in the last hour — we'll reply to those first." }, { status: 429 });

  const { website: _hp, ...data } = body;
  const doc = await ContactMessage.create({ ...data, ip, userId: user?.id ?? null });

  const mail = await sendEmail({ to: CONTACT_TO, replyTo: body.email, tag: "contact", ...contactNotificationEmail({ ...data, signedIn: !!user }) });
  await ContactMessage.updateOne({ _id: doc._id }, { $set: mail.sent ? { emailed: true, emailId: mail.id } : { emailed: false, emailError: mail.reason } });

  return NextResponse.json<ContactResponse>({ ok: true, id: String(doc._id), emailed: mail.sent });
});
