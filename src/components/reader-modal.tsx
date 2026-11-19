"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatINR } from "@/lib/utils";
import { Modal } from "./ui/overlay";
import { useApp } from "./providers";

type Mode = "light" | "sepia" | "dark";
type HL = { page: number; text: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Highlighted({ text, marks }: { text: string; marks: string[] }) {
  if (!marks.length) return <>{text}</>;
  const re = new RegExp(`(${marks.map(escapeRe).join("|")})`, "g");
  return <>{text.split(re).map((p, i) => (marks.includes(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

function PageBody({ src, marks }: { src: string; marks: string[] }) {
  return (
    <>
      {src.split("```").flatMap((seg, si) =>
        si % 2 === 1
          ? [<pre key={`c${si}`} className="bg-body-tertiary p-3 rounded small">{seg.trim()}</pre>]
          : seg.split(/\n{2,}/).filter((b) => b.trim()).map((b, i) =>
              b.startsWith("## ")
                ? <h3 key={`${si}-${i}`} className="h4 mb-3" style={{ color: "inherit" }}><Highlighted text={b.slice(3)} marks={marks} /></h3>
                : <p key={`${si}-${i}`} style={{ whiteSpace: "pre-line" }}><Highlighted text={b} marks={marks} /></p>,
            ),
      )}
    </>
  );
}

export function ReaderModal() {
  const { reader, openReader, addToCart } = useApp();
  const [pages, setPages] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>("light");
  const [size, setSize] = useState(17);
  const [hl, setHl] = useState<HL[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => openReader(null), [openReader]);

  useEffect(() => {
    if (!reader) return;
    setPage(0);
    setPages([]);
    setSel(null);
    fetch(`/api/books/${reader.slug}/preview`).then((r) => r.json()).then((d) => { setPages(d.pages ?? []); setImages(d.images ?? []); }).catch(() => {});
    try {
      setHl(JSON.parse(localStorage.getItem(`bl_hl_${reader.slug}`) ?? "[]"));
      const m = localStorage.getItem("bl_reader_mode") as Mode | null;
      if (m) setMode(m);
    } catch {}
  }, [reader]);

  const persist = (next: HL[]) => {
    setHl(next);
    try { if (reader) localStorage.setItem(`bl_hl_${reader.slug}`, JSON.stringify(next)); } catch {}
  };
  const total = pages.length + images.length;
  const go = (d: number) => { setSel(null); setPage((p) => Math.max(0, Math.min(total - 1, p + d))); };

  useEffect(() => {
    if (!reader) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onSelect = () => {
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    setSel(text.length >= 2 && bodyRef.current?.contains(s?.anchorNode ?? null) ? text.slice(0, 300) : null);
  };
  const marks = hl.filter((h) => h.page === page).map((h) => h.text);
  const isImage = page >= pages.length;

  return (
    <Modal
      open={!!reader}
      onClose={close}
      size="lg"
      title={<>Look inside <span className="text-muted fw-normal">· {reader?.title}</span></>}
      footer={reader && (
        <div className="d-flex w-100 align-items-center justify-content-between">
          <span><span className="price">{formatINR(reader.price)}</span>{reader.mrp > reader.price && <span className="mrp ms-2">{formatINR(reader.mrp)}</span>}</span>
          <button type="button" className="btn btn-primary" onClick={() => { addToCart(reader); close(); }}>Add to cart</button>
        </div>
      )}
    >
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="btn-group btn-group-sm" role="group" aria-label="Reading mode">
          {(["light", "sepia", "dark"] as const).map((m) => (
            <button key={m} type="button" className={cn("btn btn-outline-primary text-capitalize", mode === m && "active")} onClick={() => { setMode(m); try { localStorage.setItem("bl_reader_mode", m); } catch {} }}>{m}</button>
          ))}
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Text size">
          <button type="button" className="btn btn-light" onClick={() => setSize((s) => Math.max(14, s - 1))} aria-label="Smaller text">A−</button>
          <button type="button" className="btn btn-light" onClick={() => setSize((s) => Math.min(24, s + 1))} aria-label="Larger text">A+</button>
        </div>
        <span className="small text-muted ms-auto"><i className="bi bi-highlighter me-1" />Select text to highlight · {hl.length} saved</span>
        {hl.length > 0 && <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => persist([])}>Clear</button>}
      </div>

      <div ref={bodyRef} onMouseUp={onSelect} onTouchEnd={() => setTimeout(onSelect, 50)} className={cn("reader-page", `reader-${mode}`)} style={{ fontSize: size }}>
        {total === 0 ? <p className="text-muted mb-0">Loading preview…</p> : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[page - pages.length]} alt={`${reader?.title} — preview image`} className="d-block mx-auto rounded" style={{ maxHeight: "60vh", maxWidth: "100%" }} />
        ) : <PageBody src={pages[page]} marks={marks} />}
      </div>

      {sel && !isImage && (
        <div className="d-flex align-items-center gap-2 mt-2 small">
          <span className="text-muted text-truncate">“{sel}”</span>
          <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onMouseDown={(e) => e.preventDefault()} onClick={() => { persist([...hl, { page, text: sel }]); window.getSelection()?.removeAllRanges(); setSel(null); }}>
            <i className="bi bi-highlighter me-1" />Highlight
          </button>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mt-3">
        <button type="button" className="btn btn-light" disabled={page === 0} onClick={() => go(-1)}><i className="bi bi-chevron-left" /> Previous</button>
        <span className="small text-muted tabular">{total ? `${page + 1} of ${total}` : ""}</span>
        <button type="button" className="btn btn-light" disabled={page >= total - 1} onClick={() => go(1)}>Next <i className="bi bi-chevron-right" /></button>
      </div>
    </Modal>
  );
}
