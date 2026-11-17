export type SourceId = "sewakost" | "rukita" | "mamikos" | "infokost" | "cove";

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
