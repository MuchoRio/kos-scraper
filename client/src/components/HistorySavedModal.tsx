import { Bookmark, ExternalLink, FileJson, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import type { KosItem, ResultFile } from "../types/kos";
import { formatBytes, formatIdr } from "../utils/formatters";

interface HistorySavedModalProps {
  mode: "history" | "saved" | null;
  files: ResultFile[];
  activeFile: string | null;
  favorites: KosItem[];
  onClose: () => void;
  onLoadFile: (filename: string) => void;
  onSelectKos: (item: KosItem) => void;
  onToggleFavorite: (item: KosItem) => void;
}

export function HistorySavedModal({
  mode,
  files,
  activeFile,
  favorites,
  onClose,
  onLoadFile,
  onSelectKos,
  onToggleFavorite,
}: HistorySavedModalProps) {
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const jsonFiles = files.filter((f) => f.ext === "json");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-base font-bold">
            {mode === "history" ? "Riwayat Hasil Scrape (hasil/)" : `Kos Favorit (${favorites.length})`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-2.5">
          {mode === "history" ? (
            jsonFiles.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Belum ada arsip JSON di folder hasil/.</p>
            ) : (
              jsonFiles.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => {
                    onLoadFile(file.name);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                    activeFile === file.name
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/50"
                      : "border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileJson className="h-4 w-4 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold font-mono-tabular truncate">{file.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {new Date(file.modifiedAt).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono-tabular text-[var(--text-muted)] whitespace-nowrap shrink-0">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </button>
              ))
            )
          ) : favorites.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              <Bookmark className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Belum ada kos favorit tersimpan. Klik ikon bookmark di kartu kos untuk membandingkan di sini.
            </div>
          ) : (
            favorites.map((item) => (
              <div
                key={item.url}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{item.title || item.slug}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {item.source} • {[item.kelurahan, item.kecamatan].filter(Boolean).join(", ") || item.alamat}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold font-mono-tabular whitespace-nowrap">
                    {item.price ? formatIdr(item.price) : "-"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectKos(item);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--accent)] hover:text-white cursor-pointer"
                  >
                    <span>Detail</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item)}
                    aria-label="Hapus favorit"
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

