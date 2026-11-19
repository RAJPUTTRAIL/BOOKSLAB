"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TABS } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Understated pill tabs (search verticals). */
export function CategoryTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onSearch = pathname === "/search";
  const active = onSearch ? params.get("c") ?? "all" : null;
  const href = (key: string) => {
    const p = new URLSearchParams(onSearch ? params.toString() : "");
    if (key === "all") p.delete("c"); else p.set("c", key);
    p.delete("sort");
    p.set("log", "1");
    return `/search?${p.toString()}`;
  };
  return (
    <nav aria-label="Browse by category" className={cn("scroll-x", className)}>
      <ul className="nav nav-pills pill-tabs flex-nowrap gap-1">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <Link href={href(t.key)} scroll={!onSearch} className={cn("nav-link", active === t.key && "active")} aria-current={active === t.key ? "page" : undefined}>
              {t.key === "pickup" && <i className="bi bi-shop me-1" />}{t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
