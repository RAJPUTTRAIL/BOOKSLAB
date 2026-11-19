// Send real test emails through Resend and print exactly what Resend says.
//   npm run email:test -- you@example.com [verify|welcome|reset]   (default: all three)
// Tip: delivered@resend.dev is Resend's safe test inbox (always accepts, reaches no one).
import { existsSync, readFileSync } from "fs";
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Usage: npm run email:test -- you@example.com");
    process.exit(1);
  }
  const { sendEmail, EMAIL_FROM, emailConfigured } = await import("../src/lib/email");
  const { welcomeEmail, resetCodeEmail, verifyEmailCode } = await import("../src/lib/email-templates");
  const only = process.argv[3];
  console.log(`From:        ${EMAIL_FROM}`);
  console.log(`To:          ${to}`);
  console.log(`API key:     ${emailConfigured() ? "set" : "MISSING (emails will only be printed)"}`);
  if (EMAIL_FROM.includes("onboarding@resend.dev")) console.log("Note:        onboarding@resend.dev only delivers to your own Resend account email.");
  console.log("");
  let failed = 0;
  const all = [
    ["verify", "Sign-up verification code", verifyEmailCode({ name: "Bookslab Test", code: "482913", ttlMinutes: 10 })],
    ["welcome", "Welcome (after verification)", welcomeEmail({ name: "Bookslab Test", email: to, phone: null, createdAt: new Date() })],
    ["reset", "Password reset", resetCodeEmail({ name: "Bookslab Test", code: "TEST42", ttlMinutes: 15 })],
  ] as const;
  for (const [, label, msg] of all.filter(([k]) => !only || k === only)) {
    const r = await sendEmail({ to, tag: "test", ...msg });
    if (r.sent) console.log(`✓ ${label}: accepted by Resend (id ${r.id})`);
    else { failed++; console.log(`✗ ${label}: ${r.reason}\n  code: ${r.code}\n  fix:  ${r.hint}`); }
  }
  console.log(failed ? "\nSome emails were not sent — see the fix above." : "\nDone. Check the inbox (and Spam / Promotions for a new sending domain).\nDelivery status per email: https://resend.com/emails");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
