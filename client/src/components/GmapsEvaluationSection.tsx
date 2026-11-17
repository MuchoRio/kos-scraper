import { ExternalLink, Info, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import type { KosItem } from "../types/kos";
import { formatIdr } from "../utils/formatters";

interface GmapsEvaluationSectionProps {
  item: KosItem;
}

export function GmapsEvaluationSection({ item }: GmapsEvaluationSectionProps) {
  const gm = item.gmaps;
  const [tab, setTab] = useState<"positive" | "negative">("positive");
  if (!gm) return null;

  const posList = gm.positive_reviews || [];
  const negList = gm.negative_reviews || [];
  const activeReviews = tab === "positive" ? posList : negList;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Evaluasi Google Maps
          </span>
          {typeof gm.rating === "number" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold font-mono-tabular text-amber-600 dark:text-amber-400 whitespace-nowrap">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>{gm.rating.toFixed(1)}</span>
              {typeof gm.review_count === "number" && (
                <span className="font-normal opacity-80">({gm.review_count})</span>
              )}
            </span>
          )}
        </div>

        {gm.maps_url && (
          <a
            href={gm.maps_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline whitespace-nowrap"
          >
            <span>Buka di Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {gm.review_price_estimate && (
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)]/50 p-3 space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--accent-text)]">
              Clue Harga dari Komentar Penghuni
            </span>
            <span className="font-bold font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
              ~{formatIdr(gm.review_price_estimate)}/bln
            </span>
          </div>
          {gm.price_clues?.[0]?.quote && (
            <p className="text-xs italic text-[var(--text-muted)]">
              &ldquo;...{gm.price_clues[0].quote}...&rdquo;
            </p>
          )}
        </div>
      )}

      {(gm.pros_summary?.length > 0 || gm.cons_summary?.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 space-y-1.5">
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>Poin Positif</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {gm.pros_summary.length > 0 ? (
                gm.pros_summary.map((t) => (
                  <span
                    key={t.tag}
                    className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                  >
                    {t.tag} ({t.count})
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Belum ada pola</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 space-y-1.5">
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <ThumbsDown className="h-3.5 w-3.5" />
              <span>Bahan Evaluasi (Negatif)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {gm.cons_summary.length > 0 ? (
                gm.cons_summary.map((t) => (
                  <span
                    key={t.tag}
                    className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300 whitespace-nowrap"
                  >
                    {t.tag} ({t.count})
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Tidak ada keluhan</span>
              )}
            </div>
          </div>
        </div>
      )}

      {posList.length > 0 || negList.length > 0 ? (
        <div className="space-y-2">
          <div className="flex gap-1.5 border-b border-[var(--border-subtle)] pb-2">
            <button
              type="button"
              onClick={() => setTab("positive")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                tab === "positive"
                  ? "bg-emerald-600 text-white"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)]"
              }`}
            >
              Positif ({posList.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("negative")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                tab === "negative"
                  ? "bg-rose-600 text-white"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)]"
              }`}
            >
              Negatif ({negList.length})
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {activeReviews.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Tidak ada komentar kategori ini pada sampel ulasan.
              </p>
            ) : (
              activeReviews.map((rev, i) => (
                <div
                  key={`${rev.author}-${i}`}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {rev.author}
                    </span>
                    <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">
                      {rev.rating ? `${rev.rating}★` : ""} {rev.relative_time}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">{rev.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 text-xs text-[var(--text-muted)]">
          <Info className="h-4 w-4 shrink-0 text-[var(--accent)] mt-0.5" />
          <span>
            {gm.limited_view
              ? "Tampilan terbatas Google Maps tanpa login menyembunyikan teks ulasan. Masukkan Google Places API Key saat scrape jika ingin menarik komentar lengkap & estimasi harga otomatis."
              : gm.reason || "Belum ada ulasan tertulis di Google Maps untuk properti ini."}
          </span>
        </div>
      )}
    </div>
  );
}

