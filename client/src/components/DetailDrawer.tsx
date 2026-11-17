import {
  AlertTriangle,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DetailGallery } from "./DetailGallery";
import { FacilitySections } from "./FacilityPillList";
import { GmapsEvaluationSection } from "./GmapsEvaluationSection";
import { NearbyTransitSection } from "./NearbyTransitSection";
import { ScamAlertBanner } from "./ScamAlertBanner";
import type { KosItem } from "../types/kos";
import { formatIdr, maskPhoneDisplay } from "../utils/formatters";
import { distanceToLandmarkKm } from "../utils/transitFinder";

interface DetailDrawerProps {
  item: KosItem | null;
  isSaved: boolean;
  maskContact: boolean;
  onClose: () => void;
  onToggleFavorite: (item: KosItem) => void;
}

export function DetailDrawer({
  item,
  isSaved,
  maskContact,
  onClose,
  onToggleFavorite,
}: DetailDrawerProps) {
  const [revealLocal, setRevealLocal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRevealLocal(false);
    setCopied(false);
  }, [item?.url]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const hideNumber = maskContact && !revealLocal;
  const primaryPhone = item.wa || item.hp || item.telp || "";
  const shownPhone = primaryPhone
    ? hideNumber
      ? maskPhoneDisplay(primaryPhone)
      : primaryPhone
    : null;
  const mapsUrl =
    item.lat !== null && item.lat !== undefined && item.lon !== null && item.lon !== undefined
      ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`
      : item.alamat
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.alamat)}`
        : null;

  const handleCopy = async () => {
    if (!primaryPhone) return;
    try {
      await navigator.clipboard.writeText(primaryPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-text)] whitespace-nowrap">
                {item.source}
              </span>
              {item.jenis && (
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
                  {item.jenis}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-snug text-[var(--text-primary)]">
              {item.title || item.nama_kost || item.slug}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail"
            className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <DetailGallery item={item} />

        <ScamAlertBanner scamRisk={item.scam_risk} />

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--text-muted)]">Harga Bulanan</div>
            <div className="text-2xl font-bold font-mono-tabular">
              {item.price ? formatIdr(item.price) : item.price_text || "Hubungi pemilik"}
            </div>
            {item.price_suspect && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Harga sumber ambigu, verifikasi langsung ke iklan.</span>
              </div>
            )}
            {item.price_estimate_from_reviews && (
              <div className="mt-1 text-xs font-semibold text-[var(--accent-text)]">
                Estimasi dari ulasan Google Maps: ~{formatIdr(item.price_estimate_from_reviews)}/bln
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current text-[var(--accent)]" : ""}`} />
              <span>{isSaved ? "Tersimpan" : "Simpan"}</span>
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
            >
              <span>Buka Iklan</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {item.price_options && item.price_options.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Opsi Harga Tercatat
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.price_options.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-mono-tabular whitespace-nowrap"
                >
                  {formatIdr(p)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Lokasi & Alamat
            </span>
            {typeof item.distance_km === "number" && (
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold font-mono-tabular text-[var(--accent-text)] whitespace-nowrap">
                {item.distance_km.toFixed(2)} km
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-primary)]">{item.alamat || "-"}</p>
          <div className="text-xs text-[var(--text-muted)]">
            {[item.kelurahan, item.kecamatan].filter(Boolean).join(", ")}
          </div>
          {(() => {
            const bm = distanceToLandmarkKm(item, "bank-mega");
            return bm ? (
              <div className="text-xs font-medium text-[var(--accent-text)] font-mono-tabular">
                {bm.distanceKm.toFixed(2)} km dari {bm.label}
              </div>
            ) : null;
          })()}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline pt-1"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Buka di Google Maps</span>
            </a>
          )}
        </div>

        <NearbyTransitSection item={item} />

        <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Kontak Pemilik
            </span>
            {primaryPhone && maskContact && (
              <button
                type="button"
                onClick={() => setRevealLocal((v) => !v)}
                className="text-xs font-semibold text-[var(--accent)] cursor-pointer hover:underline"
              >
                {revealLocal ? "Sembunyikan" : "Tampilkan Nomor"}
              </button>
            )}
          </div>
          <div className="text-sm font-medium">{item.nama_pemilik || "Pemilik / Pengelola"}</div>
          {shownPhone ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-mono-tabular">
                <Phone className="h-3.5 w-3.5 text-[var(--accent)]" />
                {shownPhone}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Disalin" : "Salin"}</span>
              </button>
              {item.wa_link && !hideNumber && (
                <a
                  href={item.wa_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Chat WhatsApp</span>
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Kontak tidak tersedia di halaman.</p>
          )}
        </div>

        <GmapsEvaluationSection item={item} />

        {(item.fasilitas_list?.length || item.fasilitas) && (
          <FacilitySections item={item} />
        )}

        {item.peraturan && item.peraturan.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Peraturan
            </div>
            <ul className="list-disc pl-5 text-xs text-[var(--text-muted)] space-y-1">
              {item.peraturan.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {item.deskripsi && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Deskripsi
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
              {item.deskripsi}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

