import { z } from "zod";

/** One password rule for sign-up, reset and change-password. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "That password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");
