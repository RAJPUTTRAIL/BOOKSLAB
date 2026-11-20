import { NextResponse } from "next/server";
import { Resend } from "resend";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { EMAIL_FROM, emailConfigured, emailConsoleFallback, explainResendError } from "@/lib/email";

/**
 * Admin-only email diagnostics for a deployment: which key/sender this server actually has
 * (key masked) and Resend's exact answer to a test send to its safe test inbox.
 */
export const GET = handle(async () => {
  await requireAdmin();
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const status = {
    keySet: emailConfigured(),
    keyPreview: key ? `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)` : null,
    keyLooksQuoted: /^["']|["']$/.test(key),
    from: EMAIL_FROM,
    fromLooksQuoted: /^["']|["']$/.test(process.env.EMAIL_FROM ?? ""),
    consoleFallback: emailConsoleFallback(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  };
  if (!key) return NextResponse.json({ ...status, test: { sent: false, error: "RESEND_API_KEY is not set on this deployment" } });
  const { data, error } = await new Resend(key).emails.send({
    from: EMAIL_FROM, to: "delivered@resend.dev", subject: "Bookslab email check", text: "Deployment email check.",
  });
  return NextResponse.json({
    ...status,
    test: error
      ? { sent: false, name: error.name, message: error.message, ...explainResendError(error as { name?: string; message?: string }) }
      : { sent: true, id: data?.id },
  }, { headers: { "Cache-Control": "no-store" } });
});
