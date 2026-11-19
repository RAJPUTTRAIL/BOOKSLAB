"use client";

import { useEffect, useState } from "react";

export function Countdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (s === 0) return <span className={className}>Ended</span>;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className={`tabular ${className ?? ""}`}>{d > 0 ? `${d}d ` : ""}{pad(h)}:{pad(m)}:{pad(sec)}</span>;
}
