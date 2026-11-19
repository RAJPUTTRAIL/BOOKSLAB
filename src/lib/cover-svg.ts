// Generates calm, typographic SVG book covers for seeded titles (real image files on disk).

const PALETTE: Record<string, { bg: string; ink: string; rule: string }> = {
  Law: { bg: "#5B2333", ink: "#F6EFE6", rule: "#C9A86A" },
  Academic: { bg: "#2D4A3E", ink: "#F3F1EA", rule: "#C9B37E" },
  "Finance & Tax": { bg: "#1B365D", ink: "#F1F4F8", rule: "#B9C7D8" },
  "Tech & Management": { bg: "#2F3437", ink: "#F2F2EF", rule: "#9FB3A6" },
  General: { bg: "#7A4A2A", ink: "#FAF3EA", rule: "#D9B98C" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export function coverSvg(b: { title: string; subtitle?: string; author: string; category: string; edition: string; variant?: "front" | "back" }) {
  const p = PALETTE[b.category] ?? PALETTE.General;
  const W = 600, H = 900;
  if (b.variant === "back") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${p.bg}"/><rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${p.rule}" stroke-opacity=".5"/>
<text x="70" y="140" font-family="Georgia, serif" font-size="26" fill="${p.ink}">About this edition</text>
${wrap(b.subtitle || b.title, 36).slice(0, 6).map((l, i) => `<text x="70" y="${200 + i * 40}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${p.ink}" fill-opacity=".8">${esc(l)}</text>`).join("")}
<rect x="70" y="${H - 220}" width="200" height="110" fill="#fff"/>
${Array.from({ length: 30 }, (_, i) => `<rect x="${82 + i * 6}" y="${H - 205}" width="${i % 3 ? 2 : 4}" height="70" fill="#111"/>`).join("")}
<text x="${W - 70}" y="${H - 120}" text-anchor="end" font-family="Georgia, serif" font-size="28" font-weight="700" fill="${p.ink}">bookslab</text>
</svg>`;
  }
  const titleLines = wrap(b.title, 18).slice(0, 5);
  const subLines = wrap(b.subtitle ?? "", 34).slice(0, 2);
  const titleY = 300;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${p.bg}"/>
<rect x="0" y="0" width="22" height="${H}" fill="#000" fill-opacity=".18"/>
<rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none" stroke="${p.rule}" stroke-width="1.5" stroke-opacity=".7"/>
<text x="90" y="130" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="4" fill="${p.rule}">${esc(b.category.toUpperCase())}</text>
<line x1="90" y1="${titleY - 70}" x2="200" y2="${titleY - 70}" stroke="${p.rule}" stroke-width="3"/>
${titleLines.map((l, i) => `<text x="90" y="${titleY + i * 58}" font-family="Georgia, 'Times New Roman', serif" font-size="50" font-weight="700" fill="${p.ink}">${esc(l)}</text>`).join("")}
${subLines.map((l, i) => `<text x="90" y="${titleY + titleLines.length * 58 + 30 + i * 32}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${p.ink}" fill-opacity=".75">${esc(l)}</text>`).join("")}
<text x="90" y="${H - 160}" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="${p.ink}">${esc(b.author)}</text>
<text x="90" y="${H - 124}" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="${p.ink}" fill-opacity=".6">${esc(b.edition)}</text>
<text x="${W - 90}" y="${H - 124}" text-anchor="end" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${p.rule}">bookslab</text>
</svg>`;
}
