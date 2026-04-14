import * as cheerio from "cheerio";
import axios from "axios";
import { BusinessData, ImageData } from "@/types/pipeline";

// Allowed social media hostnames
const ALLOWED_SOCIAL_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "fb.com",
  "www.fb.com",
  "tiktok.com",
  "www.tiktok.com",
]);

// Only allow requests to known social media platforms (prevents SSRF)
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return ALLOWED_SOCIAL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function scrapeSocialMedia(links: string[]): Promise<BusinessData> {
  const safeLinks = links.filter(isSafeUrl);
  const results = await Promise.allSettled(
    safeLinks.map((link) => scrapeSinglePlatform(link))
  );

  // Merge all social data
  const merged: BusinessData = {
    source: "social_media",
    images: [],
    services: [],
    openingHours: [],
  };

  for (const result of results) {
    if (result.status === "fulfilled") {
      const data = result.value;
      if (!merged.name && data.name) merged.name = data.name;
      if (!merged.description && data.description) merged.description = data.description;
      if (!merged.contactInfo?.phone && data.contactInfo?.phone) {
        merged.contactInfo = { ...merged.contactInfo, ...data.contactInfo };
      }
      if (data.images) merged.images = [...(merged.images ?? []), ...data.images];
    }
  }

  return merged;
}

async function scrapeSinglePlatform(url: string): Promise<BusinessData> {
  const host = new URL(url).hostname.toLowerCase();

  if (host === "instagram.com" || host === "www.instagram.com") return scrapeInstagram(url);
  if (host === "facebook.com" || host === "www.facebook.com" || host === "fb.com" || host === "www.fb.com") return scrapeFacebook(url);
  if (host === "tiktok.com" || host === "www.tiktok.com") return scrapeTikTok(url);

  // Generic fallback (still within the ALLOWED_SOCIAL_HOSTS allowlist)
  return scrapeGenericSocial(url);
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI> {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WebsiteBuilderBot/1.0; +https://ahmadarab.nl)",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
    maxRedirects: 5,
  });
  return cheerio.load(response.data as string);
}

async function scrapeInstagram(url: string): Promise<BusinessData> {
  const $ = await fetchPage(url);

  const name =
    $('meta[property="og:title"]').attr("content")?.split("•")[0]?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.split("•")[0]?.trim();

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content");

  const images: ImageData[] = [];
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) images.push({ url: content, type: "other" });
  });

  return {
    name,
    description,
    images,
    source: "social_media",
  };
}

async function scrapeFacebook(url: string): Promise<BusinessData> {
  const $ = await fetchPage(url);

  const name =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="title"]').attr("content");

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content");

  // Try to extract phone from page text
  const text = $("body").text();
  const phoneMatch = text.match(/(?:\+31|0)[1-9][0-9\s\-]{6,12}/);

  const images: ImageData[] = [];
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) images.push({ url: content, type: "other" });
  });

  // Extract opening hours from structured data if available
  const openingHours = extractFacebookHours($);

  return {
    name,
    description,
    contactInfo: { phone: phoneMatch?.[0]?.trim() },
    openingHours,
    images,
    source: "social_media",
  };
}

function extractFacebookHours($: cheerio.CheerioAPI) {
  const hours: { day: string; open?: string; close?: string; closed?: boolean }[] = [];
  $('[data-testid*="hours"], .hours').each((_, el) => {
    const text = $(el).text();
    const dayMatch = text.match(/(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    const timeMatch = text.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (dayMatch) {
      hours.push({
        day: dayMatch[1].toLowerCase(),
        open: timeMatch?.[1],
        close: timeMatch?.[2],
      });
    }
  });
  return hours;
}

async function scrapeTikTok(url: string): Promise<BusinessData> {
  const $ = await fetchPage(url);

  const name = $('meta[property="og:title"]').attr("content");
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content");

  const images: ImageData[] = [];
  const avatar = $('meta[property="og:image"]').first().attr("content");
  if (avatar) images.push({ url: avatar, type: "other" });

  return {
    name,
    description,
    images,
    source: "social_media",
  };
}

async function scrapeGenericSocial(url: string): Promise<BusinessData> {
  const $ = await fetchPage(url);

  const name =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content");

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content");

  const images: ImageData[] = [];
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) images.push({ url: content, type: "other" });
  });

  return { name, description, images, source: "social_media" };
}
