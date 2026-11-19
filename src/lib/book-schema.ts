import { z } from "zod";
import { BOOK_CATEGORIES, BOOK_FORMATS } from "./constants";

const imageRef = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\/uploads\/books\/[\w.-]+$/.test(s) || /^https:\/\/[^\s]+$/i.test(s), "Image must be an uploaded file or an https:// URL");

export const bookInput = z
  .object({
    title: z.string().trim().min(2, "Title is required"),
    subtitle: z.string().trim().default(""),
    author: z.string().trim().min(2, "Author is required"),
    publisher: z.string().trim().min(2, "Publisher is required"),
    isbn: z.string().transform((s) => s.replace(/[-\s]/g, "")).refine((s) => /^\d{13}$/.test(s), "ISBN must be 13 digits"),
    category: z.enum(BOOK_CATEGORIES),
    subcategory: z.string().trim().default(""),
    format: z.enum(BOOK_FORMATS),
    mrp: z.coerce.number().int().positive("MRP must be positive"),
    discountedPrice: z.coerce.number().int().positive("Price must be positive"),
    edition: z.string().trim().min(1, "Edition is required"),
    year: z.coerce.number().int().min(1950).max(2100),
    pages: z.coerce.number().int().min(0),
    stock: z.coerce.number().int().min(0),
    description: z.string().trim().min(10, "Description should be at least 10 characters"),
    coverImage: imageRef,
    galleryImages: z.array(imageRef).max(6).default([]),
    tags: z.array(z.string()).default([]),
    isFeatured: z.boolean().default(false),
    cpPickup: z.boolean().default(true),
  })
  .refine((b) => b.discountedPrice <= b.mrp, { message: "Discounted price can't exceed MRP", path: ["discountedPrice"] });

export type BookInput = z.infer<typeof bookInput>;
