import { FileSpreadsheet, Play, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { LandmarkRef, PresetArea, ResourceInspectStats, ResourceJobOptions } from "../types/kos";
import { formatIdr } from "../utils/formatters";
import type { ScrapeSettingsState } from "./ScrapeSettingsModal";

const COMMUNITY_PRESETS = [
  {
    label: "Kostpedia DKI (11rb baris)",
    url: "https://docs.google.com/spreadsheets/d/1VwTJymN8n-h3CZwAuFu5kdNdwsUvZBoRuBOVDAZl7Jc/edit?gid=0#gid=0",
  },
  {
    label: "Kurasi Video (110 baris)",
    url: "https://docs.google.com/spreadsheets/d/1GRGV53lLVkzj7jfEHk3tHO1AjuHk4AC0ZMS3LYW8Wuo/edit?gid=0#gid=0",
  },
  {
    label: "Master Doc DKI (42 Kec.)",
    url: "https://docs.google.com/document/d/1j2J67Y5BrGZji9bRR3zkCcucEzEEK3LdR-E1jfKKldc/edit?tab=t.sbuhwwmpwo3p",
  },
];

interface ResourceAnalyzerCardProps {
  areas: PresetArea[];
  landmarks: LandmarkRef[];
  settings: ScrapeSettingsState;
  inspecting: boolean;
  inspectStats: ResourceInspectStats | null;
  isRunning: boolean;
  maskContactDefault: boolean;
  onInspect: (payload: { url: string; area: string; maxPrice: number | null; keywords: string[] }) => void;
  onRun: (options: ResourceJobOptions) => void;
}

export function ResourceAnalyzerCard({
  areas,
  landmarks,
  settings,
  inspecting,
  inspectStats,
  isRunning,
  maskContactDefault,
  onInspect,
  onRun,
}: ResourceAnalyzerCardProps) {
  const [url, setUrl] = useState(COMMUNITY_PRESETS[0].url);
  const [area, setArea] = useState("jakarta-selatan");
  const [maxPrice, setMaxPrice] = useState("1500000");
  const [keywords, setKeywords] = useState("mampang, kemang, pancoran, tebet");
  const [targetCount, setTargetCount] = useState("20");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [deduplicate, setDeduplicate] = useState(true);
  const [includeUnpriced, setIncludeUnpriced] = useState(false);

  const parsedKws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const activeLandmark = landmarks.find((l) => l.id === settings.landmarkId) || landmarks[0] || null;

  const triggerInspect = (overrideUrl?: string) => {
    onInspect({
      url: overrideUrl || url,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      keywords: parsedKws,
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onRun({
      url,
      area,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      keywords: parsedKws,
      detailsLimit: Math.min(60, Math.max(1, Number(targetCount) || 20)),
      concurrency: Math.min(6, Math.max(1, Number(settings.concurrency) || 4)),
      onlyAvailable,
      deduplicate,
      includeUnpriced,
      geocode: settings.enableGeo,
      gmaps: settings.enableGmaps,
      maskContact: maskContactDefault,
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
          <FileSpreadsheet className="h-4 w-4 text-[var(--accent)] shrink-0" />
          <h2 className="text-sm font-semibold">Riset Direktori Terpisah (Google Sheet &amp; Docs)</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {COMMUNITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setUrl(p.url);
                triggerInspect(p.url);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                url === p.url
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Tempel link publik Google Sheets / Google Docs (https://docs.google.com/...)"
          className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <button
          type="button"
          disabled={inspecting || isRunning}
          onClick={() => triggerInspect()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <Search className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>{inspecting ? "Membaca..." : "Cek Statistik"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1">
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

        <label className="space-y-1">
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

        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Filter Kecamatan / Kata Kunci</span>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="mampang, kemang, tebet"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm"
          />
        </label>

        <div className="space-y-1">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Batas Enrich</span>
          <div className="flex items-center gap-1.5">
            {["10", "20", "40"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetCount(preset)}
                className={`flex-1 rounded-xl border py-2 text-xs font-semibold font-mono-tabular cursor-pointer ${
                  targetCount === preset
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{isRunning ? "Memproses..." : "Analisa & Enrich"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
          <span>Hanya kos tersedia</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
          <span>Hapus baris duplikat</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={includeUnpriced} onChange={(e) => setIncludeUnpriced(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
          <span>Sertakan baris belum ada harga</span>
        </label>
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

