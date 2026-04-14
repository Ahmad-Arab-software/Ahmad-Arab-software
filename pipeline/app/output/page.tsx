"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePipeline } from "@/lib/PipelineContext";
import { DesignDocument, MergedBusinessData } from "@/types/pipeline";

const DEFAULT_FONT = "Inter";

export default function OutputPage() {
  const router = useRouter();
  const { state, reset } = usePipeline();
  const { designDocument, scrapeResult } = state;

  const generatedHtml = useMemo(() => {
    if (!designDocument || !scrapeResult) return "";
    return generateWebsiteHtml(designDocument, scrapeResult.merged);
  }, [designDocument, scrapeResult]);

  function handleDownload() {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleStartOver() {
    reset();
    router.push("/");
  }

  if (!designDocument) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-slate-400">Laden…</div>
      </main>
    );
  }

  const merged = scrapeResult!.merged;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Bronnen", "Scrapen", "Review", "Oplevering"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${i === 3 ? "bg-indigo-600 text-white" : "bg-green-600 text-white"}`}>
                {i < 3 ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === 3 ? "text-white font-medium" : "text-slate-500"}`}>{label}</span>
              {i < 3 && <div className="w-6 h-px bg-slate-600" />}
            </div>
          ))}
        </div>

        {/* Success banner */}
        <div className="bg-green-900/30 border border-green-700/50 rounded-2xl p-6 mb-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-xl font-bold text-white">Website gegenereerd!</h2>
          <p className="text-green-300 text-sm mt-1">
            {merged.name ? `De website voor ${merged.name} is klaar.` : "Je website is klaar."}
          </p>
        </div>

        {/* Summary */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
          <h3 className="text-white font-semibold text-sm mb-3">📋 Samenvatting</h3>
          <div className="space-y-2 text-sm">
            <Row label="Secties" value={`${designDocument.sections.filter((s) => s.included).length} secties`} />
            <Row label="Stijl" value={designDocument.designStyle} />
            <Row label="Toon" value={designDocument.tone} />
            <Row label="Taal" value={designDocument.language} />
            {merged.services.length > 0 && <Row label="Diensten" value={`${merged.services.length} items`} />}
            {merged.images.length > 0 && <Row label="Afbeeldingen" value={`${merged.images.length} items`} />}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <h3 className="text-white font-semibold text-sm mb-3">👁️ Voorbeeld (HTML preview)</h3>
          <div className="bg-white rounded-lg overflow-hidden" style={{ height: 320 }}>
            <iframe
              srcDoc={generatedHtml}
              title="Website preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStartOver}
            className="px-5 py-3 rounded-xl border border-slate-600 text-slate-400 text-sm hover:bg-slate-700 transition-colors"
          >
            Opnieuw beginnen
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download HTML
          </button>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 w-28 flex-shrink-0">{label}:</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function generateWebsiteHtml(doc: DesignDocument, merged: MergedBusinessData): string {
  const { primary, secondary, background, text } = doc.colorScheme;
  const name = merged.name ?? "Ons Bedrijf";
  const sections = doc.sections.filter((s) => s.included);

  const sectionHtml = sections.map((s) => {
    switch (s.id) {
      case "hero":
        return `
          <section class="hero">
            <h1>${escapeHtml(name)}</h1>
            <p>${escapeHtml(merged.tagline ?? doc.businessOverview)}</p>
          </section>`;
      case "about":
        return merged.description
          ? `<section class="about"><h2>Over ons</h2><p>${escapeHtml(merged.description)}</p></section>`
          : "";
      case "services":
        return merged.services.length > 0
          ? `<section class="services"><h2>Onze diensten</h2><div class="grid">${merged.services.slice(0, 9).map((s) => `<div class="card"><h3>${escapeHtml(s.name)}</h3>${s.price ? `<p class="price">${escapeHtml(s.price)}</p>` : ""}${s.description ? `<p>${escapeHtml(s.description.slice(0, 120))}</p>` : ""}</div>`).join("")}</div></section>`
          : "";
      case "reviews":
        return merged.reviews.length > 0
          ? `<section class="reviews"><h2>Wat klanten zeggen</h2><div class="grid">${merged.reviews.slice(0, 3).map((r) => `<div class="card"><p>"${escapeHtml(r.text ?? "")}"</p><p class="author">— ${escapeHtml(r.author ?? "Anoniem")} ${"⭐".repeat(r.rating)}</p></div>`).join("")}</div></section>`
          : "";
      case "hours":
        return merged.openingHours.length > 0
          ? `<section class="hours"><h2>Openingstijden</h2><table>${merged.openingHours.map((h) => `<tr><td>${escapeHtml(h.day)}</td><td>${h.closed ? "Gesloten" : `${h.open ?? ""}–${h.close ?? ""}`}</td></tr>`).join("")}</table></section>`
          : "";
      case "contact":
        return `<section class="contact"><h2>Contact</h2>${merged.contactInfo.address ? `<p>📍 ${escapeHtml(merged.contactInfo.address)}</p>` : ""}${merged.contactInfo.phone ? `<p>📞 ${escapeHtml(merged.contactInfo.phone)}</p>` : ""}${merged.contactInfo.email ? `<p>✉️ ${escapeHtml(merged.contactInfo.email)}</p>` : ""}</section>`;
      case "gallery":
        return merged.images.length > 0
          ? `<section class="gallery"><h2>Galerij</h2><div class="grid">${merged.images.slice(0, 6).map((img) => `<img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt ?? "")}" loading="lazy" />`).join("")}</div></section>`
          : "";
      default:
        return "";
    }
  }).join("\n");

  // Sanitize font names — only allow alphanumeric, spaces, and hyphens
  const sanitizeFont = (f: string) =>
    f.replace(/[^a-zA-Z0-9 \-]/g, "").trim() || DEFAULT_FONT;
  const headingFont = sanitizeFont(doc.typography.headingFont);
  const bodyFont = sanitizeFont(doc.typography.bodyFont);
  // Google Fonts expects spaces as '+' in the family parameter
  const headingFontParam = headingFont.replace(/ /g, "+");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.language ?? "nl")}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=${headingFontParam}:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '${escapeHtml(bodyFont)}', sans-serif; background: ${escapeHtml(background ?? "#fff")}; color: ${escapeHtml(text ?? "#111")}; }
    h1, h2, h3 { font-family: '${escapeHtml(headingFont)}', sans-serif; }
    section { padding: 4rem 2rem; max-width: 1000px; margin: 0 auto; }
    .hero { text-align: center; padding: 6rem 2rem; background: ${escapeHtml(primary ?? "#6366f1")}; color: #fff; max-width: 100%; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.2rem; opacity: 0.9; }
    h2 { font-size: 1.8rem; margin-bottom: 1.5rem; color: ${escapeHtml(primary ?? "#6366f1")}; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
    .card { background: #f8f9fa; border-radius: 12px; padding: 1.5rem; }
    .card h3 { margin-bottom: 0.5rem; }
    .card .price { color: ${escapeHtml(secondary ?? "#818cf8")}; font-weight: 600; margin-bottom: 0.5rem; }
    .card .author { margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.7; }
    .gallery .grid img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; }
    .contact p { margin-bottom: 0.75rem; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    table tr td { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    table tr td:first-child { font-weight: 600; width: 140px; }
  </style>
</head>
<body>
${sectionHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
