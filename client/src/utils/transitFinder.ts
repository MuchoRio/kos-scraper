import transumHubs from "../../../shared/transum_hubs.json";
import type { KosAttributes, KosItem, NearbyStop, NearbyTransitInfo, TransitCategory } from "../types/kos";

const TRANSIT_MODES: TransitCategory[] = ["busway", "mrt", "krl", "lrt"];

const MODE_PATTERNS: Record<Exclude<TransitCategory, "mall">, RegExp> = {
  busway: /\b(?:transjakarta|busway|halte|tj|koridor)\b/i,
  mrt: /\b(?:mrt|lebak\s*bulus|cipete|blok\s*m|senayan|dukuh\s*atas)\b/i,
  krl: /\b(?:krl|commuter\s*line|stasiun)\b/i,
  lrt: /\b(?:lrt|rasuna|pancoran|cikoko)\b/i,
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const p1 = lat1 * rad;
  const p2 = lat2 * rad;
  const dp = (lat2 - lat1) * rad;
  const dl = (lon2 - lon1) * rad;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Number((6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))).toFixed(2));
}

export function getNearbyTransit(item: KosItem): NearbyTransitInfo | null {
  if (item.nearby_transit?.categories) {
    return item.nearby_transit;
  }
  if (
    typeof item.lat !== "number" ||
    typeof item.lon !== "number" ||
    !Number.isFinite(item.lat) ||
    !Number.isFinite(item.lon)
  ) {
    return null;
  }

  const hubs = transumHubs as Record<TransitCategory, { name: string; lat: number; lon: number }[]>;
  const categories = {} as Record<TransitCategory, NearbyStop[]>;
  let nearest: (NearbyStop & { category: TransitCategory }) | null = null;

  for (const cat of Object.keys(hubs) as TransitCategory[]) {
    const ranked = hubs[cat]
      .map((entry) => ({
        name: entry.name,
        distance_km: haversineKm(item.lat as number, item.lon as number, entry.lat, entry.lon),
      }))
      .filter((r) => r.distance_km <= 10)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 4);
    categories[cat] = ranked;
    if (TRANSIT_MODES.includes(cat) && ranked.length > 0) {
      const top = { category: cat, ...ranked[0] };
      if (!nearest || top.distance_km < nearest.distance_km) {
        nearest = top;
      }
    }
  }

  return { nearest, categories };
}

export function formatNearestTransitLabel(item: KosItem): string | null {
  const info = getNearbyTransit(item);
  const top = info?.nearest;
  if (!top) return null;
  const shortName = top.name
    .replace("Halte Transjakarta ", "TJ ")
    .replace("Stasiun KRL ", "KRL ")
    .replace("LRT ", "LRT ")
    .replace("MRT ", "MRT ");
  return `${shortName} (${top.distance_km.toFixed(1)} km)`;
}

export function matchesTransitCriteria(
  item: KosItem,
  transumOnly: boolean,
  transitMode: "all" | Exclude<TransitCategory, "mall">,
  transitMaxKm: string,
  attr: KosAttributes
): boolean {
  if (!transumOnly && transitMode === "all" && !transitMaxKm.trim()) {
    return true;
  }
  const maxKm = transitMaxKm.trim() ? Number(transitMaxKm) : null;
  const info = getNearbyTransit(item);
  const textBlob = [item.title, item.alamat, item.deskripsi, item.fasilitas]
    .filter(Boolean)
    .join(" ");

  if (info && info.nearest) {
    if (transitMode !== "all") {
      const stops = info.categories[transitMode] || [];
      if (stops.length === 0) return false;
      if (maxKm && Number.isFinite(maxKm) && stops[0].distance_km > maxKm) return false;
      return true;
    }
    const closestDist = info.nearest.distance_km;
    if (maxKm && Number.isFinite(maxKm)) return closestDist <= maxKm;
    return closestDist <= 2.5 || attr.transum;
  }

  if (maxKm && Number.isFinite(maxKm)) {
    return false;
  }
  if (transitMode !== "all") {
    return MODE_PATTERNS[transitMode].test(textBlob);
  }
  return attr.transum;
}

