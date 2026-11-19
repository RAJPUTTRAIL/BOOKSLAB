// Client-safe contact-form schema and response types (shared by /api/contact and the /contact form).
import { z } from "zod";
import { CONTACT_TOPICS } from "./constants";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address so we can reply"),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, "").replace(/^0/, ""))
    .refine((s) => s === "" || /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit mobile number (or leave it empty)")
    .transform((s) => (s ? `+91${s}` : ""))
    .default(""),
  topic: z.enum(CONTACT_TOPICS),
  orderNumber: z.string().trim().max(40).regex(/^[A-Za-z0-9-]*$/, "Order numbers look like BL-CP-1051-26").default(""),
  message: z.string().trim().min(10, "Please write a little more (at least 10 characters)").max(2000, "Please keep it under 2,000 characters"),
  website: z.string().max(0, "Something went wrong. Please try again.").optional(), // honeypot
});
export type ContactInput = z.input<typeof contactSchema>;

export type ContactResponse = { ok: true; id: string; emailed: boolean } | { error: string };

