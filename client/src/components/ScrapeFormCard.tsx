import { ChevronDown, ChevronUp, Play, SlidersHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { JobOptions, LandmarkRef, PresetArea, SourceId } from "../types/kos";
import { ScrapeAdvancedSection } from "./ScrapeAdvancedSection";

interface ScrapeFormCardProps {
  areas: PresetArea[];
  landmarks: LandmarkRef[];
  isRunning: boolean;
  maskContactDefault: boolean;
  hasServerMapsKey: boolean;
  mapsApiKey: string;
  onChangeMapsApiKey: (key: string) => void;
  onStartJob: (options: JobOptions) => void;
}

const SOURCE_OPTIONS: { id: SourceId; label: string }[] = [
  { id: "sewakost", label: "sewakost.com" },
  { id: "rukita", label: "rukita.co" },
  { id: "mamikos", label: "mamikos.com" },
  { id: "infokost", label: "infokost.id" },
  { id: "cove", label: "cove.id" },
];

export function ScrapeFormCard({
  areas,
  landmarks,
  isRunning,
  maskContactDefault,
  hasServerMapsKey,
  mapsApiKey,
  onChangeMapsApiKey,
  onStartJob,
}: ScrapeFormCardProps) {
  const [sources, setSources] = useState<SourceId[]>(["sewakost", "rukita", "mamikos"]);
  const [area, setArea] = useState("jakarta-selatan");
  const [maxPrice, setMaxPrice] = useState("1500000");
  const [targetKos, setTargetKos] = useState("20");
  const [maxPages, setMaxPages] = useState("6");
  const [concurrency, setConcurrency] = useState("4");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keywords, setKeywords] = useState("kemang,blok m,cipete,mampang");
  const [landmarkId, setLandmarkId] = useState("bank-mega");
  const [enableGeo, setEnableGeo] = useState(true);
  const [enableGmaps, setEnableGmaps] = useState(true);

  const toggleSource = (src: SourceId) => {
    setSources((prev) =>
      prev.includes(src)
        ? prev.length > 1
          ? prev.filter((s) => s !== src)
          : prev
        : [...prev, src]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ref = landmarks.find((l) => l.id === landmarkId) || landmarks[0] || null;
    const limit = Math.min(60, Math.max(1, Number(targetKos) || 20));
    const pages = showAdvanced
      ? Math.min(15, Math.max(1, Number(maxPages) || 6))
      : Math.max(4, Math.min(8, Math.ceil(limit / 5)));
    onStartJob({
      sources,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      maxPages: pages,
      detailsLimit: limit,
      concurrency: Math.min(8, Math.max(1, Number(concurrency) || 4)),
      sort: "default",
      order: "desc",
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      geocode: enableGeo,
      gmaps: enableGmaps,
      maskContact: maskContactDefault,
      refLat: enableGeo && ref ? ref.lat : null,
      refLon: enableGeo && ref ? ref.lon : null,
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

        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCE_OPTIONS.map((opt) => {
            const active = sources.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleSource(opt.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          <span
            title="99.co/id mengembalikan tantangan Cloudflare (HTTP 403) dan tidak di-bypass"
            className="rounded-lg border border-dashed border-[var(--border-subtle)] px-2 py-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0"
          >
            99.co (Cloudflare)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1">
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

        <label className="space-y-1">
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

        <label className="space-y-1 sm:col-span-2">
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

        <div className="space-y-1">
          <span className="block text-xs font-medium text-[var(--text-muted)]">
            Target Jumlah Kos
          </span>
          <div className="flex items-center gap-1.5">
            {["10", "20", "40"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetKos(preset)}
                className={`flex-1 rounded-xl border py-2 text-xs font-semibold font-mono-tabular cursor-pointer whitespace-nowrap ${
                  targetKos === preset
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-end">
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGeo}
              onChange={(e) => setEnableGeo(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Hitung jarak (OSM Geocode)</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGmaps}
              onChange={(e) => setEnableGmaps(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Rating, Evaluasi &amp; Anti-Penipuan Maps</span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1 font-medium hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <span>Opsi Lanjutan</span>
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {enableGeo && landmarks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap">Titik acuan:</span>
            <select
              value={landmarkId}
              onChange={(e) => setLandmarkId(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
            >
              {landmarks.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  {lm.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ScrapeAdvancedSection
        showAdvanced={showAdvanced}
        maxPages={maxPages}
        targetKos={targetKos}
        concurrency={concurrency}
        onChangeMaxPages={setMaxPages}
        onChangeTargetKos={setTargetKos}
        onChangeConcurrency={setConcurrency}
        enableGmaps={enableGmaps}
        hasServerMapsKey={hasServerMapsKey}
        mapsApiKey={mapsApiKey}
        onChangeMapsApiKey={onChangeMapsApiKey}
      />
    </form>
  );
}
