interface ScrapeAdvancedSectionProps {
  showAdvanced: boolean;
  maxPages: string;
  targetKos: string;
  concurrency: string;
  onChangeMaxPages: (val: string) => void;
  onChangeTargetKos: (val: string) => void;
  onChangeConcurrency: (val: string) => void;
  enableGmaps: boolean;
  hasServerMapsKey: boolean;
  mapsApiKey: string;
  onChangeMapsApiKey: (key: string) => void;
}

export function ScrapeAdvancedSection({
  showAdvanced,
  maxPages,
  targetKos,
  concurrency,
  onChangeMaxPages,
  onChangeTargetKos,
  onChangeConcurrency,
  enableGmaps,
  hasServerMapsKey,
  mapsApiKey,
  onChangeMapsApiKey,
}: ScrapeAdvancedSectionProps) {
  return (
    <>
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-3 py-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <span className="text-[var(--text-muted)] whitespace-nowrap">Maks Halaman/Sumber:</span>
            <input
              type="number"
              min={1}
              max={15}
              value={maxPages}
              onChange={(e) => onChangeMaxPages(e.target.value)}
              className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 font-mono-tabular"
            />
          </label>

          <label className="inline-flex items-center gap-2">
            <span className="text-[var(--text-muted)] whitespace-nowrap">Custom Target Kos:</span>
            <input
              type="number"
              min={1}
              max={60}
              value={targetKos}
              onChange={(e) => onChangeTargetKos(e.target.value)}
              className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 font-mono-tabular"
            />
          </label>

          <label className="inline-flex items-center gap-2">
            <span className="text-[var(--text-muted)] whitespace-nowrap">Workers Parallel:</span>
            <select
              value={concurrency}
              onChange={(e) => onChangeConcurrency(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 font-mono-tabular"
            >
              <option value="2">2 thread (Halus)</option>
              <option value="4">4 thread (Seimbang)</option>
              <option value="6">6 thread (Cepat)</option>
              <option value="8">8 thread (Maks)</option>
            </select>
          </label>

          <span className="text-[var(--text-muted)]">
            Scraping multi-thread + round-robin antar sumber aktif.
          </span>
        </div>
      )}

      {enableGmaps && !hasServerMapsKey && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 px-3 py-2 text-xs">
          <span className="font-medium text-[var(--text-primary)] whitespace-nowrap">
            Google Places API Key (opsional):
          </span>
          <input
            type="password"
            value={mapsApiKey}
            onChange={(e) => onChangeMapsApiKey(e.target.value)}
            placeholder="Kosongkan untuk mode Chrome lokal (rating + link Maps saja)"
            className="min-w-60 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
          />
          <span className="text-[var(--text-muted)]">
            Hanya disimpan di sesi browser; diperlukan untuk tarik teks ulasan &amp; deteksi komentar penipuan.
          </span>
        </div>
      )}
    </>
  );
}

