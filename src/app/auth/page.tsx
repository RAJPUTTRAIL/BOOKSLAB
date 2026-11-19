import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthPage } from "./auth-page";

export const metadata = { title: "Sign in or create an account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const s = await getSession();
  const { next, mode } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (s) redirect(safeNext ?? "/account");
  return <AuthPage next={safeNext} initialTab={mode === "signup" ? "signup" : "signin"} />;
}
