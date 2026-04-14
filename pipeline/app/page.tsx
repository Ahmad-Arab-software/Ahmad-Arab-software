"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePipeline } from "@/lib/PipelineContext";
import { ClientInput, ScrapeResult } from "@/types/pipeline";

export default function IntakePage() {
  const router = useRouter();
  const { setClientInput, setScrapeResult, goTo } = usePipeline();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasAtLeastOne =
    websiteUrl.trim() || googleBusinessUrl.trim() || socialLinks.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!hasAtLeastOne) {
      setError("Vul minimaal één veld in.");
      return;
    }

    const parsedSocials = socialLinks
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const input: ClientInput = {
      websiteUrl: websiteUrl.trim() || undefined,
      googleBusinessUrl: googleBusinessUrl.trim() || undefined,
      socialMediaLinks: parsedSocials.length ? parsedSocials : undefined,
    };

    setClientInput(input);
    setLoading(true);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Scraping mislukt");
      }

      const result = (await res.json()) as ScrapeResult;
      setScrapeResult(result);
      goTo("scraping");
      router.push("/scraping");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Website Generator</h1>
          <p className="text-slate-400 mt-2">
            Geef één of meerdere bronnen op — wij regelen de rest.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Bronnen", "Scrapen", "Review", "Oplevering"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  i === 0 ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  i === 0 ? "text-white font-medium" : "text-slate-500"
                }`}
              >
                {label}
              </span>
              {i < 3 && <div className="w-6 h-px bg-slate-600" />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6"
        >
          <p className="text-slate-300 text-sm leading-relaxed">
            Vul{" "}
            <span className="text-white font-semibold">minimaal één</span> van
            de onderstaande velden in. Hoe meer je invult, hoe beter het
            eindresultaat.
          </p>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              🌐 Website URL
              <span className="text-slate-500 font-normal ml-1">(optioneel)</span>
            </label>
            <input
              type="url"
              placeholder="https://mijnbedrijf.nl"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          {/* Google Business URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              📍 Google Business pagina
              <span className="text-slate-500 font-normal ml-1">(optioneel)</span>
            </label>
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/... of Google Maps link"
              value={googleBusinessUrl}
              onChange={(e) => setGoogleBusinessUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          {/* Social media links */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              📱 Sociale media links
              <span className="text-slate-500 font-normal ml-1">(optioneel)</span>
            </label>
            <textarea
              rows={3}
              placeholder={
                "https://instagram.com/mijnbedrijf\nhttps://facebook.com/mijnbedrijf"
              }
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
            />
            <p className="text-slate-500 text-xs mt-1">
              Één link per regel — Instagram, Facebook, TikTok
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !hasAtLeastOne}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg px-6 py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Gegevens ophalen…
              </>
            ) : (
              <>
                Genereer mijn website
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          Jouw gegevens worden alleen gebruikt om de website te genereren en
          worden niet opgeslagen.
        </p>
      </div>
    </main>
  );
}
