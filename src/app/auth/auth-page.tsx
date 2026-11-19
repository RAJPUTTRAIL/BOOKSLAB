"use client";

import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Wordmark } from "@/components/header";

/** Full-page fallback for the sign-in flow (used when middleware redirects a signed-out visitor). */
export function AuthPage({ next, initialTab }: { next: string | null; initialTab: "signup" | "signin" }) {
  return (
    <div className="min-vh-100 d-flex flex-column">
      <div className="container py-3 d-flex justify-content-between align-items-center">
        <Wordmark />
        <Link href="/" className="small link-secondary"><i className="bi bi-arrow-left me-1" />Back to the store</Link>
      </div>
      <div className="container flex-grow-1 d-flex align-items-center py-4">
        <div className="row w-100 justify-content-center g-0">
          <div className="col-md-8 col-lg-5">
            <div className="card rounded-4 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <h1 className="h4 mb-1">Your Bookslab account</h1>
                <AuthForm initialTab={initialTab} onDone={(r) => window.location.assign(next ?? (r.role === "admin" ? "/admin" : "/account"))} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
