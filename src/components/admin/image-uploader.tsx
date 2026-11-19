"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

async function upload(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.urls as string[];
}

/** Drag-and-drop / file-picker image upload with an image-URL fallback and live previews. */
export function ImageUploader({ label, hint, value, onChange, multiple, max = 1 }: {
  label: string; hint?: string; value: string[]; onChange: (urls: string[]) => void; multiple?: boolean; max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<string[]>([]); // local object-URL previews while uploading

  const handleFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return setError("Please choose JPG, PNG, WebP or AVIF images.");
    const room = multiple ? Math.max(0, max - value.length) : 1;
    const chosen = files.slice(0, room || 1);
    const previews = chosen.map((f) => URL.createObjectURL(f));
    setPending(previews);
    setBusy(true);
    setError("");
    try {
      const urls = await upload(chosen);
      onChange(multiple ? [...value, ...urls].slice(0, max) : urls.slice(0, 1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      previews.forEach((p) => URL.revokeObjectURL(p));
      setPending([]);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addUrl = () => {
    const v = url.trim();
    if (!/^https:\/\/\S+$/i.test(v)) return setError("Enter an image URL that starts with https://");
    setError("");
    onChange(multiple ? [...value, v].slice(0, max) : [v]);
    setUrl("");
  };

  const shown = [...value, ...pending];
  const canAdd = multiple ? value.length < max : true;

  return (
    <div>
      <div className="form-label">{label}</div>
      {shown.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {shown.map((src, i) => {
            const isPending = i >= value.length;
            return (
              <div key={src + i} className="position-relative" style={{ width: multiple ? 72 : 120 }}>
                <div className="book-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={isPending ? "Uploading preview" : `${label} preview`} style={{ opacity: isPending ? 0.5 : 1 }} />
                </div>
                {isPending ? (
                  <span className="position-absolute top-50 start-50 translate-middle spinner-border spinner-border-sm text-primary" />
                ) : (
                  <button type="button" className="btn btn-light btn-sm border rounded-circle position-absolute shadow-sm" style={{ top: -8, right: -8, width: 26, height: 26, padding: 0 }} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove image">
                    <i className="bi bi-x" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canAdd && (
        <div
          role="button"
          tabIndex={0}
          className={cn("dropzone p-3 text-center", drag && "drag")}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          aria-label={`Upload ${label}`}
        >
          <i className="bi bi-cloud-arrow-up fs-4 text-muted" />
          <div className="small"><strong>{busy ? "Uploading…" : "Drop an image here"}</strong> or <span className="text-primary">browse</span></div>
          <div className="small text-muted">{hint ?? "JPG, PNG, WebP or AVIF · up to 5 MB"}</div>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple={multiple} hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}
      {canAdd && (
        <div className="input-group input-group-sm mt-2">
          <span className="input-group-text">or URL</span>
          <input className="form-control" placeholder="https://…/cover.jpg" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())} aria-label={`${label} image URL`} />
          <button type="button" className="btn btn-light border" onClick={addUrl}>Use URL</button>
        </div>
      )}
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}
