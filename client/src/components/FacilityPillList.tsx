import {
  Bath,
  BedDouble,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  DoorClosed,
  Flame,
  ShieldCheck,
  Shirt,
  Snowflake,
  Tv,
  Utensils,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { KosItem } from "../types/kos";
import { categorizeItemFacilities, type FacilityEntry, type FacilityIconKey } from "../utils/facilityCatalog";

const ICON_MAP: Record<FacilityIconKey, LucideIcon> = {
  bed: BedDouble,
  bath: Bath,
  wifi: Wifi,
  wind: Wind,
  flame: Flame,
  snowflake: Snowflake,
  tv: Tv,
  door: DoorClosed,
  bike: Bike,
  car: Car,
  utensils: Utensils,
  shirt: Shirt,
  shield: ShieldCheck,
  clock: Clock,
  box: CheckCircle2,
};

export function FacilityIcon({ name, className = "h-3.5 w-3.5" }: { name: FacilityIconKey; className?: string }) {
  const Icon = ICON_MAP[name] || CheckCircle2;
  return <Icon className={className} />;
}

function PillRow({ title, entries }: { title: string; entries: FacilityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">{title}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            key={entry.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-2xs whitespace-nowrap"
          >
            <FacilityIcon name={entry.icon} className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <span>{entry.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function FacilitySections({ item }: { item: KosItem }) {
  const { room, building } = categorizeItemFacilities(item);
  if (room.length === 0 && building.length === 0) {
    return item.fasilitas ? <p className="text-xs text-[var(--text-muted)]">{item.fasilitas}</p> : null;
  }

  return (
    <div className="space-y-4">
      <PillRow title="Fasilitas Kamar" entries={room} />
      <PillRow title="Fasilitas & Layanan Gedung" entries={building} />
    </div>
  );
}

