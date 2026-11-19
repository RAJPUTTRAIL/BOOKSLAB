"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: "bi-bar-chart" },
  { href: "/admin/catalog", label: "Catalog & inventory", icon: "bi-journal-bookmark" },
  { href: "/admin/orders", label: "Orders & payments", icon: "bi-box-seam" },
  { href: "/admin/returns", label: "Returns & Replacements", icon: "bi-arrow-repeat" },
  { href: "/admin/book-requests", label: "Book Requests", icon: "bi-journal-plus" },
  { href: "/admin/payments", label: "Payment settings", icon: "bi-credit-card-2-front" },
  { href: "/admin/cms", label: "Homepage content", icon: "bi-layout-text-window" },
  { href: "/admin/users", label: "Users & sign-ins", icon: "bi-people" },
];

export function AdminNav({ returnsPending = 0, requestsNew = 0 }: { returnsPending?: number; requestsNew?: number }) {
  const pathname = usePathname();
  return (
    <ul className="nav nav-pills flex-lg-column flex-nowrap scroll-x gap-1">
      {NAV.map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        return (
          <li className="nav-item" key={n.href}>
            <Link href={n.href} className={cn("nav-link text-nowrap", active ? "active" : "link-body-emphasis")} aria-current={active ? "page" : undefined}>
              <i className={`bi ${n.icon} me-2`} />{n.label}
              {n.href === "/admin/returns" && returnsPending > 0 && <span className="badge rounded-pill text-bg-warning ms-2" aria-label={`${returnsPending} pending`} data-returns-badge>{returnsPending}</span>}
              {n.href === "/admin/book-requests" && requestsNew > 0 && <span className="badge rounded-pill text-bg-warning ms-2" aria-label={`${requestsNew} new`} data-requests-badge>{requestsNew}</span>}
            </Link>
          </li>
        );
      })}
      <li className="nav-item mt-lg-3"><Link href="/" className="nav-link text-muted text-nowrap"><i className="bi bi-box-arrow-up-right me-2" />View store</Link></li>
    </ul>
  );
}
