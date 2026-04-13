import {
  BusinessData,
  MergedBusinessData,
  ScrapeResult,
  SOURCE_PRIORITY,
  DataSource,
  ContactInfo,
  OpeningHours,
  Service,
  ImageData,
  ColorPalette,
  Review,
} from "@/types/pipeline";

/**
 * Merges data from multiple sources using priority order:
 * 1. Google Business (most up-to-date for contact/hours)
 * 2. Website (most authoritative for copy/services)
 * 3. Social Media (supplementary)
 */
export function mergeBusinessData(
  websiteData?: BusinessData,
  googleData?: BusinessData,
  socialData?: BusinessData
): ScrapeResult {
  // Order sources by priority
  const sourceMap: Partial<Record<DataSource, BusinessData | undefined>> = {
    google_business: googleData,
    website: websiteData,
    social_media: socialData,
  };

  // Pick best value for a scalar field using priority order
  function pick<T>(getter: (data: BusinessData) => T | undefined): T | undefined {
    for (const source of SOURCE_PRIORITY) {
      const data = sourceMap[source];
      if (data) {
        const val = getter(data);
        if (val !== undefined && val !== null && val !== "") return val;
      }
    }
    return undefined;
  }

  // Merge ContactInfo: take each field from highest-priority source that has it
  const contactInfo: ContactInfo = {
    address:
      googleData?.contactInfo?.address ||
      websiteData?.contactInfo?.address ||
      socialData?.contactInfo?.address,
    phone:
      googleData?.contactInfo?.phone ||
      websiteData?.contactInfo?.phone ||
      socialData?.contactInfo?.phone,
    email:
      websiteData?.contactInfo?.email ||
      socialData?.contactInfo?.email ||
      googleData?.contactInfo?.email,
  };

  // Merge opening hours: Google Business wins, fall back to website, then social
  const openingHours: OpeningHours[] =
    (googleData?.openingHours?.length ? googleData.openingHours : null) ??
    (websiteData?.openingHours?.length ? websiteData.openingHours : null) ??
    socialData?.openingHours ??
    [];

  // Merge services: website is most authoritative
  const services: Service[] =
    (websiteData?.services?.length ? websiteData.services : null) ??
    googleData?.services ??
    socialData?.services ??
    [];

  // Merge images from all sources (deduplicated)
  const allImages = [
    ...(websiteData?.images ?? []),
    ...(googleData?.images ?? []),
    ...(socialData?.images ?? []),
  ];
  const images: ImageData[] = deduplicateImages(allImages);

  // Colors and fonts from website (most reliable source)
  const colors: ColorPalette | undefined = websiteData?.colors;
  const fonts: string[] = websiteData?.fonts ?? [];

  // Reviews: merge and deduplicate from Google (primary) and social
  const allReviews: Review[] = [
    ...(googleData?.reviews ?? []),
    ...(socialData?.reviews ?? []),
  ];

  // Social links: original links provided
  const merged: MergedBusinessData = {
    name: pick((d) => d.name),
    tagline: pick((d) => d.tagline),
    description: pick((d) => d.description),
    services,
    contactInfo,
    openingHours,
    images,
    colors,
    fonts,
    language: pick((d) => d.language),
    category: pick((d) => d.category),
    reviews: allReviews.slice(0, 10),
    coordinates: googleData?.coordinates ?? websiteData?.coordinates,
    websiteUrl:
      websiteData?.websiteUrl ??
      googleData?.websiteUrl ??
      socialData?.websiteUrl,
  };

  // Detect missing critical fields
  const missingFields: string[] = [];
  if (!merged.name) missingFields.push("name");
  if (!merged.contactInfo.phone) missingFields.push("phone");
  if (!merged.contactInfo.email) missingFields.push("email");
  if (!merged.contactInfo.address) missingFields.push("address");
  if (!merged.openingHours.length) missingFields.push("openingHours");
  if (!merged.services.length) missingFields.push("services");
  if (!merged.description) missingFields.push("description");

  return {
    websiteData,
    googleData,
    socialData,
    merged,
    missingFields,
    errors: [],
  };
}

function deduplicateImages(images: ImageData[]): ImageData[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}
