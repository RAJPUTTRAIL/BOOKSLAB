import { connectDB } from "@/lib/mongo";
import { Book } from "@/lib/models";

/** Friendly setup hint when MongoDB is unreachable or the catalog hasn't been seeded. */
export async function DbNotice() {
  let problem: "down" | "empty" | null = null;
  try {
    await connectDB();
    if ((await Book.estimatedDocumentCount()) === 0) problem = "empty";
  } catch {
    problem = "down";
  }
  if (!problem) return null;
  return (
    <div className="container mt-4">
      <div className="alert alert-warning small mb-0">
        {problem === "down" ? (
          <><strong>Can&apos;t reach MongoDB.</strong> Check <code>MONGODB_URI</code> in <code>.env.local</code> and that the server (or Atlas cluster) is reachable, then reload.</>
        ) : (
          <><strong>The catalog is empty.</strong> Load the demo catalog with <code>npm run seed</code> or <code>curl -X POST http://localhost:3000/api/seed</code>.</>
        )}
      </div>
    </div>
  );
}
