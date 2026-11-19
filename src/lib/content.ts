import "server-only";
import { connectDB } from "@/lib/mongo";
import { SiteContent } from "@/lib/models";

export type HeroContent = {
  eyebrow: string;
  headline: string;
  subhead: string;
  highlights: string[]; // calm "what's new" lines
  bundleTitle: string;
  bundleSubtitle: string;
  bundleBookSlugs: string[];
};

export type ShowcaseContent = {
  bookSlug: string;
  eyebrow: string;
  headline: string;
  tagline: string;
  callouts: { title: string; body: string; stat: string }[];
  hotspots: { x: number; y: number; title: string; body: string }[];
  editions: { name: string; features: string[]; addonSlugs: string[]; highlight?: boolean }[];
};

export type BannerContent = { active: boolean; text: string; code: string; cta: string; href: string };

export const DEFAULT_HERO: HeroContent = {
  eyebrow: "Connaught Place, New Delhi",
  headline: "Books for serious study, chosen with care.",
  subhead: "A curated Connaught Place collection of law, finance & tax, academic and technology titles — current editions, carefully indexed, ready to collect from our Inner Circle store or delivered across Delhi NCR.",
  highlights: [
    "BNS, BNSS & BSA bare acts with old-law concordance — in stock at CP",
    "Income-tax Act, 2025 editions now available",
    "Same-day delivery for central Delhi pincodes",
  ],
  bundleTitle: "Criminal Law Starter Set",
  bundleSubtitle: "BNS + BNSS + BSA bare acts, priced as a kit",
  bundleBookSlugs: [],
};

export const DEFAULT_SHOWCASE: ShowcaseContent = {
  bookSlug: "ultimate-legal-tax-compendium-2026",
  eyebrow: "Flagship edition · 2026",
  headline: "The Legal & Tax Compendium",
  tagline: "Every major statute in one carefully indexed volume.",
  callouts: [
    { title: "Paper that respects your highlighter", body: "70 GSM maplitho stock — thin, opaque, and free of bleed-through across 1,840 pages.", stat: "70 GSM" },
    { title: "Companion notes", body: "Section marks link to short explainers and 2026 amendments in the Bookslab app.", stat: "3,200+ notes" },
    { title: "Exam-ready indexing", body: "Colour-coded thumb tabs, IPC → BNS concordance and a 48-page revision index.", stat: "48 pp index" },
    { title: "Collect it today", body: "Ready at our Connaught Place counter within two hours of ordering.", stat: "2 hrs" },
  ],
  hotspots: [
    { x: 22, y: 20, title: "Thumb tabs", body: "Twelve tabs: GST, Income Tax, Customs, Companies, BNS, BNSS, BSA and more." },
    { x: 68, y: 48, title: "Section marks", body: "Each mark opens a short explainer in the Bookslab app." },
    { x: 40, y: 78, title: "Lay-flat binding", body: "Smyth-sewn so it stays open on your desk." },
  ],
  editions: [
    { name: "Standard", addonSlugs: [], features: ["Full text with 2026 amendments", "Old → new law concordance", "Companion notes", "Free CP pickup"] },
    { name: "Pro", addonSlugs: ["bookslab-pro-reader-pass-2026"], highlight: true, features: ["Everything in Standard", "12-month Bookslab Pro Reader Pass", "Monthly amendment updates", "Kit pricing on the pair"] },
  ],
};

export const DEFAULT_BANNER: BannerContent = { active: true, text: "Exam season: kit pricing on CA / CS / CMA and judiciary sets", code: "", cta: "Build a kit", href: "/#kit-builder" };

export async function getContent() {
  await connectDB();
  const rows = await SiteContent.find({ _id: { $in: ["HERO", "SHOWCASE", "BANNER"] } }).lean<{ _id: string; value: unknown }[]>();
  const get = (k: string) => {
    const v = rows.find((r) => r._id === k)?.value;
    return (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  };
  return {
    hero: { ...DEFAULT_HERO, ...get("HERO") } as HeroContent,
    showcase: { ...DEFAULT_SHOWCASE, ...get("SHOWCASE") } as ShowcaseContent,
    banner: { ...DEFAULT_BANNER, ...get("BANNER") } as BannerContent,
  };
}
