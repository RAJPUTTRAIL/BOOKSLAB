import "server-only";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth/session";
import { DbUnavailableError } from "@/lib/mongo";

const isDuplicateKey = (e: unknown): e is { code: number; keyValue?: Record<string, unknown> } =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === 11000;

/** Wrap a route handler with consistent JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      if (isDuplicateKey(e)) {
        const field = Object.keys(e.keyValue ?? {})[0];
        return NextResponse.json({ error: field ? `Another record already uses this ${field}.` : "That record already exists." }, { status: 409 });
      }
      if (e instanceof mongoose.Error.ValidationError) return NextResponse.json({ error: Object.values(e.errors)[0]?.message ?? "Invalid data" }, { status: 400 });
      if (e instanceof mongoose.Error.CastError) return NextResponse.json({ error: "Record not found." }, { status: 404 });
      if (e instanceof DbUnavailableError || e instanceof mongoose.Error.MongooseServerSelectionError) {
        console.error(e);
        return NextResponse.json({ error: "Database unavailable — check MONGODB_URI in .env.local and that MongoDB is reachable." }, { status: 503 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
