import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { KosItem } from "../types/kos";
import { NoPhotoPlaceholder } from "./NoPhotoPlaceholder";

export function DetailGallery({ item }: { item: KosItem }) {
  const photos = useMemo(() => {
    const raw = [...(item.image_urls || []), item.image_url || ""];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of raw) {
      const clean = u.trim();
      if (!clean || !/^https?:\/\//i.test(clean) || seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
    }
    return out;
  }, [item.image_url, item.image_urls]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveIdx(0);
    setBroken({});
  }, [item.url]);

  const validPhotos = photos.filter((u) => !broken[u]);

  if (validPhotos.length === 0) {
    return (
      <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
        <NoPhotoPlaceholder subtitle="Cek halaman iklan untuk melihat apakah foto sudah diunggah pemilik" />
      </div>
    );
  }

  const safeIdx = Math.min(activeIdx, validPhotos.length - 1);
  const currentUrl = validPhotos[safeIdx];

  const step = (delta: number) => {
    setActiveIdx((prev) => (prev + delta + validPhotos.length) % validPhotos.length);
  };

  return (
    <div className="space-y-2.5">
      <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
        <img
          src={currentUrl}
          alt={`${item.title || "Foto kos"} (${safeIdx + 1}/${validPhotos.length})`}
          onError={() => setBroken((prev) => ({ ...prev, [currentUrl]: true }))}
          className="h-full w-full object-cover"
        />

        {validPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Foto sebelumnya"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-xs hover:bg-black/80 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Foto berikutnya"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-xs hover:bg-black/80 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold font-mono-tabular text-white backdrop-blur-xs">
          {safeIdx + 1} / {validPhotos.length} foto
        </div>
      </div>

      {validPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {validPhotos.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${
                idx === safeIdx
                  ? "border-[var(--accent)] opacity-100"
                  : "border-transparent opacity-65 hover:opacity-100"
              }`}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

