import {
  AlertTriangle,
  Bookmark,
  ExternalLink,
  Images,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Star,
  TrainFront,
} from "lucide-react";
import { useState } from "react";
import type { KosItem } from "../types/kos";
import { extractBadgeFacilities, formatIdr, maskPhoneDisplay } from "../utils/formatters";
import { getAttributeChips } from "../utils/kosAttributes";
import { formatNearestTransitLabel } from "../utils/transitFinder";
import { NoPhotoPlaceholder } from "./NoPhotoPlaceholder";

interface ListingBentoCardProps {
  item: KosItem;
  isSaved: boolean;
  maskContact: boolean;
  onSelect: (item: KosItem) => void;
  onToggleFavorite: (item: KosItem) => void;
}

export function ListingBentoCard({
  item,
  isSaved,
  maskContact,
  onSelect,
  onToggleFavorite,
}: ListingBentoCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const attrChips = getAttributeChips(item);
  const badges = extractBadgeFacilities(item).filter(
    (b) => !attrChips.some((c) => c.label.toLowerCase() === b.toLowerCase())
  );
  const locationText =
    [item.kelurahan, item.kecamatan].filter(Boolean).join(", ") || item.alamat || "Lokasi di detail";
  const nearestTransit = formatNearestTransitLabel(item);
  const rawContact = item.wa || item.hp || item.telp || "";
  const contactPreview = rawContact
    ? maskContact
      ? maskPhoneDisplay(rawContact)
      : rawContact
    : null;
  const heroPhoto = item.image_url || item.image_urls?.[0] || null;
  const photoCount = Math.max(item.image_urls?.length || 0, heroPhoto ? 1 : 0);
  const hasPhoto = Boolean(heroPhoto && !imgFailed);

  const badgePills = (overlay: boolean) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
          overlay
            ? "bg-black/65 text-white backdrop-blur-xs"
            : "border border-[var(--border-subtle)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
        }`}
      >
        {item.source}
      </span>
      {item.jenis && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${
            overlay
              ? "bg-black/55 text-white backdrop-blur-xs"
              : "border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 text-[var(--text-muted)]"
          }`}
        >
          {item.jenis}
        </span>
      )}
      {(typeof item.gmaps?.rating === "number" || typeof item.source_rating === "number") && (
        <span
          title={typeof item.gmaps?.rating === "number" ? "Rating Google Maps" : `Rating ${item.source}`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-bold font-mono-tabular text-white whitespace-nowrap shrink-0"
        >
          <Star className="h-3 w-3 fill-current" />
          <span>{(item.gmaps?.rating ?? item.source_rating)!.toFixed(1)}</span>
        </span>
      )}
      {item.scam_risk?.level === "high" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-xs font-bold text-white whitespace-nowrap shrink-0">
          <ShieldAlert className="h-3 w-3" />
          <span>Indikasi Penipuan</span>
        </span>
      )}
      {item.scam_risk?.level === "medium" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-white whitespace-nowrap shrink-0">
          <AlertTriangle className="h-3 w-3" />
          <span>Perlu Survei</span>
        </span>
      )}
    </div>
  );

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm transition-all hover:border-[var(--accent)]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect(item);
        }}
        className="relative aspect-[16/10] w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] cursor-pointer"
      >
        {hasPhoto ? (
          <img
            src={heroPhoto!}
            alt={item.title || "Foto kos"}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <NoPhotoPlaceholder />
        )}

        <div className="absolute left-3 top-3 right-12">{badgePills(hasPhoto)}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item);
          }}
          aria-label={isSaved ? "Hapus dari favorit" : "Simpan ke favorit"}
          className={`absolute right-3 top-3 rounded-full p-2 backdrop-blur-xs transition-colors cursor-pointer ${
            isSaved
              ? "bg-[var(--accent)] text-white"
              : hasPhoto
                ? "bg-black/55 text-white hover:bg-black/75"
                : "border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
        </button>

        {hasPhoto && item.image_source === "google_maps" && (
          <span className="absolute bottom-2.5 left-3 rounded-full bg-black/65 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
            Foto Google Maps
          </span>
        )}
        {hasPhoto && photoCount > 1 && (
          <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-xs">
            <Images className="h-3 w-3" />
            <span>{photoCount} foto</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div className="space-y-2.5">
          <div>
            <h3 className="text-base font-semibold leading-snug text-[var(--text-primary)] line-clamp-2">
              {item.title || item.nama_kost || item.slug}
            </h3>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1 min-w-0 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{locationText}</span>
              </span>
              {typeof item.distance_km === "number" && (
                <span className="font-mono-tabular font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0">
                  {item.distance_km.toFixed(2)} km
                </span>
              )}
            </div>
            {nearestTransit && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] truncate max-w-full">
                <TrainFront className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{nearestTransit}</span>
              </div>
            )}
          </div>

          {(attrChips.length > 0 || badges.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {attrChips.map((chip) => (
                <span
                  key={chip.label}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                    chip.tone === "accent"
                      ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                      : chip.tone === "amber"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                  }`}
                >
                  {chip.label}
                </span>
              ))}
              {badges.slice(0, Math.max(0, 6 - attrChips.length)).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="min-w-0">
            <div className="text-base font-bold font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
              {item.price ? formatIdr(item.price) : item.price_text || "Hubungi"}
            </div>
            {item.price_estimate_from_reviews ? (
              <div className="text-xs font-semibold text-[var(--accent-text)] truncate">
                Est. ulasan: ~{formatIdr(item.price_estimate_from_reviews)}
              </div>
            ) : item.promo_label || typeof item.available_room === "number" ? (
              <div className="text-xs text-[var(--text-muted)] truncate">
                {item.promo_label ||
                  (item.available_room === 0
                    ? "Daftar tunggu"
                    : `Tersedia ${item.available_room} kamar`)}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] truncate">
                {contactPreview ? `Kontak: ${contactPreview}` : item.nama_pemilik || "per bulan"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {item.wa_link && !maskContact && (
              <a
                href={item.wa_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>WA</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <span>Detail</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
