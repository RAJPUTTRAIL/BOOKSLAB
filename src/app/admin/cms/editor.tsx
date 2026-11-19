"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { useApi, useApp } from "@/components/providers";
import type { BannerContent, HeroContent, ShowcaseContent } from "@/lib/content";
import { formatINR } from "@/lib/utils";

type BookOpt = { id: string; slug: string; title: string; price: number; mrp: number };
type DropRow = { id: string; bookTitle: string; mrp: number; discountPct: number; label: string; endsAt: string; active: boolean };

function Section({ title, sub, children, onSave, saving, preview }: { title: string; sub: string; children: ReactNode; onSave?: () => void; saving?: boolean; preview?: string }) {
  return (
    <section className="card rounded-4 mb-4">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
        <div><h2 className="h6 mb-0">{title}</h2><div className="small text-muted">{sub}</div></div>
        <div className="d-flex gap-2">
          {preview && <Link href={preview} target="_blank" className="btn btn-light border btn-sm">Preview</Link>}
          {onSave && <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-1" />}Publish</button>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function BookChecklist({ books, value, onChange }: { books: BookOpt[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="border rounded-3 p-2 bg-white" style={{ maxHeight: 200, overflowY: "auto" }}>
      {books.map((b) => (
        <div className="form-check" key={b.slug}>
          <input className="form-check-input" type="checkbox" id={`bk-${b.slug}-${value.length}`} checked={value.includes(b.slug)} onChange={(e) => onChange(e.target.checked ? [...value, b.slug] : value.filter((s) => s !== b.slug))} />
          <label className="form-check-label small d-flex justify-content-between" htmlFor={`bk-${b.slug}-${value.length}`}><span className="text-truncate">{b.title}</span><span className="text-muted tabular ms-2">{formatINR(b.price)}</span></label>
        </div>
      ))}
    </div>
  );
}

export function CmsEditor({ content, books, drops: initialDrops }: { content: { hero: HeroContent; showcase: ShowcaseContent; banner: BannerContent }; books: BookOpt[]; drops: DropRow[] }) {
  const api = useApi();
  const router = useRouter();
  const { toast } = useApp();
  const [hero, setHero] = useState(content.hero);
  const [show, setShow] = useState(content.showcase);
  const [banner, setBanner] = useState(content.banner);
  const [drops, setDrops] = useState(initialDrops);
  const [saving, setSaving] = useState<string | null>(null);
  const [newDrop, setNewDrop] = useState({ bookId: books[0]?.id ?? "", discountPct: 20, hours: 72, label: "This week" });

  const publish = async (key: "HERO" | "SHOWCASE" | "BANNER", value: unknown) => {
    setSaving(key);
    try {
      await api("/api/admin/content", { key, value }, "PUT");
      toast({ kind: "success", title: "Published", body: "The storefront has been updated." });
      router.refresh();
    } catch (e) {
      toast({ kind: "danger", title: "Couldn't publish", body: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };
  const createDrop = async () => {
    setSaving("DROP");
    try {
      const { drop } = await api<{ drop: { id: string; endsAt: string } }>("/api/admin/drops", newDrop);
      const b = books.find((x) => x.id === newDrop.bookId)!;
      setDrops((d) => [{ id: drop.id, bookTitle: b.title, mrp: b.mrp, discountPct: newDrop.discountPct, label: newDrop.label, endsAt: drop.endsAt, active: true }, ...d.map((x) => (x.bookTitle === b.title ? { ...x, active: false } : x))]);
      toast({ kind: "success", title: "Offer is live" });
      router.refresh();
    } catch (e) {
      toast({ kind: "danger", title: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };
  const toggleDrop = async (d: DropRow) => {
    try { await api(`/api/admin/drops/${d.id}`, { active: !d.active }, "PATCH"); setDrops((p) => p.map((x) => (x.id === d.id ? { ...x, active: !x.active } : x))); router.refresh(); }
    catch (e) { toast({ kind: "danger", title: (e as Error).message }); }
  };
  const deleteDrop = async (d: DropRow) => {
    try { await api(`/api/admin/drops/${d.id}`, undefined, "DELETE"); setDrops((p) => p.filter((x) => x.id !== d.id)); router.refresh(); }
    catch (e) { toast({ kind: "danger", title: (e as Error).message }); }
  };
  const upd = <T,>(arr: T[], i: number, patch: Partial<T>) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x));

  return (
    <>
      <div className="mb-4"><div className="eyebrow">No-code controls</div><h1 className="h3 mb-0">Homepage content</h1></div>

      <Section title="Announcement banner" sub="A single line shown above the header" onSave={() => publish("BANNER", banner)} saving={saving === "BANNER"} preview="/">
        <div className="row g-3">
          <div className="col-12"><label className="form-label">Text</label><input className="form-control" value={banner.text} onChange={(e) => setBanner({ ...banner, text: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label">Promo code</label><input className="form-control font-mono" value={banner.code} onChange={(e) => setBanner({ ...banner, code: e.target.value.toUpperCase() })} placeholder="Optional" /></div>
          <div className="col-md-3"><label className="form-label">Link text</label><input className="form-control" value={banner.cta} onChange={(e) => setBanner({ ...banner, cta: e.target.value })} /></div>
          <div className="col-md-4"><label className="form-label">Link (site path)</label><input className="form-control font-mono" value={banner.href} onChange={(e) => setBanner({ ...banner, href: e.target.value })} /></div>
          <div className="col-md-2 d-flex align-items-end"><div className="form-check form-switch mb-2"><input className="form-check-input" type="checkbox" role="switch" id="banner-on" checked={banner.active} onChange={(e) => setBanner({ ...banner, active: e.target.checked })} /><label className="form-check-label" htmlFor="banner-on">Visible</label></div></div>
        </div>
      </Section>

      <Section title="Hero" sub="Headline, supporting copy and featured set" onSave={() => publish("HERO", hero)} saving={saving === "HERO"} preview="/">
        <div className="row g-3">
          <div className="col-md-4"><label className="form-label">Eyebrow</label><input className="form-control" value={hero.eyebrow} onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} /></div>
          <div className="col-md-8"><label className="form-label">Headline</label><input className="form-control" value={hero.headline} onChange={(e) => setHero({ ...hero, headline: e.target.value })} /></div>
          <div className="col-12"><label className="form-label">Supporting text</label><textarea className="form-control" rows={2} value={hero.subhead} onChange={(e) => setHero({ ...hero, subhead: e.target.value })} /></div>
          <div className="col-12"><label className="form-label">Highlights <span className="text-muted fw-normal">(one per line, up to 5)</span></label><textarea className="form-control" rows={3} value={hero.highlights.join("\n")} onChange={(e) => setHero({ ...hero, highlights: e.target.value.split("\n").filter((l) => l.trim()).slice(0, 5) })} /></div>
          <div className="col-md-6"><label className="form-label">Featured set title</label><input className="form-control" value={hero.bundleTitle} onChange={(e) => setHero({ ...hero, bundleTitle: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label">Featured set subtitle</label><input className="form-control" value={hero.bundleSubtitle} onChange={(e) => setHero({ ...hero, bundleSubtitle: e.target.value })} /></div>
          <div className="col-12"><label className="form-label">Books in the featured set <span className="text-muted fw-normal">({hero.bundleBookSlugs.length} selected, priced as a kit)</span></label><BookChecklist books={books} value={hero.bundleBookSlugs} onChange={(v) => setHero({ ...hero, bundleBookSlugs: v })} /></div>
        </div>
      </Section>

      <Section title="Flagship showcase" sub="Pinned cover with scrolling chapters and edition comparison" onSave={() => publish("SHOWCASE", show)} saving={saving === "SHOWCASE"} preview="/#showcase">
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Showcased book</label>
            <select className="form-select" value={show.bookSlug} onChange={(e) => setShow({ ...show, bookSlug: e.target.value })}>{books.map((b) => <option key={b.slug} value={b.slug}>{b.title}</option>)}</select>
          </div>
          <div className="col-md-6"><label className="form-label">Eyebrow</label><input className="form-control" value={show.eyebrow} onChange={(e) => setShow({ ...show, eyebrow: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label">Headline</label><input className="form-control" value={show.headline} onChange={(e) => setShow({ ...show, headline: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label">Tagline</label><input className="form-control" value={show.tagline} onChange={(e) => setShow({ ...show, tagline: e.target.value })} /></div>
        </div>

        <h3 className="h6 mt-4">Chapters <span className="text-muted fw-normal small">({show.callouts.length}/6)</span></h3>
        {show.callouts.map((c, i) => (
          <div key={i} className="row g-2 align-items-start border rounded-3 p-2 mb-2 mx-0">
            <div className="col-md-2"><input className="form-control form-control-sm font-mono" value={c.stat} onChange={(e) => setShow({ ...show, callouts: upd(show.callouts, i, { stat: e.target.value }) })} placeholder="Stat" aria-label="Stat" /></div>
            <div className="col-md-3"><input className="form-control form-control-sm" value={c.title} onChange={(e) => setShow({ ...show, callouts: upd(show.callouts, i, { title: e.target.value }) })} placeholder="Title" aria-label="Title" /></div>
            <div className="col-md-6"><input className="form-control form-control-sm" value={c.body} onChange={(e) => setShow({ ...show, callouts: upd(show.callouts, i, { body: e.target.value }) })} placeholder="Description" aria-label="Description" /></div>
            <div className="col-md-1 text-end"><button type="button" className="btn btn-light border btn-sm text-danger" disabled={show.callouts.length <= 1} onClick={() => setShow({ ...show, callouts: show.callouts.filter((_, j) => j !== i) })} aria-label="Remove chapter"><i className="bi bi-trash" /></button></div>
          </div>
        ))}
        {show.callouts.length < 6 && <button type="button" className="btn btn-light border btn-sm" onClick={() => setShow({ ...show, callouts: [...show.callouts, { stat: "", title: "New chapter", body: "Describe the feature." }] })}><i className="bi bi-plus" /> Add chapter</button>}

        <h3 className="h6 mt-4">Cover markers <span className="text-muted fw-normal small">(position in % from left / top)</span></h3>
        {show.hotspots.map((h, i) => (
          <div key={i} className="row g-2 align-items-start border rounded-3 p-2 mb-2 mx-0">
            <div className="col-3 col-md-1"><input type="number" min={0} max={100} className="form-control form-control-sm" value={h.x} onChange={(e) => setShow({ ...show, hotspots: upd(show.hotspots, i, { x: Number(e.target.value) }) })} aria-label="Left %" /></div>
            <div className="col-3 col-md-1"><input type="number" min={0} max={100} className="form-control form-control-sm" value={h.y} onChange={(e) => setShow({ ...show, hotspots: upd(show.hotspots, i, { y: Number(e.target.value) }) })} aria-label="Top %" /></div>
            <div className="col-6 col-md-3"><input className="form-control form-control-sm" value={h.title} onChange={(e) => setShow({ ...show, hotspots: upd(show.hotspots, i, { title: e.target.value }) })} aria-label="Marker title" /></div>
            <div className="col-10 col-md-6"><input className="form-control form-control-sm" value={h.body} onChange={(e) => setShow({ ...show, hotspots: upd(show.hotspots, i, { body: e.target.value }) })} aria-label="Marker text" /></div>
            <div className="col-2 col-md-1 text-end"><button type="button" className="btn btn-light border btn-sm text-danger" onClick={() => setShow({ ...show, hotspots: show.hotspots.filter((_, j) => j !== i) })} aria-label="Remove marker"><i className="bi bi-trash" /></button></div>
          </div>
        ))}
        {show.hotspots.length < 6 && <button type="button" className="btn btn-light border btn-sm" onClick={() => setShow({ ...show, hotspots: [...show.hotspots, { x: 50, y: 50, title: "New marker", body: "Detail" }] })}><i className="bi bi-plus" /> Add marker</button>}

        <h3 className="h6 mt-4">Editions <span className="text-muted fw-normal small">(price = showcased book + add-ons, kit-priced)</span></h3>
        <div className="row g-3">
          {show.editions.map((ed, i) => (
            <div className="col-md-6" key={i}>
              <div className="border rounded-3 p-3 h-100">
                <div className="d-flex gap-2 align-items-center mb-2">
                  <input className="form-control form-control-sm" value={ed.name} onChange={(e) => setShow({ ...show, editions: upd(show.editions, i, { name: e.target.value }) })} aria-label="Edition name" />
                  <div className="form-check text-nowrap mb-0"><input className="form-check-input" type="radio" name="rec" id={`rec-${i}`} checked={!!ed.highlight} onChange={() => setShow({ ...show, editions: show.editions.map((x, j) => ({ ...x, highlight: j === i })) })} /><label className="form-check-label small" htmlFor={`rec-${i}`}>Recommended</label></div>
                </div>
                <textarea className="form-control form-control-sm mb-2" rows={4} value={ed.features.join("\n")} onChange={(e) => setShow({ ...show, editions: upd(show.editions, i, { features: e.target.value.split("\n").filter((f) => f.trim()) }) })} aria-label="Features, one per line" />
                <div className="small text-muted mb-1">Included add-ons</div>
                <BookChecklist books={books.filter((b) => b.slug !== show.bookSlug)} value={ed.addonSlugs} onChange={(v) => setShow({ ...show, editions: upd(show.editions, i, { addonSlugs: v }) })} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Weekly offers" sub="Time-limited discounts — prices update across the store immediately">
        <div className="row g-2 align-items-end">
          <div className="col-md-5"><label className="form-label small">Book</label><select className="form-select" value={newDrop.bookId} onChange={(e) => setNewDrop({ ...newDrop, bookId: e.target.value })}>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></div>
          <div className="col-4 col-md-2"><label className="form-label small">% off MRP</label><input type="number" min={1} max={90} className="form-control" value={newDrop.discountPct} onChange={(e) => setNewDrop({ ...newDrop, discountPct: Number(e.target.value) })} /></div>
          <div className="col-4 col-md-2"><label className="form-label small">Hours</label><input type="number" min={1} className="form-control" value={newDrop.hours} onChange={(e) => setNewDrop({ ...newDrop, hours: Number(e.target.value) })} /></div>
          <div className="col-4 col-md-2"><label className="form-label small">Label</label><input className="form-control" value={newDrop.label} onChange={(e) => setNewDrop({ ...newDrop, label: e.target.value })} /></div>
          <div className="col-md-1"><button type="button" className="btn btn-primary w-100" onClick={createDrop} disabled={saving === "DROP"}>Start</button></div>
        </div>
        <div className="table-responsive mt-3">
          <table className="table align-middle small mb-0">
            <thead><tr><th>Book</th><th>Offer</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {drops.map((d) => {
                const live = d.active && new Date(d.endsAt).getTime() > Date.now();
                return (
                  <tr key={d.id}>
                    <td>{d.bookTitle}</td>
                    <td>{d.label} · {d.discountPct}% off → <span className="tabular">{formatINR(Math.round(d.mrp * (1 - d.discountPct / 100)))}</span></td>
                    <td>{live ? <span className="text-success">Live · <Countdown endsAt={d.endsAt} /></span> : <span className="text-muted">{d.active ? "Ended" : "Paused"}</span>}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-light border btn-sm me-1" onClick={() => toggleDrop(d)}>{d.active ? "Pause" : "Resume"}</button>
                      <button type="button" className="btn btn-light border btn-sm text-danger" onClick={() => deleteDrop(d)} aria-label="Delete offer"><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                );
              })}
              {drops.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">No offers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
