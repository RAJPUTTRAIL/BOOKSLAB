"use client";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-5 text-center" style={{ maxWidth: 560 }}>
      <i className="bi bi-cloud-slash fs-1 text-muted" />
      <h1 className="h4 mt-3">We couldn&apos;t load this page</h1>
      <p className="text-muted">This usually means MongoDB isn&apos;t reachable. Check <code>MONGODB_URI</code> in <code>.env.local</code>, then try again.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
