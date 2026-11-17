import { Bookmark, ExternalLink } from "lucide-react";
import type { KosItem } from "../types/kos";
import { formatIdr, maskPhoneDisplay } from "../utils/formatters";

interface ListingTableProps {
  items: KosItem[];
  savedUrls: Set<string>;
  maskContact: boolean;
  onSelect: (item: KosItem) => void;
  onToggleFavorite: (item: KosItem) => void;
}

export function ListingTable({
  items,
  savedUrls,
  maskContact,
  onSelect,
  onToggleFavorite,
}: ListingTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-3 whitespace-nowrap">Kos</th>
            <th className="px-4 py-3 whitespace-nowrap">Tipe</th>
            <th className="px-4 py-3 whitespace-nowrap">Area</th>
            <th className="px-4 py-3 whitespace-nowrap">Harga / Bln</th>
            <th className="px-4 py-3 whitespace-nowrap">Rating</th>
            <th className="px-4 py-3 whitespace-nowrap">Jarak</th>
            <th className="px-4 py-3 whitespace-nowrap">Kontak</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((item) => {
            const isSaved = savedUrls.has(item.url);
            const rawPhone = item.wa || item.hp || item.telp || "";
            const phone = rawPhone ? (maskContact ? maskPhoneDisplay(rawPhone) : rawPhone) : "-";
            return (
              <tr key={item.url} className="hover:bg-[var(--bg-subtle)]/60 transition-colors">
                <td className="px-4 py-3 max-w-xs">
                  <div className="font-semibold text-[var(--text-primary)] truncate">
                    {item.title || item.slug}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-muted)]">{item.source}</span>
                    {item.scam_risk?.level === "high" && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        Penipuan?
                      </span>
                    )}
                    {item.scam_risk?.level === "medium" && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        Waspada
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs">{item.jenis || "-"}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {[item.kelurahan, item.kecamatan].filter(Boolean).join(", ") || "-"}
                </td>
                <td className="px-4 py-3 font-mono-tabular font-semibold whitespace-nowrap">
                  <div>{item.price ? formatIdr(item.price) : item.price_text || "-"}</div>
                  {item.price_estimate_from_reviews && (
                    <div className="text-xs font-normal text-[var(--accent-text)]">
                      ~{formatIdr(item.price_estimate_from_reviews)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono-tabular text-xs whitespace-nowrap">
                  {typeof item.gmaps?.rating === "number" ? `${item.gmaps.rating.toFixed(1)}★` : "-"}
                </td>
                <td className="px-4 py-3 font-mono-tabular text-xs whitespace-nowrap">
                  {typeof item.distance_km === "number" ? `${item.distance_km.toFixed(2)} km` : "-"}
                </td>
                <td className="px-4 py-3 font-mono-tabular text-xs whitespace-nowrap">{phone}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(item)}
                      className={`rounded-lg p-1.5 cursor-pointer ${
                        isSaved ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--accent)] hover:text-white cursor-pointer"
                    >
                      <span>Detail</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

