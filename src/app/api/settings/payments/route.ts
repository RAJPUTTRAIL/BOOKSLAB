import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { StoreSettings } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getPaymentSettings } from "@/lib/store-settings";
import { removeSettingsImage } from "@/lib/uploads";
import { UPI_ID } from "@/lib/upi";
import { logSecurity } from "@/lib/security-log";

/** Public: checkout reads which methods are on, the COD fee and the store's UPI details. */
export const GET = handle(async () => {
  return NextResponse.json({ settings: await getPaymentSettings() }, { headers: { "Cache-Control": "no-store" } });
});

const schema = z
  .object({
    storeUpiId: z.string().trim().toLowerCase().regex(UPI_ID, "Enter a valid UPI ID, like bookslab@hdfcbank"),
    storeUpiName: z.string().trim().min(2, "Enter the merchant display name").max(60),
    upiQrImage: z.string().regex(/^\/uploads\/settings\/[\w-]+\.(jpe?g|png|webp|avif)$/i).nullable(),
    enableUpi: z.boolean(),
    enableCod: z.boolean(),
    enablePayAtStore: z.boolean(),
    enableCard: z.boolean(),
    codFee: z.coerce.number().int("Use whole rupees").min(0, "The COD fee can't be negative").max(500, "Keep the COD fee at ₹500 or less"),
  })
  .refine((s) => s.enableUpi || s.enableCard || s.enableCod, { message: "Keep at least one payment method on for Home Delivery (UPI, Card or COD).", path: ["enableCod"] })
  .refine((s) => s.enableUpi || s.enableCard || s.enablePayAtStore, { message: "Keep at least one payment method on for CP Store Pickup (UPI, Card or Pay at Store).", path: ["enablePayAtStore"] });

/** Admin only: save payment settings. Takes effect on the next checkout page load. */
export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const body = schema.parse(await req.json());
  const before = await getPaymentSettings();
  await connectDB();
  await StoreSettings.updateOne({ _id: "payments" }, { $set: { ...body, updatedBy: admin.email ?? admin.phone } }, { upsert: true });
  if (before.upiQrImage && before.upiQrImage !== body.upiQrImage) await removeSettingsImage(before.upiQrImage);
  const changes = (Object.keys(body) as (keyof typeof body)[]).filter((k) => String(before[k]) !== String(body[k]));
  if (changes.length) await logSecurity("PAYMENT_SETTINGS_UPDATED", { userId: admin.id, identifier: admin.email ?? admin.phone, detail: `Changed: ${changes.join(", ")}` });
  return NextResponse.json({ ok: true, settings: await getPaymentSettings() });
});
