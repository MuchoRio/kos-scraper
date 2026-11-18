export type StorageMode = "replace" | "merge" | "archive";
export type ResourcePriceCategory = "all" | "murah" | "middle" | "premium";
export type ResourceAvailability = "available_or_unknown" | "strict_available" | "all";
export type ResourceQuality = "all" | "curated" | "top" | "worth_it" | "best_deal" | "standar";
export type ResourceGender = "all" | "campur" | "wanita" | "pria" | "bebas";
export type ResourcePetFilter = "all" | "pet_friendly" | "no_pet";

export interface ResourceServerPreset {
  id: string;
  label: string;
  kind: "sheet" | "doc";
}

export interface ResourceInspectStats {
  kind: "sheet" | "doc";
  schema: string;
  total_rows: number;
  filtered_count: number;
  duplicate_rows: number;
  empty_contact_count: number;
  with_contact_count: number;
  with_price_count: number;
  under_1_5m_count: number;
  under_1m_count: number;
  min_price: number | null;
  median_price: number | null;
  max_price: number | null;
  with_maps_count: number;
  with_photo_count: number;
  available_count: number;
  full_count: number;
  sub_docs_count: number;
  top_cities: [string, number][];
  top_kecamatan: [string, number][];
}

export interface ResourceInspectPayload {
  url?: string;
  presetId?: string;
  area: string;
  maxPrice: number | null;
  keywords: string[];
  priceCategory?: ResourcePriceCategory;
  availability?: ResourceAvailability;
  quality?: ResourceQuality;
  gender?: ResourceGender;
  pet?: ResourcePetFilter;
  deduplicate?: boolean;
  includeUnpriced?: boolean;
}

export interface ResourceJobOptions {
  url?: string;
  presetId?: string;
  area: string;
  maxPrice: number | null;
  keywords: string[];
  detailsLimit: number;
  liveEnrichLimit?: number;
  concurrency: number;
  onlyAvailable: boolean;
  deduplicate: boolean;
  includeUnpriced: boolean;
  priceCategory: ResourcePriceCategory;
  availability: ResourceAvailability;
  quality: ResourceQuality;
  gender: ResourceGender;
  pet: ResourcePetFilter;
  geocode: boolean;
  gmaps: boolean;
  maskContact: boolean;
  keepHistory: boolean;
  storageMode: StorageMode;
  refLat: number | null;
  refLon: number | null;
}

