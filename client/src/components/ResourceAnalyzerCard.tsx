import { Play, Settings2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type {
  LandmarkRef,
  PresetArea,
  ResourceInspectPayload,
  ResourceInspectStats,
  ResourceJobOptions,
  ResourceServerPreset,
} from "../types/kos";
import { formatIdr } from "../utils/formatters";
import { ResourceSourcePicker } from "./ResourceSourcePicker";
import type { ScrapeSettingsState } from "./ScrapeSettingsModal";
import { TargetLimitField } from "./TargetLimitField";

interface ResourceAnalyzerCardProps {
  areas: PresetArea[];
  landmarks: LandmarkRef[];
  presets: ResourceServerPreset[];
  settings: ScrapeSettingsState;
  inspecting: boolean;
  inspectStats: ResourceInspectStats | null;
  isRunning: boolean;
  maskContactDefault: boolean;
  onOpenSettings: () => void;
  onInspect: (payload: ResourceInspectPayload) => void;
  onRun: (options: ResourceJobOptions) => void;
  onSavePreset: (label: string, url: string) => Promise<string | null>;
  onDeletePreset: (id: string) => Promise<void>;
}

export function ResourceAnalyzerCard({
  areas,
  landmarks,
  presets,
  settings,
  inspecting,
  inspectStats,
  isRunning,
  maskContactDefault,
  onOpenSettings,
  onInspect,
  onRun,
  onSavePreset,
  onDeletePreset,
}: ResourceAnalyzerCardProps) {
  const [sourceMode, setSourceMode] = useState<"server" | "custom">(presets.length > 0 ? "server" : "custom");
  const [presetId, setPresetId] = useState(presets[0]?.id || "");
  const [url, setUrl] = useState("");
  const [area, setArea] = useState("jakarta-selatan");
  const [maxPrice, setMaxPrice] = useState("1500000");
  const [keywords, setKeywords] = useState("mampang, kemang, pancoran, tebet");
  const [targetCount, setTargetCount] = useState("20");

  useEffect(() => {
    if (presets.length > 0) {
      if (!presets.some((p) => p.id === presetId)) {
        setPresetId(presets[0].id);
        setSourceMode("server");
      }
    } else if (sourceMode === "server") {
      setSourceMode("custom");
    }
  }, [presets, presetId, sourceMode]);

  const parsedKws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const activeLandmark = landmarks.find((l) => l.id === settings.landmarkId) || landmarks[0] || null;
  const activeTarget = sourceMode === "server" && presetId ? { presetId } : { url };

  const triggerInspect = () => {
    if (sourceMode === "custom" && !url.trim()) return;
    if (sourceMode === "server" && !presetId) return;
    onInspect({
      ...activeTarget,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      keywords: parsedKws,
      priceCategory: settings.resourcePriceCategory,
      availability: settings.resourceAvailability,
      quality: settings.resourceQuality,
      gender: settings.resourceGender,
      pet: settings.resourcePet,
      deduplicate: settings.resourceDeduplicate,
      includeUnpriced: settings.resourceIncludeUnpriced || !maxPrice,
    });
  };

  const handleSavePreset = async (label: string, rawUrl: string) => {
    const savedId = await onSavePreset(label, rawUrl);
    if (savedId) {
      setPresetId(savedId);
      setSourceMode("server");
      setUrl("");
    }
  };

  const parsedDetailsLimit =
    targetCount === "all" || targetCount === "0"
      ? 0
      : Math.min(25000, Math.max(1, Number(targetCount) || 20));
  const parsedLiveLimit = Math.max(0, Math.min(25000, Number(settings.resourceLiveEnrichLimit) || 0));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (sourceMode === "server" && !presetId) return;
    onRun({
      ...activeTarget,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      keywords: parsedKws,
      detailsLimit: parsedDetailsLimit,
      liveEnrichLimit: parsedLiveLimit,
      concurrency: Math.min(6, Math.max(1, Number(settings.concurrency) || 4)),
      onlyAvailable: settings.resourceAvailability !== "all",
      deduplicate: settings.resourceDeduplicate,
      includeUnpriced: settings.resourceIncludeUnpriced,
      priceCategory: settings.resourcePriceCategory,
      availability: settings.resourceAvailability,
      quality: settings.resourceQuality,
      gender: settings.resourceGender,
      pet: settings.resourcePet,
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
      <ResourceSourcePicker
        sourceMode={sourceMode}
        presetId={presetId}
        url={url}
        presets={presets}
        inspecting={inspecting}
        isRunning={isRunning}
        onChangeMode={setSourceMode}
        onChangePreset={setPresetId}
        onChangeUrl={setUrl}
        onInspect={triggerInspect}
        onSavePreset={handleSavePreset}
        onDeletePreset={onDeletePreset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Area Target</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
          >
            <option value="all">Semua Area di Sheet</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Budget Maks (Rp)</span>
          <input
            type="number"
            min={100000}
            step={50000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="1500000"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-mono-tabular"
          />
        </label>

        <label className="space-y-1 sm:col-span-2 lg:col-span-3">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Filter Kecamatan / Kata Kunci</span>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="mampang, kemang, tebet"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
          />
        </label>

        <TargetLimitField
          label="Target Data"
          value={targetCount}
          max={25000}
          presets={["50", "200", "1000"]}
          allowAll
          className="lg:col-span-3"
          onChange={setTargetCount}
        />

        <div className="flex flex-col justify-end lg:col-span-2">
          <button
            type="submit"
            disabled={isRunning}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isRunning ? "Memproses..." : "Analisa & Enrich"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>
          Kategori: <strong>{settings.resourcePriceCategory}</strong>
          {" · "}Status: <strong>{settings.resourceAvailability === "strict_available" ? "Ketat Tersedia" : settings.resourceAvailability === "all" ? "Semua" : "Tersedia/Kosong"}</strong>
          {settings.resourceQuality !== "all" && <> · Kualitas: <strong>{settings.resourceQuality}</strong></>}
          {settings.resourceGender !== "all" && <> · Gender: <strong>{settings.resourceGender}</strong></>}
          {settings.resourcePet !== "all" && <> · Pet: <strong>{settings.resourcePet}</strong></>}
          {" · "}Enrich Live: <strong>{parsedLiveLimit === 0 ? "Semua" : `${parsedLiveLimit} teratas`}</strong>
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
          className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          <Settings2 className="h-3 w-3" />
          <span>Filter Kategori &amp; Pengaturan →</span>
        </button>
      </div>

      {inspectStats && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-3 text-xs sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <div className="text-[var(--text-muted)]">Total Baris</div>
            <div className="font-bold font-mono-tabular">{inspectStats.total_rows.toLocaleString("id-ID")}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Cocok Filter</div>
            <div className="font-bold text-[var(--accent-text)] font-mono-tabular">{inspectStats.filtered_count.toLocaleString("id-ID")}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Budget ≤ 1,5 Jt</div>
            <div className="font-bold font-mono-tabular">{inspectStats.under_1_5m_count.toLocaleString("id-ID")} ({formatIdr(inspectStats.median_price)} med)</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Maps / Foto</div>
            <div className="font-bold font-mono-tabular">{inspectStats.with_maps_count.toLocaleString("id-ID")} / {inspectStats.with_photo_count.toLocaleString("id-ID")}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Duplikat / Tanpa WA</div>
            <div className="font-bold font-mono-tabular">{inspectStats.duplicate_rows} / {inspectStats.empty_contact_count}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Skema Terdeteksi</div>
            <div className="font-semibold truncate">{inspectStats.schema}</div>
          </div>
        </div>
      )}
    </form>
  );
}

