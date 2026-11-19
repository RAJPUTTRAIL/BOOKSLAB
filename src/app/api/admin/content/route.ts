import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongo";
import { Book, SiteContent } from "@/lib/models";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";

const hero = z.object({
  eyebrow: z.string(), headline: z.string().min(3), subhead: z.string().min(3), highlights: z.array(z.string().min(1)).max(5),
  bundleTitle: z.string().min(3), bundleSubtitle: z.string().min(3), bundleBookSlugs: z.array(z.string()),
});
const showcase = z.object({
  bookSlug: z.string().min(1), eyebrow: z.string(), headline: z.string().min(3), tagline: z.string().min(3),
  callouts: z.array(z.object({ title: z.string().min(1), body: z.string().min(1), stat: z.string() })).min(1).max(6),
  hotspots: z.array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), title: z.string(), body: z.string() })).max(6),
  editions: z.array(z.object({ name: z.string().min(1), features: z.array(z.string()), addonSlugs: z.array(z.string()), highlight: z.boolean().optional() })).min(1).max(3),
});
const banner = z.object({ active: z.boolean(), text: z.string().min(3), code: z.string(), cta: z.string(), href: z.string().startsWith("/") });

const schema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("HERO"), value: hero }),
  z.object({ key: z.literal("SHOWCASE"), value: showcase }),
  z.object({ key: z.literal("BANNER"), value: banner }),
]);

export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  const { key, value } = schema.parse(await req.json());
  await connectDB();
  if (key === "SHOWCASE" && !(await Book.exists({ slug: value.bookSlug }))) return NextResponse.json({ error: "Showcase book not found." }, { status: 400 });
  await SiteContent.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
  return NextResponse.json({ ok: true });
});
