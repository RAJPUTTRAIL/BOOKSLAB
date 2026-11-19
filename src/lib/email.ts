import "server-only";
import { Resend } from "resend";

/**
 * Transactional email via Resend.
 *  • RESEND_API_KEY — required to actually send; without it, emails are logged to the terminal instead.
 *  • EMAIL_FROM     — sender, default "Bookslab <onboarding@resend.dev>".
 *    Note: Resend's onboarding@resend.dev sender only delivers to the email address of your own
 *    Resend account. Verify your domain at resend.com/domains and set EMAIL_FROM to send to customers.
 * sendEmail never throws — a failed email must never break a checkout or a password reset.
 */

export const EMAIL_FROM = process.env.EMAIL_FROM || "Bookslab <onboarding@resend.dev>";

let client: Resend | null = null;
const resend = () => (process.env.RESEND_API_KEY ? (client ??= new Resend(process.env.RESEND_API_KEY)) : null);

export type EmailResult = { sent: true; id: string } | { sent: false; reason: string };

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; tag?: string }): Promise<EmailResult> {
  const r = resend();
  if (!r) {
    console.log(`\n┌──────── Email not sent (RESEND_API_KEY is missing) ────────\n│ To: ${msg.to}\n│ Subject: ${msg.subject}\n│\n${msg.text.split("\n").map((l) => `│ ${l}`).join("\n")}\n└────────────────────────────────────────────────────────────\n`);
    return { sent: false, reason: "RESEND_API_KEY is not set" };
  }
  try {
    const { data, error } = await r.emails.send({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.tag ? { tags: [{ name: "category", value: msg.tag }] } : {}),
    });
    if (error || !data) {
      console.error(`[email] Resend rejected "${msg.subject}" to ${msg.to}: ${error?.message ?? "unknown error"}`);
      return { sent: false, reason: error?.message ?? "unknown error" };
    }
    return { sent: true, id: data.id };
  } catch (e) {
    console.error(`[email] Couldn't reach Resend for "${msg.subject}": ${(e as Error).message}`);
    return { sent: false, reason: (e as Error).message };
  }
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
