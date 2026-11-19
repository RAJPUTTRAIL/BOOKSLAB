// CLI seed: `npm run seed` (reads MONGODB_URI from .env.local / .env)
import { existsSync, readFileSync } from "fs";
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { seedDatabase } = await import("../src/lib/seed");
  const mongoose = (await import("mongoose")).default;
  console.log("🌱 Seeding Bookslab (Connaught Place)…");
  const r = await seedDatabase();
  console.log(`✅ ${r.books} books, ${r.users} users, ${r.orders} orders. Covers written to public/uploads/books/`);
  console.log("   Admin:    admin@bookslab.in / Admin@2026");
  console.log("   Customer: riya@student.du.ac.in / Student@2026");
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
