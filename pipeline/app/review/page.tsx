"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipeline } from "@/lib/PipelineContext";
import { DesignDocument, MissingField, MergedBusinessData, PageSection } from "@/types/pipeline";

const DEFAULT_FONT = "Inter";

const MISSING_FIELD_LABELS: Record<string, string> = {
  name: "Bedrijfsnaam",
  phone: "Telefoonnummer",
  email: "E-mailadres",
  address: "Adres",
  openingHours: "Openingstijden",
  services: "Diensten / aanbod",
  description: "Omschrijving van het bedrijf",
};

const ALL_SECTIONS: PageSection[] = [
  { id: "hero", name: "Hero / Banner", included: true },
  { id: "about", name: "Over ons", included: true },
  { id: "services", name: "Diensten / Menu", included: true },
  { id: "gallery", name: "Galerij", included: true },
  { id: "reviews", name: "Reviews", included: true },
  { id: "hours", name: "Openingstijden", included: true },
  { id: "contact", name: "Contact / Locatie", included: true },
];

export default function ReviewPage() {
  const router = useRouter();
  const { state, setDesignDocument, goTo } = usePipeline();
  const { scrapeResult } = state;
  const merged = scrapeResult?.merged;

  // User-editable overrides
  const [overviewText, setOverviewText] = useState<string | null>(null);
  const [missingValues, setMissingValues] = useState<Record<string, string>>({});
  // Track section toggles as a map of id -> explicit override (true/false)
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Derive design doc from scraped data (pure, no setState in effects)
  const baseDoc = useMemo<DesignDocument | null>(() => {
    if (!merged) return null;

    const missingFields: MissingField[] = (scrapeResult?.missingFields ?? []).map(
      (field) => ({
        field,
        label: MISSING_FIELD_LABELS[field] ?? field,
        value: "",
      })
    );

    return {
      businessOverview:
        merged.description ?? merged.tagline ?? `Welkom bij ${merged.name ?? "ons bedrijf"}.`,
      targetAudience:
        "Lokale klanten die op zoek zijn naar " + (merged.category ?? "onze diensten"),
      designStyle: merged.colors?.primary ? "Modern en strak" : "Professioneel en uitnodigend",
      colorScheme: merged.colors ?? {
        primary: "#6366f1",
        secondary: "#818cf8",
        background: "#ffffff",
        text: "#1e293b",
        accent: "#f59e0b",
      },
      typography: {
        headingFont: merged.fonts[0] ?? DEFAULT_FONT,
        bodyFont: merged.fonts[1] ?? merged.fonts[0] ?? DEFAULT_FONT,
      },
      sections: ALL_SECTIONS.map((s) => ({
        ...s,
        included: s.id === "services" ? merged.services.length > 0 : s.included,
        content: getSectionContent(s.id, merged),
      })),
      tone:
        merged.language === "en"
          ? "Professional and welcoming"
          : "Professioneel en vriendelijk",
      language: merged.language ?? "nl",
      missingData: missingFields,
    };
  }, [merged, scrapeResult]);

  // Effective sections (base + user toggles)
  const sections = useMemo(
    () =>
      (baseDoc?.sections ?? ALL_SECTIONS).map((s) => ({
        ...s,
        included: s.id in sectionToggles ? sectionToggles[s.id] : s.included,
      })),
    [baseDoc, sectionToggles]
  );

  // Redirect if no data
  if (!scrapeResult || !merged || !baseDoc) {
    if (typeof window !== "undefined") router.replace("/");
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-slate-400">Laden…</div>
      </main>
    );
  }

  const missingFields = baseDoc.missingData ?? [];
  const allMissingFilled = missingFields.every(
    (f) => (missingValues[f.field] ?? "").trim() !== ""
  );
  const effectiveOverview = overviewText ?? baseDoc.businessOverview;

  const canProceed = missingFields.length === 0 || allMissingFilled;

  function handleMissingChange(field: string, value: string) {
    setMissingValues((v) => ({ ...v, [field]: value }));
  }

  function toggleSection(id: string) {
    const current = sections.find((s) => s.id === id)?.included ?? true;
    setSectionToggles((t) => ({ ...t, [id]: !current }));
  }

  function handleApprove() {
    if (!baseDoc) return;
    setSaving(true);
    const finalDoc: DesignDocument = {
      ...baseDoc,
      businessOverview: effectiveOverview,
      sections,
      missingData: missingFields.map((f) => ({
        ...f,
        value: missingValues[f.field] ?? f.value,
      })),
    };
    setDesignDocument(finalDoc);
    goTo("output");
    router.push("/output");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Bronnen", "Scrapen", "Review", "Oplevering"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  i === 2
                    ? "bg-indigo-600 text-white"
                    : i < 2
                    ? "bg-green-600 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {i < 2 ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  i === 2 ? "text-white font-medium" : "text-slate-500"
                }`}
              >
                {label}
              </span>
              {i < 3 && <div className="w-6 h-px bg-slate-600" />}
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Design Document</h2>
        <p className="text-slate-400 text-sm mb-6">
          Controleer en pas eventueel aan. Klik daarna op Goedkeuren.
        </p>

        {/* Missing data — prompt the client */}
        {missingFields.length > 0 && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <h3 className="text-amber-300 font-semibold text-sm">
                Enkele gegevens niet gevonden — vul ze hieronder in:
              </h3>
            </div>
            <div className="space-y-3">
              {missingFields.map((f) => (
                <div key={f.field}>
                  <label className="block text-amber-200 text-xs font-medium mb-1">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={missingValues[f.field] ?? ""}
                    onChange={(e) => handleMissingChange(f.field, e.target.value)}
                    placeholder={`Vul ${f.label.toLowerCase()} in`}
                    className="w-full bg-slate-900 border border-amber-700/50 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business overview */}
        <Section title="Bedrijfsomschrijving" icon="🏢">
          <textarea
            value={effectiveOverview}
            onChange={(e) => setOverviewText(e.target.value)}
            rows={3}
            className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </Section>

        {/* Design style */}
        <Section title="Stijl & Kleuren" icon="🎨">
          <div className="space-y-3">
            <LabeledField label="Stijl">{baseDoc.designStyle}</LabeledField>
            <LabeledField label="Toon">{baseDoc.tone}</LabeledField>
            <LabeledField label="Taal">{baseDoc.language}</LabeledField>
            <div>
              <p className="text-slate-400 text-xs mb-2">Kleurenpalet:</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(baseDoc.colorScheme).map(([key, color]) =>
                  color ? (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2.5 py-1.5"
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-slate-300 text-xs">{key}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
            <LabeledField label="Lettertypen">
              {baseDoc.typography.headingFont} / {baseDoc.typography.bodyFont}
            </LabeledField>
          </div>
        </Section>

        {/* Sections to include */}
        <Section title="Pagina-secties" icon="📄">
          <p className="text-slate-400 text-xs mb-3">
            Selecteer welke secties je wilt includeren:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => toggleSection(sec.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  sec.included
                    ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                    : "bg-slate-700/40 border-slate-600 text-slate-400"
                }`}
              >
                <span>{sec.included ? "✓" : "○"}</span>
                {sec.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Approve button */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-none px-5 py-3 rounded-xl border border-slate-600 text-slate-400 text-sm hover:bg-slate-700 transition-colors"
          >
            ← Opnieuw
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || !canProceed}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Bezig…
              </>
            ) : (
              <>
                Goedkeuren & code genereren
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 text-xs w-28 flex-shrink-0 pt-0.5">
        {label}:
      </span>
      <span className="text-slate-200 text-sm">{children}</span>
    </div>
  );
}

function getSectionContent(id: string, merged: MergedBusinessData): string {
  switch (id) {
    case "hero":
      return merged.tagline ?? merged.name ?? "";
    case "about":
      return merged.description ?? "";
    case "services":
      return merged.services
        .slice(0, 3)
        .map((s) => s.name)
        .join(", ");
    case "reviews":
      return merged.reviews.length
        ? `${merged.reviews.length} reviews beschikbaar`
        : "";
    case "hours":
      return merged.openingHours.length ? "Openingstijden beschikbaar" : "";
    case "contact":
      return [merged.contactInfo.address, merged.contactInfo.phone]
        .filter(Boolean)
        .join(" · ");
    default:
      return "";
  }
}
