import { Play, Settings2, SlidersHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SOURCE_OPTIONS } from "../constants/sources";
import type { JobOptions, LandmarkRef, PresetArea } from "../types/kos";
import type { ScrapeSettingsState } from "./ScrapeSettingsModal";
import { TargetLimitField } from "./TargetLimitField";

interface ScrapeFormCardProps {
  areas: PresetArea[];
  landmarks: LandmarkRef[];
  settings: ScrapeSettingsState;
  isRunning: boolean;
  maskContactDefault: boolean;
  onOpenSettings: () => void;
  onStartJob: (options: JobOptions) => void;
}

export function ScrapeFormCard({
  areas,
  landmarks,
  settings,
  isRunning,
  maskContactDefault,
  onOpenSettings,
  onStartJob,
}: ScrapeFormCardProps) {
  const [area, setArea] = useState("jakarta-selatan");
  const [maxPrice, setMaxPrice] = useState("1500000");
  const [targetKos, setTargetKos] = useState("20");
  const [keywords, setKeywords] = useState("kemang,blok m,cipete,mampang");

  const activeLandmark = landmarks.find((l) => l.id === settings.landmarkId) || landmarks[0] || null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const limit = Math.min(300, Math.max(1, Number(targetKos) || 20));
    const pages = Math.min(15, Math.max(1, Number(settings.maxPages) || 6));
    onStartJob({
      sources: settings.sources,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      maxPages: pages,
      detailsLimit: limit,
      concurrency: Math.min(8, Math.max(1, Number(settings.concurrency) || 4)),
      sort: "default",
      order: "desc",
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      geocode: settings.enableGeo,
      gmaps: settings.enableGmaps,
      maskContact: maskContactDefault,
      keepHistory: settings.storageMode === "archive",
      storageMode: settings.storageMode,
      refLat: settings.enableGeo && activeLandmark ? activeLandmark.lat : null,
      refLon: settings.enableGeo && activeLandmark ? activeLandmark.lon : null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)] shrink-0" />
          <h2 className="text-sm font-semibold">Konfigurasi Scrape Baru</h2>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>
            Pengaturan ({settings.sources.length}/{SOURCE_OPTIONS.length} situs)
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Area</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {(areas.length > 0 ? areas : [{ slug: "jakarta-selatan", label: "Jakarta Selatan" }]).map(
              (a) => (
                <option key={a.slug} value={a.slug}>
                  {a.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-medium text-[var(--text-muted)]">
            Budget Maks (Rp)
          </span>
          <input
            type="number"
            min={100000}
            step={50000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="1500000"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-mono-tabular text-[var(--text-primary)]"
          />
        </label>

        <label className="space-y-1 sm:col-span-2 lg:col-span-3">
          <span className="block text-xs font-medium text-[var(--text-muted)]">
            Keyword Lokasi (pisah koma)
          </span>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="kemang, blok m, cipete"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>

        <TargetLimitField
          label="Target Jumlah Kos"
          value={targetKos}
          max={300}
          className="lg:col-span-3"
          onChange={setTargetKos}
        />

        <div className="flex flex-col justify-end lg:col-span-2">
          <button
            type="submit"
            disabled={isRunning}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isRunning ? "Berjalan..." : "Mulai Scrape"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>
          Acuan: <strong>{settings.enableGeo && activeLandmark ? activeLandmark.label : "Nonaktif"}</strong>
          {" · "}Maps: <strong>{settings.enableGmaps ? "Aktif" : "Mati"}</strong>
          {" · "}Workers: <strong>{settings.concurrency}</strong>
          {" · "}File:{" "}
          <strong>
            {settings.storageMode === "merge"
              ? "CRUD Upsert"
              : settings.storageMode === "archive"
              ? "Arsip baru"
              : "Timpa terbaru"}
          </strong>
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          Pilih sumber &amp; pengaturan lanjut →
        </button>
      </div>
    </form>
  );
}
