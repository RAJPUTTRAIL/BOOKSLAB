"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref: callers often pass an inline function, and re-running the
  // effect on every render would steal focus from the field being typed in.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("[autofocus], input:not([type=hidden]), button:not(.btn-close), [href]");
      el?.focus();
    }, 30);
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);
  return ref;
}

/** Bootstrap 5 modal markup, controlled by React state (no Bootstrap JS required). */
export function Modal({ open, onClose, title, children, footer, size, centered = true, scrollable }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "lg" | "xl"; centered?: boolean; scrollable?: boolean;
}) {
  const ref = useOverlay(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} className={cn("modal-dialog", centered && "modal-dialog-centered", scrollable && "modal-dialog-scrollable", size && `modal-${size}`, "modal-fullscreen-sm-down")}>
          <div className="modal-content border-0 shadow">
            {title && (
              <div className="modal-header border-0 pb-0">
                <h2 className="modal-title fs-5" id={id}>{title}</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer border-0 pt-0">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ opacity: 0.35 }} />
    </>
  );
}

/** Bootstrap 5 offcanvas (drawer), controlled by React state. */
export function Offcanvas({ open, onClose, title, children, footer, placement = "end" }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; placement?: "end" | "bottom";
}) {
  const ref = useOverlay(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <>
      <div ref={ref} className={cn("offcanvas show border-0 shadow", `offcanvas-${placement}`)} style={{ visibility: "visible", ...(placement === "bottom" ? { height: "auto", maxHeight: "92vh" } : { width: "min(420px, 100vw)" }) }} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="offcanvas-header border-bottom">
          <h2 className="offcanvas-title fs-5" id={id}>{title}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="offcanvas-body p-0">{children}</div>
        {footer && <div className="border-top p-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
      <div className="offcanvas-backdrop fade show" style={{ opacity: 0.3 }} onClick={onClose} />
    </>
  );
}
