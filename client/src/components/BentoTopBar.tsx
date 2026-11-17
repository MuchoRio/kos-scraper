import {
  Bookmark,
  Download,
  Eye,
  EyeOff,
  History,
  Home,
  LayoutGrid,
  Moon,
  Sun,
  Table2,
} from "lucide-react";
import type { ThemePreference, ViewMode } from "../types/kos";

interface BentoTopBarProps {
  theme: ThemePreference;
  onToggleTheme: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  maskContact: boolean;
  onToggleMaskContact: () => void;
  favoritesCount: number;
  onOpenSaved: () => void;
  onOpenHistory: () => void;
  onExportCsv: () => void;
  canExport: boolean;
  activeFile: string | null;
}

export function BentoTopBar({
  theme,
  onToggleTheme,
  viewMode,
  onChangeViewMode,
  maskContact,
  onToggleMaskContact,
  favoritesCount,
  onOpenSaved,
  onOpenHistory,
  onExportCsv,
  canExport,
  activeFile,
}: BentoTopBarProps) {
  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
                KosHunt Studio
              </h1>
              {activeFile && (
                <span className="hidden sm:inline-flex items-center rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] font-mono-tabular whitespace-nowrap shrink-0">
                  {activeFile}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate">
              Scraper multi-sumber & kurasi pencarian kos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
            <button
              type="button"
              onClick={() => onChangeViewMode("bento")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === "bento"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Bento</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === "table"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Tabel</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleMaskContact}
            title="Sensor atau tampilkan nomor kontak pemilik"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {maskContact ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{maskContact ? "Kontak Disensor" : "Kontak Terbuka"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>Riwayat</span>
          </button>

          <button
            type="button"
            onClick={onOpenSaved}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Bookmark className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Favorit ({favoritesCount})</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Ubah tema warna"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          <button
            type="button"
            disabled={!canExport}
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}

