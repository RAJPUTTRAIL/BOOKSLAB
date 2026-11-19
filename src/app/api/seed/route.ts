import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { seedDatabase } from "@/lib/seed";

/**
 * POST /api/seed — wipes and repopulates the database with the demo catalog.
 * Allowed freely in development; in production only with header `x-seed-token: $SEED_TOKEN`.
 */
export const POST = handle(async (req: Request) => {
  const token = process.env.SEED_TOKEN;
  const allowed = process.env.NODE_ENV !== "production" || (!!token && req.headers.get("x-seed-token") === token);
  if (!allowed) return NextResponse.json({ error: "Seeding is disabled in production without a valid x-seed-token." }, { status: 403 });
  const result = await seedDatabase();
  return NextResponse.json({ ok: true, ...result, logins: { admin: "admin@bookslab.in / Admin@2026", customer: "riya@student.du.ac.in / Student@2026" } });
});

export const GET = () =>
  NextResponse.json({ info: "Send a POST request to seed: curl -X POST http://localhost:3000/api/seed" }, { status: 405, headers: { Allow: "POST" } });
