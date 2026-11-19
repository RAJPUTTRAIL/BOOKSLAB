// Client-safe shape of the admin-editable payment settings.
import type { PaymentMethod } from "./constants";

export type PaymentSettings = {
  storeUpiId: string;
  storeUpiName: string;
  upiQrImage: string | null;
  enableUpi: boolean;
  enableCod: boolean;
  enablePayAtStore: boolean;
  enableCard: boolean;
  codFee: number;
  updatedAt: string | null;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  storeUpiId: "bookslab@icici", storeUpiName: "Bookslab Connaught Place", upiQrImage: null,
  enableUpi: true, enableCod: true, enablePayAtStore: true, enableCard: true, codFee: 0, updatedAt: null,
};

export const isEnabled = (s: PaymentSettings, m: PaymentMethod) =>
  m === "UPI" ? s.enableUpi : m === "COD" ? s.enableCod : m === "PAY_AT_STORE" ? s.enablePayAtStore : s.enableCard;

/** Methods offered for a given way of fulfilling the order, in display order. */
export function methodsFor(s: PaymentSettings, ctx: { pickup: boolean; allDigital: boolean }): PaymentMethod[] {
  const all: PaymentMethod[] = ["UPI", ...(ctx.pickup || ctx.allDigital ? [] : (["COD"] as const)), ...(ctx.pickup ? (["PAY_AT_STORE"] as const) : []), "CARD"];
  return all.filter((m) => isEnabled(s, m));
}
