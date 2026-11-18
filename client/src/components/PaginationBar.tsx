import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 20;

interface PaginationBarProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (nextPage: number) => void;
}

export function PaginationBar({
  page,
  totalItems,
  pageSize = PAGE_SIZE,
  onPageChange,
}: PaginationBarProps) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  const visiblePages: number[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
      visiblePages.push(p);
    }
  }

  return (
    <nav
      aria-label="Navigasi halaman hasil kos"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-xs shadow-sm"
    >
      <div className="text-[var(--text-muted)]">
        Menampilkan <strong className="font-mono-tabular text-[var(--text-primary)]">{start}–{end}</strong> dari{" "}
        <strong className="font-mono-tabular text-[var(--text-primary)]">{totalItems}</strong> kos
        {totalPages > 1 && (
          <span className="ml-1.5 font-mono-tabular">
            (Hal {safePage}/{totalPages})
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 font-medium hover:border-[var(--accent)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Sebelumnya</span>
          </button>

          {visiblePages.map((p, idx) => {
            const prev = visiblePages[idx - 1];
            const showGap = prev !== undefined && p - prev > 1;
            return (
              <span key={p} className="inline-flex items-center gap-1.5">
                {showGap && <span className="px-1 text-[var(--text-muted)]">…</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === safePage ? "page" : undefined}
                  className={`min-w-8 rounded-xl border px-2.5 py-1.5 font-mono-tabular font-semibold cursor-pointer transition-colors ${
                    p === safePage
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--accent)]"
                  }`}
                >
                  {p}
                </button>
              </span>
            );
          })}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 font-medium hover:border-[var(--accent)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
}
