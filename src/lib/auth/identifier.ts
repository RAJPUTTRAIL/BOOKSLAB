/** Accepts an email or an Indian mobile number and normalises it. */
export function parseIdentifier(raw: string): { email: string } | { phone: string } | null {
  const v = raw.trim();
  if (v.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { email: v.toLowerCase() } : null;
  }
  const digits = v.replace(/[\s-]/g, "").replace(/^\+91/, "").replace(/^0/, "");
  return /^[6-9]\d{9}$/.test(digits) ? { phone: `+91${digits}` } : null;
}

export const displayIdentifier = (u: { email?: string | null; phone?: string | null }) => u.email ?? u.phone ?? "";
