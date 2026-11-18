import { Database, FileSpreadsheet, Link2, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ResourceServerPreset } from "../types/kos";

interface ResourceSourcePickerProps {
  sourceMode: "server" | "custom";
  presetId: string;
  url: string;
  presets: ResourceServerPreset[];
  inspecting: boolean;
  isRunning: boolean;
  onChangeMode: (next: "server" | "custom") => void;
  onChangePreset: (id: string) => void;
  onChangeUrl: (url: string) => void;
  onInspect: () => void;
  onSavePreset: (label: string, url: string) => Promise<void>;
  onDeletePreset: (id: string) => Promise<void>;
}

export function ResourceSourcePicker({
  sourceMode,
  presetId,
  url,
  presets,
  inspecting,
  isRunning,
  onChangeMode,
  onChangePreset,
  onChangeUrl,
  onInspect,
  onSavePreset,
  onDeletePreset,
}: ResourceSourcePickerProps) {
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveBox, setShowSaveBox] = useState(false);

  const handleSave = async () => {
    if (!saveLabel.trim() || !url.trim()) return;
    await onSavePreset(saveLabel, url);
    setSaveLabel("");
    setShowSaveBox(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[var(--accent)] shrink-0" />
          <h2 className="text-sm font-semibold">Riset Direktori Terpisah (Database Server &amp; Custom Sheet)</h2>
        </div>
        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-0.5 text-[11px]">
          {presets.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeMode("server")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
                sourceMode === "server"
                  ? "bg-[var(--bg-card)] text-[var(--accent-text)] shadow-sm"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Database className="h-3 w-3" />
              <span>Database Server ({presets.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onChangeMode("custom")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
              sourceMode === "custom"
                ? "bg-[var(--bg-card)] text-[var(--accent-text)] shadow-sm"
                : "text-[var(--text-muted)]"
            }`}
          >
            <Link2 className="h-3 w-3" />
            <span>Custom URL</span>
          </button>
        </div>
      </div>

      {sourceMode === "server" && presets.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={presetId}
            onChange={(e) => onChangePreset(e.target.value)}
            aria-label="Pilih sumber database server"
            className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.kind === "doc" ? "Google Doc" : "Google Sheet"} · URL tersimpan aman di server)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onDeletePreset(presetId)}
            title="Hapus sumber ini dari database server"
            aria-label="Hapus sumber database"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={inspecting || isRunning || !presetId}
            onClick={onInspect}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <Search className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>{inspecting ? "Membaca..." : "Cek Statistik"}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="Tempel link publik Google Sheets / Google Docs (https://docs.google.com/...)"
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={() => setShowSaveBox((v) => !v)}
              title="Simpan link ini ke database server agar URL tersembunyi"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium hover:border-[var(--accent)] cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Simpan ke Server</span>
            </button>
            <button
              type="button"
              disabled={inspecting || isRunning || !url.trim()}
              onClick={onInspect}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Search className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>{inspecting ? "Membaca..." : "Cek Statistik"}</span>
            </button>
          </div>
          {showSaveBox && (
            <div className="flex flex-col gap-2 sm:flex-row rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-2.5 text-xs">
              <input
                type="text"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Nama tampilan di server (cth: Direktori Kost Bandung)"
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5"
              />
              <button
                type="button"
                disabled={!saveLabel.trim() || !url.trim()}
                onClick={handleSave}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-semibold text-white disabled:opacity-50 cursor-pointer"
              >
                Simpan Tersembunyi di Server
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

