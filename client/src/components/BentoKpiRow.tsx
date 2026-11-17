import { Activity, AlertTriangle, MapPin, ShieldAlert, Square, Tag } from "lucide-react";
import type { KosItem, ScrapeJob } from "../types/kos";
import { computeSummaryMetrics, formatIdr } from "../utils/formatters";

interface BentoKpiRowProps {
  items: KosItem[];
  filteredCount: number;
  activeJob: ScrapeJob | null;
  onCancelJob: () => void;
}

export function BentoKpiRow({
  items,
  filteredCount,
  activeJob,
  onCancelJob,
}: BentoKpiRowProps) {
  const { minPrice, avgPrice, nearestKm, sourceCounts, suspectCount, highRiskCount } =
    computeSummaryMetrics(items);

  const isRunning = activeJob?.status === "running" || activeJob?.status === "queued";
  const pct =
    activeJob && activeJob.progress.total > 0
      ? Math.min(100, Math.round((activeJob.progress.current / activeJob.progress.total) * 100))
      : 0;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            Hasil Ditampilkan
          </span>
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-text)] whitespace-nowrap shrink-0">
            {filteredCount} / {items.length}
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight font-mono-tabular">
          {filteredCount} Kos
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--text-muted)]">
          {Object.entries(sourceCounts).map(([src, count]) => (
            <span key={src} className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 whitespace-nowrap shrink-0">
              {src}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            Harga Bulanan Valid
          </span>
          <Tag className="h-4 w-4 text-[var(--accent)] shrink-0" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight font-mono-tabular">
          {minPrice ? formatIdr(minPrice) : "-"}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span className="truncate">
            Rata-rata: {avgPrice ? formatIdr(avgPrice) : "-"}
          </span>
          {highRiskCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap shrink-0">
              <ShieldAlert className="h-3.5 w-3.5" />
              {highRiskCount} rawan penipuan
            </span>
          ) : suspectCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              {suspectCount} cek harga
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            Jarak Terdekat
          </span>
          <MapPin className="h-4 w-4 text-[var(--accent)] shrink-0" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight font-mono-tabular">
          {nearestKm !== null ? `${nearestKm.toFixed(2)} km` : "Belum diukur"}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)] truncate">
          {nearestKm !== null
            ? "Dihitung via Haversine ke titik target"
            : "Aktifkan Jarak saat mulai scrape baru"}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            Status Pipeline
          </span>
          <Activity className="h-4 w-4 text-[var(--accent)] shrink-0" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-base font-bold capitalize whitespace-nowrap">
            {activeJob ? activeJob.status : "Siap"}
          </span>
          {isRunning && (
            <button
              type="button"
              onClick={onCancelJob}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-muted)] truncate">
          {activeJob?.progress.message || "Pilih parameter di bawah lalu klik Mulai Scrape"}
        </p>
        {isRunning && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${Math.max(10, pct)}%` }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

