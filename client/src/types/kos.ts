export type SourceId =
  | "sewakost"
  | "rukita"
  | "mamikos"
  | "infokost"
  | "cove"
  | "djuragankamar"
  | "rumah123"
  | "kostjakarta"
  | "resource";

export type WorkspaceMode = "scrape" | "resource";

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

export type ResourcePriceCategory = "all" | "murah" | "middle" | "premium";
export type ResourceAvailability = "available_or_unknown" | "strict_available" | "all";
export type ResourceQuality = "all" | "curated" | "top" | "worth_it" | "best_deal" | "standar";
export type ResourceGender = "all" | "campur" | "wanita" | "pria" | "bebas";
export type ResourcePetFilter = "all" | "pet_friendly" | "no_pet";

export interface ResourceInspectPayload {
  url: string;
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
  url: string;
  area: string;
  maxPrice: number | null;
  keywords: string[];
  detailsLimit: number;
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
  refLat: number | null;
  refLon: number | null;
}

export interface ScamRisk {
  level: "high" | "medium" | "low";
  score: number;
  signals: string[];
  warning_quotes: string[];
}

export interface GmapsReview {
  author: string;
  rating: number | null;
  relative_time: string;
  text: string;
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  pos_tags: string[];
  neg_tags: string[];
}

export interface GmapsThemeCount {
  tag: string;
  count: number;
}

export interface GmapsPriceClue {
  amount: number;
  formatted: string;
  quote: string;
  author?: string;
  rating?: number | null;
}

export interface GmapsInfo {
  status: string;
  engine: string;
  query: string;
  place_name?: string | null;
  rating?: number | null;
  review_count?: number | null;
  limited_view?: boolean;
  maps_url?: string | null;
  reason?: string | null;
  positive_reviews: GmapsReview[];
  negative_reviews: GmapsReview[];
  pros_summary: GmapsThemeCount[];
  cons_summary: GmapsThemeCount[];
  price_clues: GmapsPriceClue[];
  review_price_estimate?: number | null;
  review_price_estimate_text?: string | null;
}

export interface KosItem {
  source: SourceId | string;
  url: string;
  slug: string;
  title?: string | null;
  nama_kost?: string | null;
  price?: number | null;
  price_text?: string | null;
  price_options?: number[];
  price_suspect?: boolean;
  price_source?: string | null;
  over_budget?: boolean;
  jenis?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
  alamat?: string | null;
  deskripsi?: string | null;
  fasilitas?: string | null;
  fasilitas_list?: string[];
  peraturan?: string[];
  image_url?: string | null;
  image_urls?: string[];
  lat?: number | null;
  lon?: number | null;
  distance_km?: number | null;
  nama_pemilik?: string | null;
  telp?: string | null;
  hp?: string | null;
  wa?: string | null;
  wa_link?: string | null;
  kontak?: string[];
  area_match?: string[];
  is_featured?: boolean;
  gmaps?: GmapsInfo | null;
  price_estimate_from_reviews?: number | null;
  price_estimate_text?: string | null;
  scam_risk?: ScamRisk | null;
  attributes?: KosAttributes | null;
  nearby_transit?: NearbyTransitInfo | null;
  scraped_at?: string;
  error?: string;
}

export type TransitCategory = "busway" | "mrt" | "krl" | "lrt" | "mall";

export interface NearbyStop {
  name: string;
  distance_km: number;
}

export interface NearbyTransitInfo {
  nearest?: (NearbyStop & { category: TransitCategory }) | null;
  categories: Partial<Record<TransitCategory, NearbyStop[]>>;
}

export interface KosAttributes {
  freedom: "texas" | "non_texas" | "unknown";
  pet: "cat_only" | "all_pets" | "no_pet" | "unknown";
  pasutri: "pasutri" | "non_pasutri" | "unknown";
  transum: boolean;
  bathroom: "dalam" | "luar" | "unknown";
  kitchen: "yes" | "no" | "unknown";
  price_tier: "under_1m" | "mid" | "exclusive" | "unknown";
  wifi: boolean;
  ac: boolean;
  has_rules?: boolean;
}

export interface PresetArea {
  slug: string;
  label: string;
}

export interface LandmarkRef {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export interface ResultFile {
  name: string;
  ext: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface JobLogEntry {
  ts: string;
  message: string;
}

export interface JobProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface JobOptions {
  sources: SourceId[];
  area: string;
  maxPrice: number | null;
  maxPages: number;
  detailsLimit: number;
  sort: "default" | "price" | "newest";
  order: "asc" | "desc";
  keywords: string[];
  geocode: boolean;
  gmaps: boolean;
  maskContact: boolean;
  keepHistory?: boolean;
  refLat: number | null;
  refLon: number | null;
  concurrency?: number;
}

export interface ScrapeJob {
  id: string;
  options: JobOptions;
  status: JobStatus;
  progress: JobProgress;
  logs: JobLogEntry[];
  items: KosItem[];
  itemsCount: number;
  files: { list_json?: string; detail_json?: string; csv?: string } | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  query: string;
  alamatQuery: string;
  kecamatan: string;
  jenis: "all" | "putri" | "putra" | "campur";
  source: "all" | SourceId;
  freedom: "all" | "texas" | "non_texas";
  pet: "all" | "any_pet" | "cat_only" | "all_pets" | "no_pet";
  pasutri: "all" | "pasutri" | "non_pasutri";
  priceTier: "all" | "under_1m" | "mid" | "exclusive";
  bathroom: "all" | "dalam" | "luar";
  kitchen: "all" | "yes" | "no";
  transumOnly: boolean;
  transitMode: "all" | Exclude<TransitCategory, "mall">;
  transitMaxKm: string;
  maxPriceFilter: string;
  facilities: string[];
  hideSuspectPrice: boolean;
  hideScamSuspects: boolean;
  sortBy: "price_asc" | "price_desc" | "rating_desc" | "distance_asc" | "title_asc";
}

export type ThemePreference = "light" | "dark";
export type ViewMode = "bento" | "table";
