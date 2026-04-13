import * as cheerio from "cheerio";
import axios from "axios";
import {
  BusinessData,
  ContactInfo,
  OpeningHours,
  Review,
  GeoCoordinates,
} from "@/types/pipeline";

// Restrict to HTTP/HTTPS only (SSRF guard)
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function scrapeGoogleBusiness(url: string): Promise<BusinessData> {
  if (!isSafeUrl(url)) {
    throw new Error("Invalid or unsafe URL scheme");
  }

  // For Google Maps short URLs, follow the redirect to get the full URL
  let resolvedUrl = url;
  if (url.includes("maps.app.goo.gl") || url.includes("goo.gl")) {
    try {
      const r = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0; +https://ahmadarab.nl)",
        },
      });
      resolvedUrl = r.request?.res?.responseUrl ?? r.config.url ?? url;
    } catch {
      resolvedUrl = url;
    }
  }

  const response = await axios.get(resolvedUrl, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0; +https://ahmadarab.nl)",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
    maxRedirects: 5,
  });

  const html = response.data as string;
  const $ = cheerio.load(html);

  // Extract structured data (JSON-LD)
  const jsonLd = extractJsonLd($);

  const name = jsonLd?.name ?? extractGoogleName($);
  const address = jsonLd?.address
    ? formatAddress(jsonLd.address)
    : extractGoogleAddress($);
  const phone = jsonLd?.telephone ?? extractGooglePhone($);
  const websiteUrl = jsonLd?.url ?? extractGoogleWebsite($);
  const coordinates = extractCoordinates(resolvedUrl, $);
  const openingHours = jsonLd?.openingHoursSpecification
    ? parseJsonLdHours(jsonLd.openingHoursSpecification)
    : extractGoogleHours($);
  const category = jsonLd?.["@type"] ?? extractGoogleCategory($);
  const reviews = extractGoogleReviews($);
  const images = extractGoogleImages($);

  const contactInfo: ContactInfo = {
    address,
    phone,
  };

  return {
    name,
    contactInfo,
    openingHours,
    category: Array.isArray(category) ? category[0] : category,
    reviews,
    images,
    coordinates,
    websiteUrl,
    source: "google_business",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonLd($: cheerio.CheerioAPI): any {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse($(scripts[i]).html() ?? "");
      if (
        data["@type"] === "LocalBusiness" ||
        data["@type"] === "Restaurant" ||
        data["@type"] === "Store" ||
        data["@type"]?.includes("Business")
      ) {
        return data;
      }
    } catch {
      // continue
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAddress(addr: any): string | undefined {
  if (typeof addr === "string") return addr;
  const parts = [
    addr.streetAddress,
    addr.postalCode,
    addr.addressLocality,
    addr.addressCountry,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function extractGoogleName($: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    undefined
  );
}

function extractGoogleAddress($: cheerio.CheerioAPI): string | undefined {
  return (
    $('[data-attrid*="address"], [data-item-id*="address"]')
      .first()
      .text()
      .trim() || undefined
  );
}

function extractGooglePhone($: cheerio.CheerioAPI): string | undefined {
  const text = $("body").text();
  const match = text.match(/(?:\+31|0)[1-9][0-9\s\-]{6,12}/);
  return match?.[0]?.trim();
}

function extractGoogleWebsite($: cheerio.CheerioAPI): string | undefined {
  return (
    $('[data-attrid*="website"] a, [data-item-id*="merchant"] a')
      .first()
      .attr("href") || undefined
  );
}

function extractCoordinates(
  url: string,
  $: cheerio.CheerioAPI
): GeoCoordinates | undefined {
  // Try to extract from URL: @lat,lng,zoom or !3dlat!4dlng patterns
  const atMatch = url.match(/@([-\d.]+),([-\d.]+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  const dMatch = url.match(/!3d([-\d.]+)!4d([-\d.]+)/);
  if (dMatch) {
    return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };
  }

  // Try meta
  const lat = $('meta[property="place:location:latitude"]').attr("content");
  const lng = $('meta[property="place:location:longitude"]').attr("content");
  if (lat && lng) {
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonLdHours(spec: any[]): OpeningHours[] {
  if (!Array.isArray(spec)) return [];
  return spec.map((s) => ({
    day: Array.isArray(s.dayOfWeek) ? s.dayOfWeek[0] : s.dayOfWeek,
    open: s.opens,
    close: s.closes,
    closed: !s.opens,
  }));
}

function extractGoogleHours($: cheerio.CheerioAPI): OpeningHours[] {
  const hours: OpeningHours[] = [];
  $('[data-attrid*="hours"], table.WgFkxc tr').each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 2) {
      const day = $(cells[0]).text().trim();
      const timeStr = $(cells[1]).text().trim();
      const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      if (day) {
        hours.push({
          day,
          open: timeMatch?.[1],
          close: timeMatch?.[2],
          closed:
            timeStr.toLowerCase().includes("gesloten") ||
            timeStr.toLowerCase().includes("closed"),
        });
      }
    }
  });
  return hours;
}

function extractGoogleCategory($: cheerio.CheerioAPI): string | undefined {
  return (
    $('[data-attrid*="category"], .YhemCb').first().text().trim() || undefined
  );
}

function extractGoogleReviews($: cheerio.CheerioAPI): Review[] {
  const reviews: Review[] = [];
  $(".review, [data-review-id], .jftiEf").each((_, el) => {
    const ratingStr = $(el).find("[aria-label*='ster'], .kvMYJc").attr("aria-label") ?? "";
    const ratingMatch = ratingStr.match(/(\d)/);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
    const text = $(el).find(".wiI7pd, .review-text").text().trim();
    const author = $(el).find(".d4r55, .author").text().trim();
    if (rating || text) {
      reviews.push({ author: author || undefined, rating, text: text || undefined });
    }
  });
  return reviews.slice(0, 10);
}

function extractGoogleImages($: cheerio.CheerioAPI) {
  const images: { url: string; alt?: string; type: "other" }[] = [];
  $('[data-photo-index] img, .heroHeader img').each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (src && src.startsWith("http")) {
      images.push({ url: src, alt: $(el).attr("alt"), type: "other" });
    }
  });
  return images.slice(0, 8);
}
