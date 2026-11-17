import type { FilterState, KosItem } from "../types/kos";
import { getKosAttributes, itemMatchesFacility } from "./kosAttributes";
import { matchesTransitCriteria } from "./transitFinder";

export function formatIdr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "Hubungi";
  }
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function maskPhoneDisplay(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 8) return "••••";
  return `${digits.slice(0, 4)}-••••-${digits.slice(-4)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function computeSummaryMetrics(items: KosItem[]) {
  const validPrices = items
    .filter((it) => !it.price_suspect && typeof it.price === "number" && it.price >= 100_000)
    .map((it) => it.price as number);

  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const avgPrice =
    validPrices.length > 0
      ? Math.round(validPrices.reduce((acc, n) => acc + n, 0) / validPrices.length)
      : null;

  const distances = items
    .map((it) => it.distance_km)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  const nearestKm = distances.length > 0 ? Math.min(...distances) : null;

  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    const src = item.source || "lainnya";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const suspectCount = items.filter((it) => it.price_suspect).length;
  const highRiskCount = items.filter((it) => it.scam_risk?.level === "high").length;

  return { minPrice, avgPrice, nearestKm, sourceCounts, suspectCount, highRiskCount };
}

export function filterAndSortItems(items: KosItem[], filter: FilterState): KosItem[] {
  const q = filter.query.trim().toLowerCase();
  const aq = (filter.alamatQuery || "").trim().toLowerCase();
  const maxP = filter.maxPriceFilter ? Number(filter.maxPriceFilter) : null;

  const filtered = items.filter((item) => {
    if (filter.hideSuspectPrice && item.price_suspect) return false;
    if (filter.hideScamSuspects && item.scam_risk?.level === "high") return false;
    if (filter.source !== "all" && item.source !== filter.source) return false;

    if (filter.jenis !== "all") {
      const j = (item.jenis || "").toLowerCase();
      if (!j.includes(filter.jenis)) return false;
    }

    if (filter.kecamatan !== "all") {
      if ((item.kecamatan || "").trim().toLowerCase() !== filter.kecamatan.trim().toLowerCase()) {
        return false;
      }
    }

    if (maxP && Number.isFinite(maxP) && maxP > 0 && item.price && !item.price_suspect) {
      if (item.price > maxP) return false;
    }

    const attr = getKosAttributes(item);
    if (filter.freedom !== "all" && attr.freedom !== filter.freedom) return false;
    if (filter.pet !== "all") {
      if (filter.pet === "any_pet") {
        if (attr.pet !== "cat_only" && attr.pet !== "all_pets") return false;
      } else if (attr.pet !== filter.pet) {
        return false;
      }
    }
    if (filter.pasutri !== "all" && attr.pasutri !== filter.pasutri) return false;
    if (filter.priceTier !== "all" && attr.price_tier !== filter.priceTier) return false;
    if (filter.bathroom !== "all" && attr.bathroom !== filter.bathroom) return false;
    if (filter.kitchen !== "all" && attr.kitchen !== filter.kitchen) return false;
    if (!matchesTransitCriteria(item, filter.transumOnly, filter.transitMode, filter.transitMaxKm, attr)) {
      return false;
    }

    if (filter.facilities.length > 0) {
      const hasAll = filter.facilities.every((fac) => itemMatchesFacility(item, fac, attr));
      if (!hasAll) return false;
    }

    if (aq) {
      const addrBlob = [item.alamat, item.kelurahan, item.kecamatan]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!addrBlob.includes(aq)) return false;
    }

    if (q) {
      const textBlob = [
        item.title,
        item.nama_kost,
        item.kecamatan,
        item.kelurahan,
        item.alamat,
        item.deskripsi,
        item.fasilitas,
        ...(item.peraturan || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!textBlob.includes(q)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filter.sortBy === "rating_desc") {
      return (b.gmaps?.rating ?? -1) - (a.gmaps?.rating ?? -1);
    }
    if (filter.sortBy === "distance_asc") {
      return (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9);
    }
    if (filter.sortBy === "title_asc") {
      return (a.title || "").localeCompare(b.title || "");
    }
    const pa = a.price_suspect || !a.price ? 1e12 : a.price;
    const pb = b.price_suspect || !b.price ? 1e12 : b.price;
    return filter.sortBy === "price_desc" ? pb - pa : pa - pb;
  });
}

export function extractBadgeFacilities(item: KosItem): string[] {
  if (Array.isArray(item.fasilitas_list) && item.fasilitas_list.length > 0) {
    return item.fasilitas_list.slice(0, 3);
  }
  const blob = (item.fasilitas || "").toLowerCase();
  const checks = [
    ["ac", "AC"],
    ["wifi", "WiFi"],
    ["mandi dalam", "KM Dalam"],
    ["parkir motor", "Parkir Motor"],
    ["dapur", "Dapur"],
  ];
  return checks.filter(([needle]) => blob.includes(needle)).map(([, label]) => label).slice(0, 3);
}

