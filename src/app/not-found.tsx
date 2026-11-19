import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
      <div className="display-4 fw-bold text-muted">404</div>
      <h1 className="h4 mt-2">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have moved, or the link might be out of date.</p>
      <div className="d-flex justify-content-center gap-2">
        <Link href="/" className="btn btn-primary">Go to the homepage</Link>
        <Link href="/search" className="btn btn-light border">Browse books</Link>
      </div>
    </div>
  );
}
