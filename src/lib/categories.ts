import type { BOOK_CATEGORIES } from "./constants";

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

/** URL-safe keys for each category (used in ?c= on /search). */
export const CATEGORIES = [
  { key: "law", label: "Law & Legal", value: "Law", blurb: "Bare Acts, commentaries, judiciary & AIBE preparation." },
  { key: "finance", label: "Finance & Tax", value: "Finance & Tax", blurb: "GST, Income Tax, Companies Act, audit and accounting." },
  { key: "academic", label: "Academic", value: "Academic", blurb: "CA / CS / CMA modules, university texts and exam guides." },
  { key: "tech", label: "Tech & AI", value: "Tech & Management", blurb: "AI, data, systems and management — plus digital editions." },
  { key: "general", label: "General", value: "General", blurb: "Reference, writing and reading for the curious professional." },
] as const;

/** Header pill tabs (search verticals). "General" is browsable under All. */
export const TABS = [
  { key: "all", label: "All" },
  { key: "law", label: "Law & Legal" },
  { key: "finance", label: "Finance & Tax" },
  { key: "academic", label: "Academic" },
  { key: "tech", label: "Tech & AI" },
  { key: "pickup", label: "CP Store Pickup" },
] as const;

export const FILTER_KEYS = ["all", "law", "finance", "academic", "tech", "general", "pickup"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const isFilterKey = (k: string | null | undefined): k is FilterKey => !!k && (FILTER_KEYS as readonly string[]).includes(k);
export const categoryByKey = (k: string) => CATEGORIES.find((c) => c.key === k);
export const categoryByValue = (v: string) => CATEGORIES.find((c) => c.value === v);
export const filterLabel = (k: FilterKey) =>
  k === "all" ? "All books" : k === "pickup" ? "CP Store Pickup" : categoryByKey(k)?.label ?? "All books";
