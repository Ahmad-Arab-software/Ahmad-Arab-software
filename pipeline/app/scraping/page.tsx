"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipeline } from "@/lib/PipelineContext";

export default function ScrapingPage() {
  const router = useRouter();
  const { state, goTo } = usePipeline();

  useEffect(() => {
    // If no scrape result yet, go back to intake
    if (state.step === "intake" || !state.scrapeResult) {
      router.replace("/");
      return;
    }
    // Already scraped — move to review after a brief display
    const t = setTimeout(() => {
      goTo("review");
      router.push("/review");
    }, 2000);
    return () => clearTimeout(t);
  }, [state, router, goTo]);

  const { scrapeResult } = state;
  const merged = scrapeResult?.merged;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Bronnen", "Scrapen", "Review", "Oplevering"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  i === 1 ? "bg-indigo-600 text-white" : i < 1 ? "bg-green-600 text-white" : "bg-slate-700 text-slate-400"
                }`}
              >
                {i < 1 ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === 1 ? "text-white font-medium" : "text-slate-500"}`}>
                {label}
              </span>
              {i < 3 && <div className="w-6 h-px bg-slate-600" />}
            </div>
          ))}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-600/20 border border-green-600/40 rounded-full mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Gegevens opgehaald!</h2>
            <p className="text-slate-400 text-sm mt-1">We gaan nu het design document opstellen…</p>
          </div>

          {/* Summary of what was found */}
          {merged && (
            <div className="space-y-3">
              {merged.name && (
                <DataRow icon="🏢" label="Bedrijfsnaam" value={merged.name} />
              )}
              {merged.category && (
                <DataRow icon="🏷️" label="Categorie" value={merged.category} />
              )}
              {merged.contactInfo.phone && (
                <DataRow icon="📞" label="Telefoon" value={merged.contactInfo.phone} />
              )}
              {merged.contactInfo.email && (
                <DataRow icon="✉️" label="E-mail" value={merged.contactInfo.email} />
              )}
              {merged.contactInfo.address && (
                <DataRow icon="📍" label="Adres" value={merged.contactInfo.address} />
              )}
              {merged.services.length > 0 && (
                <DataRow icon="⚡" label="Diensten" value={`${merged.services.length} gevonden`} />
              )}
              {merged.images.length > 0 && (
                <DataRow icon="🖼️" label="Afbeeldingen" value={`${merged.images.length} gevonden`} />
              )}
              {merged.openingHours.length > 0 && (
                <DataRow icon="🕐" label="Openingstijden" value={`${merged.openingHours.length} dagen`} />
              )}
            </div>
          )}

          {/* Errors */}
          {scrapeResult?.errors && scrapeResult.errors.length > 0 && (
            <div className="mt-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-medium mb-1">Waarschuwingen:</p>
              {scrapeResult.errors.map((e, i) => (
                <p key={i} className="text-yellow-300 text-xs">
                  {e.source}: {e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DataRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 bg-slate-700/40 rounded-lg px-4 py-2.5">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-xs">{label}</p>
        <p className="text-white text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
