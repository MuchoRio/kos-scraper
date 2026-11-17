import { Building2, Crown, Sparkles, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FilterState, KosItem } from "../types/kos";
import { filterAndSortItems } from "../utils/formatters";
import { DEFAULT_FILTER } from "../utils/kosAttributes";
import { FilterModalSections } from "./FilterModalSections";

interface FilterModalProps {
  isOpen: boolean;
  filter: FilterState;
  items: KosItem[];
  kecamatanOptions: string[];
  onClose: () => void;
  onApply: (next: FilterState) => void;
}

const SORT_OPTIONS: { id: FilterState["sortBy"]; label: string }[] = [
  { id: "price_asc", label: "Harga terendah" },
  { id: "price_desc", label: "Harga tertinggi" },
  { id: "rating_desc", label: "Rating Google Maps tertinggi" },
  { id: "distance_asc", label: "Jarak terdekat" },
  { id: "title_asc", label: "Nama A–Z" },
];

const SEGMENT_CARDS: {
  id: Exclude<FilterState["priceTier"], "all">;
  label: string;
  hint: string;
  Icon: typeof Wallet;
}[] = [
  { id: "under_1m", label: "Under Sejuta", hint: "≤ Rp 1 Jt / bln", Icon: Wallet },
  { id: "mid", label: "Menengah", hint: "Rp 1 – 2,5 Jt", Icon: Building2 },
  { id: "exclusive", label: "Exclusive / VIP", hint: "> Rp 2,5 Jt / Coliving", Icon: Crown },
];

const JENIS_OPTIONS: { id: FilterState["jenis"]; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "putra", label: "Putra" },
  { id: "putri", label: "Putri" },
  { id: "campur", label: "Campur" },
];

export function FilterModal({
  isOpen,
  filter,
  items,
  kecamatanOptions,
  onClose,
  onApply,
}: FilterModalProps) {
  const [draft, setDraft] = useState<FilterState>(filter);

  useEffect(() => {
    if (isOpen) setDraft(filter);
  }, [isOpen, filter]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const previewCount = useMemo(
    () => (isOpen ? filterAndSortItems(items, draft).length : 0),
    [isOpen, items, draft]
  );

  if (!isOpen) return null;

  const handleResetDraft = () => {
    setDraft({ ...DEFAULT_FILTER, query: draft.query });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter Kos Lanjutan"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup filter"
            className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold text-[var(--text-primary)]">Filter</h2>
          <span className="w-8" aria-hidden="true" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Urutkan</h3>
            <div className="space-y-1.5">
              {SORT_OPTIONS.map((opt) => {
                const selected = draft.sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, sortBy: opt.id })}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left text-sm cursor-pointer hover:bg-[var(--bg-subtle)]/60"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 transition-colors ${
                        selected
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--border-subtle)] bg-transparent"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className={selected ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]"}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Segmen &amp; Budget</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {SEGMENT_CARDS.map(({ id, label, hint, Icon }) => {
                const active = draft.priceTier === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, priceTier: active ? "all" : id })
                    }
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left cursor-pointer transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/60"
                        : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)]/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <span className="text-[var(--text-muted)] whitespace-nowrap">Batas Harga Maks (Rp):</span>
              <input
                type="number"
                min={100000}
                step={100000}
                value={draft.maxPriceFilter}
                onChange={(e) => setDraft({ ...draft, maxPriceFilter: e.target.value })}
                placeholder="Opsional, misal 2000000"
                className="w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 font-mono-tabular text-xs text-[var(--text-primary)]"
              />
            </label>
          </section>

          <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Hunian Khusus</h3>
            <div className="flex flex-wrap gap-2">
              {JENIS_OPTIONS.map((opt) => {
                const active = draft.jenis === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, jenis: opt.id })}
                    className={`rounded-full border px-4 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold"
                        : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <FilterModalSections
            draft={draft}
            kecamatanOptions={kecamatanOptions}
            onChange={setDraft}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={handleResetDraft}
            className="text-sm font-semibold text-[var(--text-primary)] underline underline-offset-4 hover:opacity-75 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-canvas)] hover:opacity-90 cursor-pointer transition-opacity"
          >
            Terapkan Filter ({previewCount})
          </button>
        </div>
      </div>
    </div>
  );
}
