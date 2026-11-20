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

/** Where store notifications (e.g. contact-form messages) go. With onboarding@resend.dev this must be your Resend account's email. */
export const CONTACT_TO = process.env.CONTACT_TO || "hello@bookslab.in";

const PLACEHOLDER_KEY = "re_123456789"; // the value in .env.example
const apiKey = () => {
  const k = process.env.RESEND_API_KEY?.trim();
  return k && k !== PLACEHOLDER_KEY ? k : null;
};

let client: Resend | null = null;
const resend = () => { const k = apiKey(); return k ? (client ??= new Resend(k)) : null; };

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: string; code: EmailErrorCode; hint: string; printed?: boolean }; // printed: shown in the terminal instead (dev, no key)

/**
 * Without RESEND_API_KEY, print emails to the terminal instead of sending them. On by default in
 * development only; never in production unless EMAIL_CONSOLE_FALLBACK="true" is set explicitly.
 */
export const emailConsoleFallback = () =>
  process.env.EMAIL_CONSOLE_FALLBACK ? process.env.EMAIL_CONSOLE_FALLBACK === "true" : process.env.NODE_ENV !== "production";

export type EmailErrorCode = "not_configured" | "sandbox_recipient" | "invalid_recipient" | "domain_not_verified" | "invalid_api_key" | "rate_limited" | "invalid_request" | "network" | "unknown";

/** Turn Resend's error into a stable code + a plain-language fix (shown in logs and dev API responses). */
export function explainResendError(err: { name?: string; message?: string; statusCode?: number | null } | null | undefined): { code: EmailErrorCode; hint: string } {
  const name = (err?.name ?? "").toLowerCase();
  const msg = (err?.message ?? "").toLowerCase();
  if (msg.includes("testing emails") || msg.includes("only send testing emails"))
    return { code: "sandbox_recipient", hint: `${EMAIL_FROM} is Resend's test sender: it only delivers to your own Resend account email. Verify your domain at resend.com/domains and set EMAIL_FROM (e.g. "Bookslab <no-reply@yourdomain.in>").` };
  if (msg.includes("testing email address instead of") || msg.includes("invalid `to`"))
    return { code: "invalid_recipient", hint: "Resend refuses placeholder recipients such as example.com / test.com. Use a real inbox — or delivered@resend.dev to test without emailing anyone." };
  if (msg.includes("domain is not verified") || msg.includes("verify a domain") || (name === "validation_error" && msg.includes("domain")))
    return { code: "domain_not_verified", hint: `The domain in EMAIL_FROM (${EMAIL_FROM}) isn't verified in Resend. Add its DNS records (SPF, DKIM) at your registrar, wait for "Verified" at resend.com/domains, then retry.` };
  if (name.includes("api_key") || err?.statusCode === 401 || err?.statusCode === 403)
    return { code: "invalid_api_key", hint: "RESEND_API_KEY is invalid, revoked or lacks Sending access. Create a key with Sending access at resend.com/api-keys and update the environment variable (and redeploy on Vercel)." };
  if (name.includes("rate_limit") || name.includes("quota") || err?.statusCode === 429)
    return { code: "rate_limited", hint: "Resend's rate limit or daily quota was hit (free plan: 100 emails/day). Wait a bit or upgrade the Resend plan." };
  if (name === "validation_error" || name === "invalid_parameter" || err?.statusCode === 422)
    return { code: "invalid_request", hint: "Resend rejected the request parameters — check EMAIL_FROM's format (\"Name <email@domain>\") and the recipient address." };
  return { code: "unknown", hint: "See the Resend message above, and the email log at resend.com/emails." };
}

export type EmailMessage = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string; tag?: string };

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const r = resend();
  if (!r) {
    if (!emailConsoleFallback()) {
      console.error(`[email] ✗ Not sent "${msg.subject}" → ${[msg.to].flat().join(", ")}: RESEND_API_KEY is not set. Add it to the environment variables (and redeploy on Vercel).`);
      return { sent: false, reason: "RESEND_API_KEY is not set", code: "not_configured", hint: "Add RESEND_API_KEY to .env.local (and to Vercel → Settings → Environment Variables), then restart / redeploy." };
    }
    console.log(`\n┌──────── Email not sent (RESEND_API_KEY is missing) ────────\n│ To: ${[msg.to].flat().join(", ")}${msg.replyTo ? `\n│ Reply-To: ${msg.replyTo}` : ""}\n│ Subject: ${msg.subject}\n│\n${msg.text.split("\n").map((l) => `│ ${l}`).join("\n")}\n└────────────────────────────────────────────────────────────\n`);
    return { sent: false, reason: "RESEND_API_KEY is not set", code: "not_configured", hint: "Add RESEND_API_KEY to .env.local (and to Vercel → Settings → Environment Variables), then restart / redeploy.", printed: true };
  }
  try {
    const { data, error } = await r.emails.send({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      ...(msg.tag ? { tags: [{ name: "category", value: msg.tag }] } : {}),
    });
    if (error || !data) {
      const { code, hint } = explainResendError(error as { name?: string; message?: string; statusCode?: number | null });
      console.error(`[email] ✗ Resend rejected "${msg.subject}" → ${[msg.to].flat().join(", ")} (from ${EMAIL_FROM})\n[email]   ${error?.name ?? "error"}: ${error?.message ?? "unknown error"}\n[email]   Fix: ${hint}`);
      return { sent: false, reason: error?.message ?? "unknown error", code, hint };
    }
    console.log(`[email] ✓ sent "${msg.subject}" → ${[msg.to].flat().join(", ")} (id ${data.id})`);
    return { sent: true, id: data.id };
  } catch (e) {
    console.error(`[email] ✗ Couldn't reach Resend for "${msg.subject}": ${(e as Error).message}`);
    return { sent: false, reason: (e as Error).message, code: "network", hint: "The server couldn't reach api.resend.com — check the internet connection / firewall and retry." };
  }
}

export const emailConfigured = () => !!apiKey();

/** Short, customer-safe description of a configuration problem (no raw Resend text — it can contain account details). */
export function emailProblemLabel(code: EmailErrorCode): string | null {
  switch (code) {
    case "invalid_api_key": return "email service key is invalid";
    case "domain_not_verified": return "sender domain isn't verified";
    case "not_configured": return "email service isn't configured";
    case "rate_limited": return "email sending limit reached";
    case "network": return "email service unreachable";
    default: return null; // recipient-specific problems are not described
  }
}
