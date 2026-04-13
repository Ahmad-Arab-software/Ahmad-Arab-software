// Stage 1: client input
export interface ClientInput {
  websiteUrl?: string;
  googleBusinessUrl?: string;
  socialMediaLinks?: string[];
}

// Stage 2: scraped data per source
export interface BusinessData {
  name?: string;
  tagline?: string;
  description?: string;
  services?: Service[];
  contactInfo?: ContactInfo;
  openingHours?: OpeningHours[];
  images?: ImageData[];
  colors?: ColorPalette;
  fonts?: string[];
  language?: string;
  category?: string;
  reviews?: Review[];
  coordinates?: GeoCoordinates;
  websiteUrl?: string;
  source: DataSource;
}

export interface Service {
  name: string;
  description?: string;
  price?: string;
}

export interface ContactInfo {
  address?: string;
  phone?: string;
  email?: string;
}

export interface OpeningHours {
  day: string;
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface ImageData {
  url: string;
  alt?: string;
  type?: "hero" | "interior" | "team" | "food" | "product" | "other";
}

export interface ColorPalette {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
  accent?: string;
}

export interface Review {
  author?: string;
  rating: number;
  text?: string;
  date?: string;
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export type DataSource = "website" | "google_business" | "social_media";

// Priority order for conflict resolution:
// 1. google_business (most up-to-date contact data)
// 2. website (most authoritative for copy/services)
// 3. social_media (supplementary)
export const SOURCE_PRIORITY: DataSource[] = [
  "google_business",
  "website",
  "social_media",
];

// Stage 2 result: merged data from all sources
export interface ScrapeResult {
  websiteData?: BusinessData;
  googleData?: BusinessData;
  socialData?: BusinessData;
  merged: MergedBusinessData;
  missingFields: string[];
  errors: ScrapeError[];
}

export interface ScrapeError {
  source: DataSource | string;
  message: string;
}

// Final merged business data used for Stage 3
export interface MergedBusinessData {
  name?: string;
  tagline?: string;
  description?: string;
  services: Service[];
  contactInfo: ContactInfo;
  openingHours: OpeningHours[];
  images: ImageData[];
  colors?: ColorPalette;
  fonts: string[];
  language?: string;
  category?: string;
  reviews: Review[];
  coordinates?: GeoCoordinates;
  websiteUrl?: string;
  socialLinks?: string[];
}

// Stage 3: design document (AI-generated, human-reviewed)
export interface DesignDocument {
  businessOverview: string;
  targetAudience: string;
  designStyle: string;
  colorScheme: ColorPalette;
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  sections: PageSection[];
  tone: string;
  language: string;
  missingData?: MissingField[];
}

export interface PageSection {
  id: string;
  name: string;
  included: boolean;
  content?: string;
}

export interface MissingField {
  field: string;
  label: string;
  value?: string;
}

// Full pipeline state
export interface PipelineState {
  step: "intake" | "scraping" | "review" | "output";
  clientInput: ClientInput;
  scrapeResult?: ScrapeResult;
  designDocument?: DesignDocument;
}
