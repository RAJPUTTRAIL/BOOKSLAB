import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { SearchEvent } from "@/lib/models";
import { handle } from "@/lib/api";
import { searchBooks } from "@/lib/catalog";
import { isFilterKey } from "@/lib/categories";

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const c = url.searchParams.get("c");
  const key = isFilterKey(c) ? c : "all";
  const results = await searchBooks(q, key);
  if (url.searchParams.get("log") === "1") await connectDB().then(() => SearchEvent.create({ category: key, query: q.toLowerCase() })).catch(() => {});
  return NextResponse.json({ results, c: key, q });
});
