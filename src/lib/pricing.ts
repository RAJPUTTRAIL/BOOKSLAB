// Shared (client + server) pricing rules — the server always recomputes totals.

export const FREE_DELIVERY_THRESHOLD = 999;
export const DELIVERY_FEE = 79;

/** Exam-kit pricing: buying several titles together as a kit earns a tiered discount. */
export const KIT_TIERS = [
  { min: 2, pct: 5, label: "Pair" },
  { min: 3, pct: 10, label: "Set of three" },
  { min: 5, pct: 15, label: "Full kit" },
  { min: 7, pct: 20, label: "Complete syllabus" },
] as const;

export function kitTier(count: number) {
  let tier: (typeof KIT_TIERS)[number] | null = null;
  for (const t of KIT_TIERS) if (count >= t.min) tier = t;
  const next = KIT_TIERS.find((t) => t.min > count) ?? null;
  return { tier, pct: tier?.pct ?? 0, next };
}

export type PriceLine = { price: number; quantity: number; kit?: boolean; digital?: boolean };

export function computeTotals(lines: PriceLine[], opts: { fulfillment: "DELIVERY" | "PICKUP"; paymentMethod?: string; codFee?: number }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const kitLines = lines.filter((l) => l.kit);
  const kitCount = kitLines.reduce((s, l) => s + l.quantity, 0);
  const kitValue = kitLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const { pct } = kitTier(kitCount);
  const bundleDiscount = Math.round((kitValue * pct) / 100);
  const afterBundle = subtotal - bundleDiscount;
  const allDigital = lines.length > 0 && lines.every((l) => l.digital);
  const deliveryFee =
    opts.fulfillment === "PICKUP" || allDigital || afterBundle >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const codFee = opts.paymentMethod === "COD" ? Math.max(0, Math.round(opts.codFee ?? 0)) : 0; // admin-set flat fee
  const total = Math.max(0, afterBundle + deliveryFee + codFee);
  return { subtotal, kitCount, kitPct: pct, bundleDiscount, deliveryFee, codFee, total };
}

/** Effective selling price considering an active weekly offer. */
export function effectivePrice(book: { mrp: number; price: number }, drop?: { discountPct: number; endsAt: Date | string; active?: boolean | null } | null) {
  if (drop && drop.active !== false && new Date(drop.endsAt).getTime() > Date.now()) {
    return Math.min(book.price, Math.round(book.mrp * (1 - drop.discountPct / 100)));
  }
  return book.price;
}
