import "server-only";
import mongoose from "mongoose";

/**
 * One cached Mongoose connection per server process (survives Next.js hot reloads in dev).
 * Every model call goes through `connectDB()` first.
 */
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongoose?: Cache };
const cache: Cache = (g._mongoose ??= { conn: null, promise: null });

export class DbUnavailableError extends Error {}

export async function connectDB() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new DbUnavailableError("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
  cache.promise ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000, bufferCommands: false })
    .catch((e) => {
      cache.promise = null; // allow a retry on the next request
      throw new DbUnavailableError(`Can't reach MongoDB: ${(e as Error).message}`);
    });
  cache.conn = await cache.promise;
  return cache.conn;
}
