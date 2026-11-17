import type { KosItem } from "../types/kos";

export type FacilityIconKey =
  | "bed"
  | "bath"
  | "wifi"
  | "wind"
  | "flame"
  | "snowflake"
  | "tv"
  | "door"
  | "bike"
  | "car"
  | "utensils"
  | "shirt"
  | "shield"
  | "clock"
  | "box";

export interface FacilityEntry {
  label: string;
  icon: FacilityIconKey;
}

export interface FacilityFilterOption {
  id: string;
  label: string;
  icon: FacilityIconKey;
}

export const ROOM_FACILITY_FILTERS: FacilityFilterOption[] = [
  { id: "Free WiFi", label: "Free WiFi", icon: "wifi" },
  { id: "AC", label: "AC", icon: "wind" },
  { id: "Kamar Mandi Dalam", label: "Kamar Mandi Dalam", icon: "bath" },
  { id: "Water Heater", label: "Water Heater", icon: "flame" },
  { id: "Kulkas", label: "Kulkas", icon: "snowflake" },
  { id: "Kasur", label: "Kasur / Springbed", icon: "bed" },
  { id: "Lemari", label: "Lemari", icon: "door" },
  { id: "TV", label: "TV", icon: "tv" },
];

export const BUILDING_FACILITY_FILTERS: FacilityFilterOption[] = [
  { id: "Parkir Motor", label: "Parkir Motor", icon: "bike" },
  { id: "Parkir Mobil", label: "Parkir Mobil", icon: "car" },
  { id: "Dapur", label: "Dapur Bersama", icon: "utensils" },
  { id: "Laundry", label: "Laundry", icon: "shirt" },
  { id: "CCTV", label: "CCTV / Keamanan", icon: "shield" },
  { id: "Akses 24 Jam", label: "Akses 24 Jam", icon: "clock" },
];

const ROOM_KEYWORDS: [RegExp, FacilityIconKey][] = [
  [/kasur|bantal|sprei|spring\s*bed|bed/i, "bed"],
  [/kamar\s*mandi|km\s*(dalam|luar)|kloset|toilet|shower|wastafel/i, "bath"],
  [/water\s*heater|pemanas\s*air|air\s*panas/i, "flame"],
  [/\bac\b|air\s*cond|pendingin/i, "wind"],
  [/kulkas|dispenser|minibar/i, "snowflake"],
  [/wi-?fi|internet/i, "wifi"],
  [/\btv\b|televisi|smart\s*tv/i, "tv"],
  [/lemari|meja|kursi|jendela|balkon|exhaust/i, "door"],
];

const BUILDING_KEYWORDS: [RegExp, FacilityIconKey][] = [
  [/motor|sepeda/i, "bike"],
  [/mobil|garage|garasi|carport/i, "car"],
  [/dapur|kompor|pantry|kitchen|ruang\s*makan/i, "utensils"],
  [/laundry|cuci|mesin\s*cuci|jemur/i, "shirt"],
  [/cctv|satpam|security|keamanan|penjaga|smart\s*lock|kartu\s*akses/i, "shield"],
  [/24\s*jam|bebas|akses|ruang\s*tamu|rooftop|gym|kolam/i, "clock"],
];

function inferIcon(label: string, rules: [RegExp, FacilityIconKey][]): FacilityIconKey {
  for (const [rx, icon] of rules) {
    if (rx.test(label)) return icon;
  }
  return "box";
}

function isBuildingFacility(label: string): boolean {
  if (/parkir|dapur|kompor|pantry|laundry|cuci|jemur|cctv|satpam|security|penjaga|ruang\s*tamu|rooftop|24\s*jam|umum|bersama/i.test(label)) {
    return true;
  }
  return false;
}

export function categorizeItemFacilities(item: KosItem): {
  room: FacilityEntry[];
  building: FacilityEntry[];
} {
  const rawList =
    item.fasilitas_list && item.fasilitas_list.length > 0
      ? item.fasilitas_list
      : (item.fasilitas || "")
          .split(/[,•|/\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 2 && s.length <= 45);

  const seen = new Set<string>();
  const room: FacilityEntry[] = [];
  const building: FacilityEntry[] = [];

  for (const raw of rawList) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);

    if (isBuildingFacility(label)) {
      building.push({ label, icon: inferIcon(label, BUILDING_KEYWORDS) });
    } else {
      room.push({ label, icon: inferIcon(label, ROOM_KEYWORDS) });
    }
  }

  return { room, building };
}

