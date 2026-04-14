import { NextRequest, NextResponse } from "next/server";
import { ClientInput, ScrapeError } from "@/types/pipeline";
import { scrapeWebsite } from "@/lib/scrapeWebsite";
import { scrapeGoogleBusiness } from "@/lib/scrapeGoogleBusiness";
import { scrapeSocialMedia } from "@/lib/scrapeSocialMedia";
import { mergeBusinessData } from "@/lib/mergeData";

export async function POST(req: NextRequest) {
  let body: ClientInput;
  try {
    body = (await req.json()) as ClientInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { websiteUrl, googleBusinessUrl, socialMediaLinks } = body;

  // At least one input required
  if (!websiteUrl && !googleBusinessUrl && (!socialMediaLinks || socialMediaLinks.length === 0)) {
    return NextResponse.json(
      { error: "Vul minimaal één veld in: website URL, Google Business URL of sociale media links." },
      { status: 400 }
    );
  }

  const errors: ScrapeError[] = [];

  const [websiteData, googleData, socialData] = await Promise.all([
    websiteUrl
      ? scrapeWebsite(websiteUrl).catch((e) => {
          errors.push({ source: "website", message: String(e?.message ?? e) });
          return undefined;
        })
      : Promise.resolve(undefined),

    googleBusinessUrl
      ? scrapeGoogleBusiness(googleBusinessUrl).catch((e) => {
          errors.push({ source: "google_business", message: String(e?.message ?? e) });
          return undefined;
        })
      : Promise.resolve(undefined),

    socialMediaLinks && socialMediaLinks.length > 0
      ? scrapeSocialMedia(socialMediaLinks).catch((e) => {
          errors.push({ source: "social_media", message: String(e?.message ?? e) });
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);

  const result = mergeBusinessData(websiteData, googleData, socialData);
  result.errors = errors;

  return NextResponse.json(result);
}
