import type { FilterState, KosAttributes, KosItem } from "../types/kos";

export const DEFAULT_FILTER: FilterState = {
  query: "",
  alamatQuery: "",
  kecamatan: "all",
  jenis: "all",
  source: "all",
  freedom: "all",
  pet: "all",
  pasutri: "all",
  priceTier: "all",
  bathroom: "all",
  kitchen: "all",
  transumOnly: false,
  transitMode: "all",
  transitMaxKm: "",
  maxPriceFilter: "",
  facilities: [],
  hideSuspectPrice: false,
  hideScamSuspects: false,
  sortBy: "price_asc",
};

export function countActiveFilters(filter: FilterState): number {
  let count = 0;
  if (filter.kecamatan !== "all") count += 1;
  if (filter.jenis !== "all") count += 1;
  if (filter.source !== "all") count += 1;
  if (filter.freedom !== "all") count += 1;
  if (filter.pet !== "all") count += 1;
  if (filter.pasutri !== "all") count += 1;
  if (filter.priceTier !== "all") count += 1;
  if (filter.bathroom !== "all") count += 1;
  if (filter.kitchen !== "all") count += 1;
  if (filter.transumOnly) count += 1;
  if (filter.transitMode !== "all") count += 1;
  if (filter.transitMaxKm.trim()) count += 1;
  if (filter.alamatQuery.trim()) count += 1;
  if (filter.maxPriceFilter.trim()) count += 1;
  count += filter.facilities.length;
  if (filter.hideSuspectPrice) count += 1;
  if (filter.hideScamSuspects) count += 1;
  return count;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  clear: (f: FilterState) => FilterState;
}

export function getActiveFilterChips(filter: FilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filter.kecamatan !== "all") chips.push({ key: "kec", label: `Kec: ${filter.kecamatan}`, clear: (f) => ({ ...f, kecamatan: "all" }) });
  if (filter.jenis !== "all") chips.push({ key: "jenis", label: `Tipe: ${filter.jenis}`, clear: (f) => ({ ...f, jenis: "all" }) });
  if (filter.priceTier !== "all") chips.push({ key: "tier", label: filter.priceTier === "under_1m" ? "Under 1 Jt" : filter.priceTier === "exclusive" ? "Exclusive" : "1–2,5 Jt", clear: (f) => ({ ...f, priceTier: "all" }) });
  if (filter.freedom !== "all") chips.push({ key: "free", label: filter.freedom === "texas" ? "Texas / 24J" : "Bebas Sopan", clear: (f) => ({ ...f, freedom: "all" }) });
  if (filter.pet !== "all") chips.push({ key: "pet", label: `Pet: ${filter.pet.replace("_", " ")}`, clear: (f) => ({ ...f, pet: "all" }) });
  if (filter.pasutri !== "all") chips.push({ key: "pas", label: filter.pasutri === "pasutri" ? "Pasutri OK" : "Non-Pasutri", clear: (f) => ({ ...f, pasutri: "all" }) });
  if (filter.bathroom !== "all") chips.push({ key: "km", label: filter.bathroom === "dalam" ? "KM Dalam" : "KM Luar", clear: (f) => ({ ...f, bathroom: "all" }) });
  if (filter.kitchen !== "all") chips.push({ key: "kit", label: filter.kitchen === "yes" ? "Ada Dapur" : "Tanpa Dapur", clear: (f) => ({ ...f, kitchen: "all" }) });
  if (filter.transumOnly) chips.push({ key: "trn", label: "Transum Friendly", clear: (f) => ({ ...f, transumOnly: false }) });
  if (filter.transitMode !== "all") chips.push({ key: "tmode", label: `Moda: ${filter.transitMode.toUpperCase()}`, clear: (f) => ({ ...f, transitMode: "all" }) });
  if (filter.transitMaxKm.trim()) chips.push({ key: "tkm", label: `Transum ≤ ${filter.transitMaxKm} km`, clear: (f) => ({ ...f, transitMaxKm: "" }) });
  if (filter.alamatQuery.trim()) chips.push({ key: "alm", label: `Alamat: ${filter.alamatQuery}`, clear: (f) => ({ ...f, alamatQuery: "" }) });
  if (filter.maxPriceFilter.trim()) chips.push({ key: "maxp", label: `≤ Rp ${Number(filter.maxPriceFilter).toLocaleString("id-ID")}`, clear: (f) => ({ ...f, maxPriceFilter: "" }) });
  for (const fac of filter.facilities) {
    chips.push({ key: `fac:${fac}`, label: fac, clear: (f) => ({ ...f, facilities: f.facilities.filter((x) => x !== fac) }) });
  }
  if (filter.hideSuspectPrice) chips.push({ key: "hsp", label: "Harga Valid", clear: (f) => ({ ...f, hideSuspectPrice: false }) });
  if (filter.hideScamSuspects) chips.push({ key: "hsc", label: "Bebas Penipuan", clear: (f) => ({ ...f, hideScamSuspects: false }) });
  return chips;
}

