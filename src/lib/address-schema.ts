import { z } from "zod";
import { ADDRESS_LABELS } from "./constants";

/** Client-safe address shape + validation (used by the API and the address modal). */
export type Address = {
  id: string;
  label: (typeof ADDRESS_LABELS)[number];
  recipientName: string;
  phone: string; // +91XXXXXXXXXX
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export const NCR_STATES = ["Delhi", "Uttar Pradesh", "Haryana"] as const;
export const NCR_CITIES = ["New Delhi", "Delhi", "Noida", "Greater Noida", "Gurugram", "Ghaziabad", "Faridabad"] as const;

export const addressInput = z.object({
  label: z.enum(ADDRESS_LABELS).default("Home"),
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, "").replace(/^0/, ""))
    .refine((s) => /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit mobile number")
    .transform((s) => `+91${s}`),
  street: z.string().trim().min(8, "Enter the full street address (house / flat, street, area)").max(200),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressInput>;

export const formatAddress = (a: Pick<Address, "street" | "city" | "state" | "pincode">) => `${a.street}, ${a.city}, ${a.state} ${a.pincode}`;
