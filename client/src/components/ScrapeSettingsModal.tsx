import { FileSpreadsheet, Globe, Settings2, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SOURCE_OPTIONS } from "../constants/sources";
import type { LandmarkRef, SourceId, WorkspaceMode } from "../types/kos";
import {
  ResourceSettingsSection,
  StorageModeSection,
  type ResourceSettingsValues,
} from "./ResourceSettingsSection";

export interface ScrapeSettingsState extends ResourceSettingsValues {
  sources: SourceId[];
  maxPages: string;
  concurrency: string;
  landmarkId: string;
  enableGeo: boolean;
  enableGmaps: boolean;
  keepHistory: boolean;
}

interface ScrapeSettingsModalProps {
  isOpen: boolean;
  activeMode: WorkspaceMode;
  settings: ScrapeSettingsState;
  landmarks: LandmarkRef[];
  hasServerMapsKey: boolean;
  mapsApiKey: string;
  onChange: (next: ScrapeSettingsState) => void;
  onChangeMapsApiKey: (key: string) => void;
  onClose: () => void;
}

export function ScrapeSettingsModal({
  isOpen,
  activeMode,
  settings,
  landmarks,
  hasServerMapsKey,
  mapsApiKey,
  onChange,
  onChangeMapsApiKey,
  onClose,
}: ScrapeSettingsModalProps) {
  const [tab, setTab] = useState<WorkspaceMode>(activeMode);

  useEffect(() => {
    if (isOpen) setTab(activeMode);
  }, [isOpen, activeMode]);

  if (!isOpen) return null;

  const toggleSource = (id: SourceId) => {
    const exists = settings.sources.includes(id);
    if (exists && settings.sources.length <= 1) return;
    onChange({
      ...settings,
      sources: exists ? settings.sources.filter((s) => s !== id) : [...settings.sources, id],
    });
  };

  const selectAllSources = () =>
    onChange({ ...settings, sources: SOURCE_OPTIONS.map((s) => s.id) });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold">Pengaturan Sumber, Filter &amp; Penyimpanan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-5 py-2 text-xs">
          <button
            type="button"
            onClick={() => setTab("scrape")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
              tab === "scrape"
                ? "bg-[var(--bg-card)] text-[var(--accent-text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Sumber Web &amp; Mesin</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("resource")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
              tab === "resource"
                ? "bg-[var(--bg-card)] text-[var(--accent-text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Filter Resource (Sheet &amp; Doc)</span>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          {tab === "resource" ? (
            <ResourceSettingsSection
              values={settings}
              onChange={(patch) => onChange({ ...settings, ...patch })}
            />
          ) : (
            <>
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Sumber Website ({settings.sources.length}/{SOURCE_OPTIONS.length} aktif)
              </h3>
              <button
                type="button"
                onClick={selectAllSources}
                className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                Aktifkan Semua
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SOURCE_OPTIONS.map((opt) => {
                const active = settings.sources.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/60"
                        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSource(opt.id)}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)]">{opt.label}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{opt.note}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Konkurrensi &amp; Jarak</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-[var(--text-muted)]">Maks Halaman/Sumber</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={settings.maxPages}
                  onChange={(e) => onChange({ ...settings, maxPages: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[var(--text-muted)]">Workers Parallel</span>
                <select
                  value={settings.concurrency}
                  onChange={(e) => onChange({ ...settings, concurrency: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5"
                >
                  <option value="2">2 thread (Halus)</option>
                  <option value="4">4 thread (Seimbang)</option>
                  <option value="6">6 thread (Cepat)</option>
                  <option value="8">8 thread (Maks)</option>
                </select>
              </label>
              {landmarks.length > 0 && (
                <label className="space-y-1">
                  <span className="block text-[var(--text-muted)]">Titik Acuan Jarak</span>
                  <select
                    value={settings.landmarkId}
                    onChange={(e) => onChange({ ...settings, landmarkId: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5"
                  >
                    {landmarks.map((lm) => (
                      <option key={lm.id} value={lm.id}>
                        {lm.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableGeo}
                  onChange={(e) => onChange({ ...settings, enableGeo: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>Hitung jarak (OSM Geocode)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableGmaps}
                  onChange={(e) => onChange({ ...settings, enableGmaps: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>Rating, Evaluasi &amp; Anti-Penipuan Maps</span>
              </label>
            </div>

            {settings.enableGmaps && !hasServerMapsKey && (
              <div className="space-y-1 pt-1">
                <span className="block font-medium text-[var(--text-primary)]">
                  Google Places API Key (opsional)
                </span>
                <input
                  type="password"
                  value={mapsApiKey}
                  onChange={(e) => onChangeMapsApiKey(e.target.value)}
                  placeholder="Kosongkan untuk mode Chrome lokal (rating + link Maps)"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs"
                />
                <p className="text-[11px] text-[var(--text-muted)]">
                  Hanya disimpan di sesi browser untuk menarik teks ulasan lengkap &amp; deteksi komentar penipuan.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-3 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>Status Situs Tidak Tersedia (Tanpa Bypass Anti-Bot)</span>
            </div>
            <p>
              <strong>99.co</strong> (Cloudflare 403), <strong>Trovit</strong> (HTTP 401), dan{" "}
              <strong>Papikost</strong> (HTTP 403 / papikos.com 0-byte) memblokir akses terotomasi;{" "}
              <strong>IdKos</strong> timeout/404; <strong>JajanKost</strong> hanya Jogja/Jatim &amp;
              /search HTTP 500.
            </p>
          </section>
            </>
          )}

          <StorageModeSection
            keepHistory={settings.keepHistory}
            onChange={(keepHistory) => onChange({ ...settings, keepHistory })}
          />
        </div>

        <div className="flex justify-end border-t border-[var(--border-subtle)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Simpan &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
