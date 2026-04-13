import * as cheerio from "cheerio";
import axios from "axios";
import {
  BusinessData,
  ColorPalette,
  ContactInfo,
  ImageData,
  OpeningHours,
  Service,
} from "@/types/pipeline";

// Restrict scraping to HTTP/HTTPS only and block private/internal IPs to prevent SSRF
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    // Block localhost and private IP ranges
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "metadata.google.internal" ||
      host === "169.254.169.254"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function scrapeWebsite(url: string): Promise<BusinessData> {
  if (!isSafeUrl(url)) {
    throw new Error("Invalid or unsafe URL scheme");
  }

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0; +https://ahmadarab.nl)",
    },
    maxRedirects: 5,
  });

  const html = response.data as string;
  const $ = cheerio.load(html);

  const name = extractBusinessName($);
  const tagline = extractTagline($);
  const description = extractDescription($);
  const contactInfo = extractContactInfo($);
  const openingHours = extractOpeningHours($);
  const services = extractServices($);
  const images = extractImages($, url);
  const colors = extractColors($);
  const fonts = extractFonts($);
  const language = $("html").attr("lang") ?? extractLanguageFromMeta($);

  return {
    name,
    tagline,
    description,
    contactInfo,
    openingHours,
    services,
    images,
    colors,
    fonts,
    language,
    source: "website",
    websiteUrl: url,
  };
}

function extractBusinessName($: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[property="og:site_name"]').attr("content") ||
    $('meta[name="application-name"]').attr("content") ||
    $(".logo, .brand, .site-title, .company-name").first().text().trim() ||
    $("header h1, nav h1, #header h1").first().text().trim() ||
    $("title").text().split(/[-|–|—]/)[0].trim() ||
    undefined
  );
}

function extractTagline($: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[name="description"]').attr("content") ||
    $(".tagline, .slogan, .hero-subtitle, .subtitle").first().text().trim() ||
    $("h1 + p, h2 + p").first().text().trim() ||
    undefined
  );
}

function extractDescription($: cheerio.CheerioAPI): string | undefined {
  const aboutSection = $(
    '#about, .about, [class*="about"], #over-ons, .over-ons'
  )
    .first()
    .text()
    .trim();
  if (aboutSection && aboutSection.length > 20) return aboutSection;

  return $('meta[property="og:description"]').attr("content") || undefined;
}

function extractContactInfo($: cheerio.CheerioAPI): ContactInfo {
  const text = $("body").text();

  const phoneMatch = text.match(
    /(?:tel|phone|telefoon|bel)[\s:]*([+\d\s\-().]{7,20})/i
  );
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  const addressSection = $(
    '[class*="address"], [class*="adres"], [itemtype*="PostalAddress"]'
  )
    .first()
    .text()
    .trim();

  return {
    phone: phoneMatch?.[1]?.trim(),
    email: emailMatch?.[0],
    address: addressSection || undefined,
  };
}

function extractOpeningHours($: cheerio.CheerioAPI): OpeningHours[] {
  const hours: OpeningHours[] = [];
  const days = [
    "maandag",
    "dinsdag",
    "woensdag",
    "donderdag",
    "vrijdag",
    "zaterdag",
    "zondag",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const hoursSection = $(
    '[class*="hours"], [class*="openingstijden"], [class*="opening-times"], [itemtype*="OpeningHoursSpecification"]'
  )
    .first()
    .text();

  if (hoursSection) {
    const lines = hoursSection.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const lower = line.toLowerCase();
      const matchedDay = days.find((d) => lower.includes(d));
      if (matchedDay) {
        const timeMatch = line.match(/(\d{1,2}[:h]\d{2})\s*[-–]\s*(\d{1,2}[:h]\d{2})/);
        hours.push({
          day: matchedDay,
          open: timeMatch?.[1],
          close: timeMatch?.[2],
          closed: lower.includes("gesloten") || lower.includes("closed"),
        });
      }
    }
  }

  return hours;
}

function extractServices($: cheerio.CheerioAPI): Service[] {
  const services: Service[] = [];
  const seen = new Set<string>();

  $(
    '[class*="service"], [class*="menu-item"], [class*="product"], [class*="dienst"]'
  ).each((_, el) => {
    const name = $(el).find("h2, h3, h4, .title, .name").first().text().trim();
    if (!name || seen.has(name) || name.length > 80) return;
    seen.add(name);

    const desc = $(el).find("p, .description").first().text().trim();
    const priceMatch = $(el)
      .text()
      .match(/[€$£][\d.,]+|[\d.,]+\s*(?:euro|EUR)/i);

    services.push({
      name,
      description: desc || undefined,
      price: priceMatch?.[0],
    });
  });

  return services.slice(0, 20);
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): ImageData[] {
  const images: ImageData[] = [];
  const seen = new Set<string>();

  $("img").each((_, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src) return;

    // Resolve relative URLs
    try {
      src = new URL(src, baseUrl).href;
    } catch {
      return;
    }

    if (seen.has(src) || src.includes("logo") || src.includes("icon")) return;
    seen.add(src);

    const alt = ($(el).attr("alt") ?? "").toLowerCase();
    let type: ImageData["type"] = "other";
    if (alt.includes("hero") || alt.includes("banner")) type = "hero";
    else if (alt.includes("team") || alt.includes("staff")) type = "team";
    else if (alt.includes("food") || alt.includes("dish") || alt.includes("eten")) type = "food";
    else if (alt.includes("interior") || alt.includes("interieur")) type = "interior";

    images.push({ url: src, alt: $(el).attr("alt"), type });
  });

  return images.slice(0, 15);
}

function extractColors($: cheerio.CheerioAPI): ColorPalette | undefined {
  const styleContent: string[] = [];
  $("style").each((_, el) => { styleContent.push($(el).html() ?? ""); });

  const allStyles = styleContent.join(" ");
  if (!allStyles) return undefined;

  const primary = allStyles.match(/--(?:primary|brand|main)[\w-]*\s*:\s*(#[\w]+|rgb[^;]+)/i)?.[1];
  const secondary = allStyles.match(/--(?:secondary|accent)[\w-]*\s*:\s*(#[\w]+|rgb[^;]+)/i)?.[1];
  const background = allStyles.match(/--(?:background|bg)[\w-]*\s*:\s*(#[\w]+|rgb[^;]+)/i)?.[1];
  const text = allStyles.match(/--(?:text|foreground|color)[\w-]*\s*:\s*(#[\w]+|rgb[^;]+)/i)?.[1];

  if (!primary && !secondary && !background) return undefined;

  return { primary, secondary, background, text };
}

function extractFonts($: cheerio.CheerioAPI): string[] {
  const fonts: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      const parsed = new URL(href, "https://example.com");
      if (parsed.hostname === "fonts.googleapis.com") {
        const match = href.match(/family=([^&:]+)/);
        if (match) fonts.push(decodeURIComponent(match[1]).replace(/\+/g, " "));
      }
    } catch {
      // ignore malformed URLs
    }
  });

  $("style").each((_, el) => {
    const css = $(el).html() ?? "";
    const fontFaceMatches = css.matchAll(/font-family:\s*['"]?([^'";\n,]+)/g);
    for (const m of fontFaceMatches) {
      const font = m[1].trim();
      if (!fonts.includes(font)) fonts.push(font);
    }
  });

  return [...new Set(fonts)].slice(0, 5);
}

function extractLanguageFromMeta($: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[http-equiv="content-language"]').attr("content") ||
    $('meta[name="language"]').attr("content") ||
    undefined
  );
}
