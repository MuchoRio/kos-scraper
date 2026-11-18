import { AlertCircle, SearchX, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { BentoKpiRow } from "./components/BentoKpiRow";
import { BentoTopBar } from "./components/BentoTopBar";
import { DetailDrawer } from "./components/DetailDrawer";
import { FilterModal } from "./components/FilterModal";
import { HistorySavedModal } from "./components/HistorySavedModal";
import { ListingBentoCard } from "./components/ListingBentoCard";
import { ListingTable } from "./components/ListingTable";
import { LiveFilterBar } from "./components/LiveFilterBar";
import { ScrapeFormCard } from "./components/ScrapeFormCard";
import { ScrapeSettingsModal, type ScrapeSettingsState } from "./components/ScrapeSettingsModal";
import { TelemetryCard } from "./components/TelemetryCard";
import { DEFAULT_SOURCES } from "./constants/sources";
import { useKosWorkspace } from "./hooks/useKosWorkspace";
import { useTheme } from "./hooks/useTheme";
import type { KosItem, ViewMode } from "./types/kos";
import { filterAndSortItems } from "./utils/formatters";
import { extractUniqueKecamatan } from "./utils/kosAttributes";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const ws = useKosWorkspace();
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
  const [maskContact, setMaskContact] = useState(true);
  const [selectedKos, setSelectedKos] = useState<KosItem | null>(null);
  const [modalMode, setModalMode] = useState<"history" | "saved" | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scrapeSettings, setScrapeSettings] = useState<ScrapeSettingsState>({
    sources: DEFAULT_SOURCES,
    maxPages: "6",
    concurrency: "4",
    landmarkId: "bank-mega",
    enableGeo: true,
    enableGmaps: true,
  });

  const deferredFilter = useDeferredValue(ws.filter);
  const deferredItems = useDeferredValue(ws.items);
  const kecamatanOptions = useMemo(() => extractUniqueKecamatan(ws.items), [ws.items]);

  const filteredItems = useMemo(
    () => filterAndSortItems(deferredItems, deferredFilter),
    [deferredItems, deferredFilter]
  );

  const savedUrls = useMemo(
    () => new Set(ws.favorites.map((f) => f.url)),
    [ws.favorites]
  );

  const isJobRunning =
    ws.activeJob?.status === "running" || ws.activeJob?.status === "queued";

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 space-y-4">
        <BentoTopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          maskContact={maskContact}
          onToggleMaskContact={() => setMaskContact((v) => !v)}
          favoritesCount={ws.favorites.length}
          onOpenSaved={() => setModalMode("saved")}
          onOpenHistory={() => setModalMode("history")}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExportCsv={() => ws.exportCsv(filteredItems, maskContact)}
          canExport={filteredItems.length > 0}
          activeFile={ws.activeFile}
        />

        {ws.errorMsg && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{ws.errorMsg}</span>
            </span>
            <button
              type="button"
              onClick={() => ws.setErrorMsg(null)}
              className="rounded-lg p-1 hover:bg-rose-500/20 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <BentoKpiRow
          items={ws.items}
          filteredCount={filteredItems.length}
          activeJob={ws.activeJob}
          onCancelJob={ws.stopJob}
        />

        <ScrapeFormCard
          areas={ws.areas}
          landmarks={ws.landmarks}
          settings={scrapeSettings}
          isRunning={isJobRunning}
          maskContactDefault={maskContact}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onStartJob={ws.runJob}
        />

        <TelemetryCard job={ws.activeJob} />

        <LiveFilterBar
          filter={ws.filter}
          kecamatanOptions={kecamatanOptions}
          onChange={ws.setFilter}
          onReset={ws.resetFilter}
          onOpenModal={() => setIsFilterOpen(true)}
        />

        {ws.loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center space-y-3">
            <SearchX className="mx-auto h-10 w-10 text-[var(--text-muted)] opacity-60" />
            <div className="text-base font-semibold">
              {isJobRunning ? "Mengumpulkan data kos..." : "Tidak ada kos yang cocok dengan filter"}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Coba longgarkan keyword pencarian atau reset filter di atas.
            </p>
            {!isJobRunning && ws.items.length > 0 && (
              <button
                type="button"
                onClick={ws.resetFilter}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : viewMode === "bento" ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <ListingBentoCard
                key={item.url}
                item={item}
                isSaved={savedUrls.has(item.url)}
                maskContact={maskContact}
                onSelect={setSelectedKos}
                onToggleFavorite={ws.toggleFavorite}
              />
            ))}
          </section>
        ) : (
          <ListingTable
            items={filteredItems}
            savedUrls={savedUrls}
            maskContact={maskContact}
            onSelect={setSelectedKos}
            onToggleFavorite={ws.toggleFavorite}
          />
        )}
      </main>

      <DetailDrawer
        item={selectedKos}
        isSaved={selectedKos ? savedUrls.has(selectedKos.url) : false}
        maskContact={maskContact}
        onClose={() => setSelectedKos(null)}
        onToggleFavorite={ws.toggleFavorite}
      />

      <HistorySavedModal
        mode={modalMode}
        files={ws.files}
        activeFile={ws.activeFile}
        favorites={ws.favorites}
        onClose={() => setModalMode(null)}
        onLoadFile={ws.loadHistoryFile}
        onSelectKos={setSelectedKos}
        onToggleFavorite={ws.toggleFavorite}
      />

      <FilterModal
        isOpen={isFilterOpen}
        filter={ws.filter}
        items={deferredItems}
        kecamatanOptions={kecamatanOptions}
        onClose={() => setIsFilterOpen(false)}
        onApply={ws.setFilter}
      />

      <ScrapeSettingsModal
        isOpen={isSettingsOpen}
        settings={scrapeSettings}
        landmarks={ws.landmarks}
        hasServerMapsKey={ws.hasServerMapsKey}
        mapsApiKey={ws.mapsApiKey}
        onChange={setScrapeSettings}
        onChangeMapsApiKey={ws.setMapsApiKey}
        onClose={() => setIsSettingsOpen(false)}
      />

      {ws.toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5 text-xs font-semibold shadow-lg">
          {ws.toastMsg}
        </div>
      )}
    </div>
  );
}

export default App;

