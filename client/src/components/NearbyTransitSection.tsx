import { Bus, MapPin, ShoppingBag, Train, TrainFront } from "lucide-react";
import { useState } from "react";
import type { KosItem, TransitCategory } from "../types/kos";
import { getNearbyTransit } from "../utils/transitFinder";

const TAB_CONFIG: { id: TransitCategory; label: string; Icon: typeof Bus }[] = [
  { id: "busway", label: "HALTE BUSWAY", Icon: Bus },
  { id: "mrt", label: "MRT", Icon: TrainFront },
  { id: "krl", label: "KRL", Icon: Train },
  { id: "lrt", label: "LRT", Icon: TrainFront },
  { id: "mall", label: "MALL", Icon: ShoppingBag },
];

export function NearbyTransitSection({ item }: { item: KosItem }) {
  const info = getNearbyTransit(item);
  const defaultTab: TransitCategory =
    info?.nearest?.category && (info.categories[info.nearest.category]?.length || 0) > 0
      ? info.nearest.category
      : "busway";
  const [activeTab, setActiveTab] = useState<TransitCategory>(defaultTab);

  if (!info) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3.5 text-xs text-[var(--text-muted)] flex items-start gap-2">
        <MapPin className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
        <span>
          Koordinat GPS kos belum tersedia. Aktifkan <strong>Hitung jarak (OSM Geocode)</strong> saat scrape agar halte Busway, MRT, KRL &amp; LRT terdekat dihitung otomatis.
        </span>
      </div>
    );
  }

  const stops = info.categories[activeTab] || [];
  const activeMeta = TAB_CONFIG.find((t) => t.id === activeTab) || TAB_CONFIG[0];
  const ActiveIcon = activeMeta.Icon;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="text-xs font-semibold text-[var(--text-primary)]">Di Sekitar Kost:</div>

      <div className="flex flex-wrap gap-1.5">
        {TAB_CONFIG.map((tab) => {
          const count = (info.categories[tab.id] || []).length;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap cursor-pointer transition-colors ${
                selected
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1 opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>

      {stops.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-1">
          Tidak ada titik {activeMeta.label.toLowerCase()} tercatat dalam radius 10 km.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
          {stops.map((stop) => (
            <div key={stop.name} className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--accent)] shrink-0">
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] leading-snug truncate">
                  {stop.name}
                </div>
                <div className="text-xs font-mono-tabular text-[var(--text-muted)]">
                  {stop.distance_km.toFixed(1)} km
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

