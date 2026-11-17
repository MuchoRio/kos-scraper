import { Bath, RotateCcw, Search, SlidersHorizontal, TrainFront, Wallet, X } from "lucide-react";
import type { FilterState } from "../types/kos";
import { countActiveFilters, getActiveFilterChips } from "../utils/kosAttributes";

interface LiveFilterBarProps {
  filter: FilterState;
  kecamatanOptions: string[];
  onChange: (next: FilterState) => void;
  onReset: () => void;
  onOpenModal: () => void;
}

export function LiveFilterBar({
  filter,
  kecamatanOptions,
  onChange,
  onReset,
  onOpenModal,
}: LiveFilterBarProps) {
  const activeCount = countActiveFilters(filter);
  const activeChips = activeCount > 0 ? getActiveFilterChips(filter) : [];
  const underOneM = filter.priceTier === "under_1m";
  const transum = filter.transumOnly;
  const kmDalam = filter.bathroom === "dalam";

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
      active
        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold"
        : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
    }`;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 shadow-sm space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            placeholder="Cari nama kos, jalan, alamat, atau fasilitas..."
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <select
          value={filter.kecamatan}
          onChange={(e) => onChange({ ...filter, kecamatan: e.target.value })}
          aria-label="Pilih Kecamatan"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
        >
          <option value="all">Semua Kecamatan</option>
          {kecamatanOptions.map((kec) => (
            <option key={kec} value={kec}>
              {kec}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...filter, priceTier: underOneM ? "all" : "under_1m" })}
            className={pillClass(underOneM)}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Under 1 Jt</span>
          </button>

          <button
            type="button"
            onClick={() => onChange({ ...filter, transumOnly: !transum })}
            className={pillClass(transum)}
          >
            <TrainFront className="h-3.5 w-3.5" />
            <span>Transum</span>
          </button>

          <button
            type="button"
            onClick={() => onChange({ ...filter, bathroom: kmDalam ? "all" : "dalam" })}
            className={pillClass(kmDalam)}
          >
            <Bath className="h-3.5 w-3.5" />
            <span>KM Dalam</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              title="Reset semua filter"
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenModal}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeCount > 0
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filter Lanjutan</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold leading-none text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2">
          <span className="text-xs text-[var(--text-muted)] mr-1">Filter aktif:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange(chip.clear(filter))}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap cursor-pointer transition-colors"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3 opacity-70" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
