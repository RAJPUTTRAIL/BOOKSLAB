"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm"><i className="bi bi-printer me-1" />Print / Save as PDF</button>;
}
