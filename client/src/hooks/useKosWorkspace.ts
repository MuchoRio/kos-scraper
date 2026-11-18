import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelScrapeJob,
  deleteResultFile,
  downloadFilteredCsv,
  fetchFavorites,
  fetchHealth,
  fetchInitialResults,
  fetchPresets,
  fetchResultFile,
  startScrapeJob,
  toggleFavoriteApi,
} from "../services/api";
import type {
  FilterState,
  JobOptions,
  KosItem,
  LandmarkRef,
  PresetArea,
  ResultFile,
  ScrapeJob,
} from "../types/kos";
import { DEFAULT_FILTER } from "../utils/kosAttributes";

export function useKosWorkspace() {
  const [areas, setAreas] = useState<PresetArea[]>([]);
  const [landmarks, setLandmarks] = useState<LandmarkRef[]>([]);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [items, setItems] = useState<KosItem[]>([]);
  const [favorites, setFavorites] = useState<KosItem[]>([]);
  const [activeJob, setActiveJob] = useState<ScrapeJob | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [loading, setLoading] = useState(true);
  const [hasServerMapsKey, setHasServerMapsKey] = useState(false);
  const [mapsApiKey, setMapsApiKeyState] = useState<string>(() => {
    try {
      return sessionStorage.getItem("koshunt:gmaps_key") || "";
    } catch {
      return "";
    }
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const setMapsApiKey = (val: string) => {
    setMapsApiKeyState(val);
    try {
      if (val.trim()) sessionStorage.setItem("koshunt:gmaps_key", val.trim());
      else sessionStorage.removeItem("koshunt:gmaps_key");
    } catch {
      // Ignore storage restriction
    }
  };

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  const refreshFilesAndDefault = useCallback(async () => {
    const res = await fetchInitialResults();
    setFiles(res.files);
    setActiveFile(res.defaultFilename);
    setItems(res.items);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [health, presets, res, favs] = await Promise.all([
          fetchHealth(),
          fetchPresets(),
          fetchInitialResults(),
          fetchFavorites(),
        ]);
        if (!active) return;
        setHasServerMapsKey(Boolean(health.hasGoogleMapsApiKey));
        setAreas(presets.areas);
        setLandmarks(presets.landmarks);
        setFiles(res.files);
        setActiveFile(res.defaultFilename);
        setItems(res.items);
        setFavorites(favs.items);
      } catch (err) {
        if (active) setErrorMsg(err instanceof Error ? err.message : "Gagal memuat workspace.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      eventSourceRef.current?.close();
    };
  }, []);

  const subscribeToJob = useCallback(
    (jobId: string) => {
      eventSourceRef.current?.close();
      const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
      eventSourceRef.current = es;

      es.addEventListener("snapshot", (ev) => {
        const job = JSON.parse((ev as MessageEvent).data) as ScrapeJob;
        setActiveJob(job);
      });
      es.addEventListener("progress", (ev) => {
        const job = JSON.parse((ev as MessageEvent).data) as ScrapeJob;
        setActiveJob(job);
      });
      es.addEventListener("item", (ev) => {
        const payload = JSON.parse((ev as MessageEvent).data) as { item: KosItem };
        setItems((prev) => {
          const filtered = prev.filter((p) => p.url !== payload.item.url);
          return [payload.item, ...filtered];
        });
      });
      es.addEventListener("done", (ev) => {
        const job = JSON.parse((ev as MessageEvent).data) as ScrapeJob;
        setActiveJob(job);
        es.close();
        eventSourceRef.current = null;
        if (job.status === "completed") {
          if (job.items.length > 0) {
            setItems(job.items);
          } else if (job.files?.detail_json && job.itemsCount > 0) {
            fetchResultFile(job.files.detail_json)
              .then((res) => setItems(res.items))
              .catch(() => {});
          }
          setActiveFile(job.files?.detail_json || null);
          fetchInitialResults().then((r) => setFiles(r.files)).catch(() => {});
          notify(`Scrape selesai: ${job.itemsCount.toLocaleString("id-ID")} detail tersimpan.`);
        } else if (job.status === "failed") {
          setErrorMsg(job.error || "Scrape gagal dijalankan.");
        } else if (job.status === "cancelled") {
          notify("Job scraping dibatalkan.");
        }
      });
      es.onerror = () => {
        es.close();
      };
    },
    [notify]
  );

  const runJob = async (options: JobOptions) => {
    setErrorMsg(null);
    try {
      const { job } = await startScrapeJob(options, mapsApiKey);
      setActiveJob(job);
      setItems([]);
      setActiveFile(null);
      subscribeToJob(job.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memulai job.");
    }
  };

  const stopJob = async () => {
    if (!activeJob) return;
    try {
      const { job } = await cancelScrapeJob(activeJob.id);
      setActiveJob(job);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membatalkan job.");
    }
  };

  const loadHistoryFile = async (filename: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchResultFile(filename);
      setItems(res.items);
      setActiveFile(res.filename);
      notify(`Memuat ${res.items.length} data dari ${res.filename}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuka file hasil.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (item: KosItem) => {
    try {
      const res = await toggleFavoriteApi(item);
      setFavorites(res.items);
      notify(res.saved ? "Disimpan ke Favorit" : "Dihapus dari Favorit");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan favorit.");
    }
  };

  const exportCsv = async (filteredItems: KosItem[], maskContact: boolean) => {
    try {
      await downloadFilteredCsv(filteredItems, maskContact);
      notify(`Export CSV (${filteredItems.length} baris) berhasil.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengunduh CSV.");
    }
  };

  const resetFilter = () => setFilter(DEFAULT_FILTER);

  const deleteHistoryFile = async (filename: string) => {
    try {
      const res = await deleteResultFile(filename);
      setFiles(res.files);
      if (activeFile === filename) {
        const latest = await fetchInitialResults();
        setFiles(latest.files);
        setActiveFile(latest.defaultFilename);
        setItems(latest.items);
      }
      notify(`File ${filename} dihapus dari hasil/.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus file hasil.");
    }
  };

  return {
    areas,
    landmarks,
    files,
    activeFile,
    items,
    favorites,
    activeJob,
    filter,
    setFilter,
    resetFilter,
    loading,
    hasServerMapsKey,
    mapsApiKey,
    setMapsApiKey,
    errorMsg,
    setErrorMsg,
    toastMsg,
    notify,
    runJob,
    stopJob,
    loadHistoryFile,
    deleteHistoryFile,
    refreshFilesAndDefault,
    toggleFavorite,
    exportCsv,
  };
}