function buildBlob(item: KosItem): string {
  return [
    item.title,
    item.nama_kost,
    item.jenis,
    item.alamat,
    item.deskripsi,
    item.fasilitas,
    ...(item.fasilitas_list || []),
    ...(item.peraturan || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Derive normalized Indonesian kos attributes with backend-first priority and
 * client-side fallback for legacy JSON files created prior to v2 attributes.
 */
export function getKosAttributes(item: KosItem): KosAttributes {
  if (item.attributes) {
    return item.attributes;
  }

  const blob = buildBlob(item);
  const rulesText = (item.peraturan || []).join(" ").trim();

  const hasTexas =
    /\b(?:texas|akses\s*24\s*jam|24\s*jam|bebas\s*(?:24|keluar\s*masuk|jam\s*malam)|tanpa\s*jam\s*malam|jam\s*malam\s*:\s*tidak)\b/.test(
      blob
    );
  const hasNonTexas =
    /\b(?:bebas\s*sopan|non[\s-]*texas|syariah|muslim(?:ah)?|jam\s*malam\s*:\s*ya|ada\s*jam\s*malam|dilarang\s*tamu|tamu\s*menginap\s*dilarang)\b/.test(
      blob
    );
  const freedom: KosAttributes["freedom"] =
    hasNonTexas && !hasTexas ? "non_texas" : hasTexas ? "texas" : "unknown";

  const noPet =
    /\b(?:tidak\s*pet\s*friendly|bukan\s*pet\s*friendly|non[\s-]*pet|dilarang\s*(?:bawa\s*|pelihara\s*)?(?:hewan|binatang|kucing|anjing)|tidak\s*boleh\s*(?:bawa\s*|pelihara\s*)?(?:hewan|kucing|anjing)|no\s*pets?)\b/.test(
      blob
    );
  const catHit = /\b(?:cat\s*only|cat\s*friendly|boleh\s*(?:bawa\s*)?kucing|khusus\s*kucing)\b/.test(blob);
  const dogHit = /\b(?:dog\s*friendly|boleh\s*(?:bawa\s*)?anjing)\b/.test(blob);
  const generalPet =
    /\b(?:pet\s*friendly|boleh\s*(?:bawa\s*|pelihara\s*)?(?:hewan|binatang\s*peliharaan))\b/.test(blob);
  let pet: KosAttributes["pet"] = "unknown";
  if (noPet) pet = "no_pet";
  else if (catHit && !dogHit && !generalPet) pet = "cat_only";
  else if (dogHit || generalPet || (catHit && dogHit)) pet = "all_pets";

  const noPasutri =
    /\b(?:pasutri\s*:\s*tidak|tidak\s*(?:boleh\s*)?pasutri|bukan\s*pasutri|non[\s-]*pasutri|khusus\s*lajang|1\s*org|max\s*1\s*orang)\b/.test(
      blob
    );
  const yesPasutri =
    !noPasutri &&
    /\b(?:pasutri\s*:\s*ya|kost?\s*pasutri|boleh\s*pasutri|bisa\s*pasutri|terima\s*pasutri|pasangan\s*suami\s*istri)\b/.test(
      blob
    );
  const jenisLower = (item.jenis || "").toLowerCase();
  const pasutri: KosAttributes["pasutri"] = yesPasutri
    ? "pasutri"
    : noPasutri || jenisLower.includes("putri") || jenisLower.includes("putra")
      ? "non_pasutri"
      : "unknown";

  const transum =
    /\b(?:mrt|lrt|krl|commuter\s*line|stasiun|transjakarta|busway|halte|jaklingko|tj|terminal)\b/.test(
      blob
    );

  const kmDalam = /\b(?:kamar\s*mandi\s*dalam|k\.?\s*mandi\s*dalam|km\s*dalam|private\s*bath(?:room)?)\b/.test(blob);
  const kmLuar = /\b(?:kamar\s*mandi\s*luar|k\.?\s*mandi\s*luar|km\s*luar|share\s*bath(?:room)?|kamar\s*mandi\s*bersama)\b/.test(blob);
  const bathroom: KosAttributes["bathroom"] =
    kmDalam && !kmLuar ? "dalam" : kmLuar && !kmDalam ? "luar" : kmDalam ? "dalam" : "unknown";

  const noKitchen = /\b(?:tidak\s*ada\s*dapur|tanpa\s*dapur)\b/.test(blob);
  const hasKitchen = !noKitchen && /\b(?:dapur|kompor|kitchen|pantry)\b/.test(blob);
  const kitchen: KosAttributes["kitchen"] = hasKitchen ? "yes" : noKitchen ? "no" : "unknown";

  const validPrice = typeof item.price === "number" && !item.price_suspect && item.price >= 100_000;
  const exclLabel = /\b(?:eksklusif|exclusive|kostel|coliving|vip|luxury)\b/.test(blob);
  let price_tier: KosAttributes["price_tier"] = "unknown";
  if (validPrice && (item.price as number) <= 1_000_000) price_tier = "under_1m";
  else if ((validPrice && (item.price as number) > 2_500_000) || exclLabel) price_tier = "exclusive";
  else if (validPrice) price_tier = "mid";

  const wifi = /\b(?:wi-?fi|internet)\b/.test(blob) && !/\bfree\s*wifi\s*tidak\b/.test(blob);
  const ac = /\b(?:ac|aircon|pendingin)\b/.test(blob) && !/\bnon[\s-]*ac\b/.test(blob);

  return {
    freedom,
    pet,
    pasutri,
    transum,
    bathroom,
    kitchen,
    price_tier,
    wifi,
    ac,
    has_rules: Boolean(rulesText),
  };
}

export function extractUniqueKecamatan(items: KosItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const raw = (item.kecamatan || "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) seen.set(key, raw);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "id"));
}

export function itemMatchesFacility(item: KosItem, fac: string, attr: KosAttributes): boolean {
  const key = fac.toLowerCase();
  const blob = buildBlob(item);
  if (key === "free wifi" || key === "wifi") {
    return attr.wifi || /\b(?:free\s*wi-?fi|wi-?fi|wifi|internet)\b/.test(blob);
  }
  if (key === "ac") return attr.ac || /\b(?:ac|air\s*conditioner)\b/.test(blob);
  if (key === "kamar mandi dalam") return attr.bathroom === "dalam";
  if (key === "akses 24 jam") return attr.freedom === "texas" || blob.includes("24 jam");
  return blob.includes(key);
}

export function getAttributeChips(item: KosItem): { label: string; tone: "accent" | "neutral" | "amber" }[] {
  const attr = getKosAttributes(item);
  const chips: { label: string; tone: "accent" | "neutral" | "amber" }[] = [];

  if (attr.freedom === "texas") chips.push({ label: "Texas / 24J", tone: "accent" });
  else if (attr.freedom === "non_texas") chips.push({ label: "Bebas Sopan", tone: "neutral" });

  if (attr.pet === "cat_only") chips.push({ label: "Cat Only", tone: "accent" });
  else if (attr.pet === "all_pets") chips.push({ label: "Pet Friendly", tone: "accent" });
  else if (attr.pet === "no_pet") chips.push({ label: "No Pet", tone: "neutral" });

  if (attr.pasutri === "pasutri") chips.push({ label: "Pasutri OK", tone: "amber" });
  if (attr.transum) chips.push({ label: "Transum", tone: "accent" });

  if (attr.bathroom === "dalam") chips.push({ label: "KM Dalam", tone: "neutral" });
  else if (attr.bathroom === "luar") chips.push({ label: "KM Luar", tone: "neutral" });

  if (attr.kitchen === "yes") chips.push({ label: "Dapur", tone: "neutral" });
  if (attr.price_tier === "under_1m") chips.push({ label: "Under 1 Jt", tone: "accent" });
  else if (attr.price_tier === "exclusive") chips.push({ label: "Exclusive", tone: "amber" });

  return chips.slice(0, 5);
}

