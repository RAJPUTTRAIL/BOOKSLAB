import "server-only";
import { connectDB } from "@/lib/mongo";
import { StoreSettings } from "@/lib/models";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "@/lib/payment-settings";

type Raw = Partial<Omit<PaymentSettings, "updatedAt">> & { updatedAt?: Date };

/** Current payment settings (defaults until the admin saves). Never throws for a missing document. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  await connectDB();
  const d = await StoreSettings.findById("payments").lean<Raw>();
  if (!d) return { ...DEFAULT_PAYMENT_SETTINGS };
  return {
    storeUpiId: d.storeUpiId ?? DEFAULT_PAYMENT_SETTINGS.storeUpiId,
    storeUpiName: d.storeUpiName ?? DEFAULT_PAYMENT_SETTINGS.storeUpiName,
    upiQrImage: d.upiQrImage ?? null,
    enableUpi: d.enableUpi ?? true,
    enableCod: d.enableCod ?? true,
    enablePayAtStore: d.enablePayAtStore ?? true,
    enableCard: d.enableCard ?? true,
    codFee: d.codFee ?? 0,
    updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
  };
}
