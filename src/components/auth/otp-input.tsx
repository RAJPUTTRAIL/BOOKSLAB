"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Six auto-advancing digit boxes. Supports paste, Backspace and arrow keys. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean; autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const set = (next: string) => {
    const v = next.replace(/\D/g, "").slice(0, 6);
    onChange(v);
    if (v.length === 6) onComplete?.(v);
    return v;
  };

  return (
    <div className="d-flex gap-2 justify-content-center" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={cn("form-control otp-box", invalid && "is-invalid")}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            if (typed.length > 1) { const v = set(typed); refs.current[Math.min(5, v.length)]?.focus(); return; } // paste / autofill
            const next = (value.slice(0, i) + typed + value.slice(i + 1)).slice(0, 6);
            set(next);
            refs.current[Math.min(5, i + 1)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (digits[i]) set(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); const v = set(e.clipboardData.getData("text")); refs.current[Math.min(5, v.length)]?.focus(); }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
