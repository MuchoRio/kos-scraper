import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelScrapeJob,
  deleteResourceFile,
  deleteResourcePreset,
  fetchResourceFile,
  fetchResourcePresets,
  fetchResourceResults,
  inspectResourceUrl,
  saveResourcePreset,
  startResourceJob,
} from "../services/api";
import type {
  FilterState,
  KosItem,
  ResourceInspectPayload,
  ResourceInspectStats,
  ResourceJobOptions,
  ResourceServerPreset,
  ResultFile,
  ScrapeJob,
} from "../types/kos";
import { DEFAULT_FILTER } from "../utils/kosAttributes";

export function useResourceWorkspace(mapsApiKey: string, notify: (msg: string) => void) {
  const [presets, setPresets] = useState<ResourceServerPreset[]>([]);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [items, setItems] = useState<KosItem[]>([]);
  const [activeJob, setActiveJob] = useState<ScrapeJob | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [inspectStats, setInspectStats] = useState<ResourceInspectStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchResourceResults(), fetchResourcePresets()])
      .then(([resOut, presetOut]) => {
        if (!active) return;
        if (resOut.status === "fulfilled") {
          setFiles(resOut.value.files);
          setActiveFile(resOut.value.defaultFilename);
          setItems(resOut.value.items);
        }
        if (presetOut.status === "fulfilled") {
          setPresets(presetOut.value.presets);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      esRef.current?.close();
    };
  }, []);

  const savePreset = async (label: string, url: string) => {
    setErrorMsg(null);
    try {
      const res = await saveResourcePreset({ label, url });
      setPresets(res.presets);
      notify(`Tersimpan ke Database Server: ${res.preset.label}`);
      return res.preset.id;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan sumber ke server.");
      return null;
    }
  };

  const deletePreset = async (id: string) => {
    setErrorMsg(null);
    try {
      const res = await deleteResourcePreset(id);
      setPresets(res.presets);
      notify("Sumber database server dihapus.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus sumber database.");
    }
  };

  const inspectUrl = async (payload: ResourceInspectPayload) => {
    setErrorMsg(null);
    setInspecting(true);
    try {
      const res = await inspectResourceUrl(payload);
      setInspectStats(res.stats);
      notify(`Terbaca ${res.stats.total_rows.toLocaleString("id-ID")} baris dari direktori.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memeriksa Google Sheet/Doc.");
    } finally {
      setInspecting(false);
    }
  };

  const subscribe = useCallback(
    (jobId: string) => {
      esRef.current?.close();
      const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
      esRef.current = es;
      es.addEventListener("snapshot", (ev) => setActiveJob(JSON.parse((ev as MessageEvent).data)));
      es.addEventListener("progress", (ev) => setActiveJob(JSON.parse((ev as MessageEvent).data)));
      es.addEventListener("status", (ev) => setActiveJob(JSON.parse((ev as MessageEvent).data)));
      es.addEventListener("item", (ev) => {
        const payload = JSON.parse((ev as MessageEvent).data) as { item: KosItem };
        setItems((prev) => [payload.item, ...prev.filter((p) => p.url !== payload.item.url)]);
      });
      es.addEventListener("done", (ev) => {
        const job = JSON.parse((ev as MessageEvent).data) as ScrapeJob;
        setActiveJob(job);
        es.close();
        esRef.current = null;
        if (job.status === "completed") {
          if (job.items.length > 0) setItems(job.items);
          setActiveFile(job.files?.detail_json || null);
          fetchResourceResults().then((r) => setFiles(r.files)).catch(() => {});
          notify(`Analisa direktori selesai: ${job.itemsCount} kos diperkaya.`);
        } else if (job.status === "failed") {
          setErrorMsg(job.error || "Analisa direktori gagal.");
        } else if (job.status === "cancelled") {
          notify("Analisa direktori dibatalkan.");
        }
      });
      es.onerror = () => es.close();
    },
    [notify]
  );

  const runAnalysis = async (options: ResourceJobOptions) => {
    setErrorMsg(null);
    try {
      const { job } = await startResourceJob(options, mapsApiKey);
      setActiveJob(job);
      setItems([]);
      setActiveFile(null);
      subscribe(job.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memulai analisa resource.");
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
      const res = await fetchResourceFile(filename);
      setItems(res.items);
      setActiveFile(res.filename);
      notify(`Memuat ${res.items.length} data direktori dari ${res.filename}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuka file hasil direktori.");
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryFile = async (filename: string) => {
    try {
      const res = await deleteResourceFile(filename);
      setFiles(res.files);
      if (activeFile === filename) {
        const latest = await fetchResourceResults();
        setFiles(latest.files);
        setActiveFile(latest.defaultFilename);
        setItems(latest.items);
      }
      notify(`File ${filename} dihapus dari hasil/resources/.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus file resource.");
    }
  };

  return {
    presets,
    files,
    activeFile,
    items,
    activeJob,
    filter,
    setFilter,
    resetFilter: () => setFilter(DEFAULT_FILTER),
    loading,
    inspecting,
    inspectStats,
    errorMsg,
    setErrorMsg,
    inspectUrl,
    runAnalysis,
    stopJob,
    savePreset,
    deletePreset,
    loadHistoryFile,
    deleteHistoryFile,
  };
}

