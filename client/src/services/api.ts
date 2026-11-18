import type {
  JobOptions,
  KosItem,
  LandmarkRef,
  PresetArea,
  ResourceInspectPayload,
  ResourceInspectStats,
  ResourceJobOptions,
  ResourceServerPreset,
  ResultFile,
  ScrapeJob,
} from "../types/kos";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { success?: boolean; message?: string };
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

export function fetchHealth() {
  return requestJson<{
    success: boolean;
    hasGoogleMapsApiKey: boolean;
  }>("/api/health");
}

export function fetchPresets() {
  return requestJson<{
    success: boolean;
    areas: PresetArea[];
    landmarks: LandmarkRef[];
  }>("/api/presets");
}

export function fetchInitialResults() {
  return requestJson<{
    success: boolean;
    files: ResultFile[];
    defaultFilename: string | null;
    items: KosItem[];
  }>("/api/results");
}

export function fetchResultFile(filename: string) {
  return requestJson<{ success: boolean; filename: string; items: KosItem[] }>(
    `/api/results/${encodeURIComponent(filename)}`
  );
}

export function deleteResultFile(filename: string) {
  return requestJson<{ success: boolean; deleted: string; files: ResultFile[] }>(
    `/api/results/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
}

export function fetchFavorites() {
  return requestJson<{ success: boolean; items: KosItem[] }>("/api/favorites");
}

export function toggleFavoriteApi(item: KosItem) {
  return requestJson<{ success: boolean; saved: boolean; items: KosItem[] }>(
    "/api/favorites/toggle",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
    }
  );
}

export function startScrapeJob(payload: JobOptions, googleMapsApiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (googleMapsApiKey?.trim()) {
    headers["x-google-maps-api-key"] = googleMapsApiKey.trim();
  }
  return requestJson<{ success: boolean; job: ScrapeJob }>("/api/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export function cancelScrapeJob(jobId: string) {
  return requestJson<{ success: boolean; job: ScrapeJob }>(
    `/api/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST" }
  );
}

export async function downloadFilteredCsv(items: KosItem[], maskContact: boolean): Promise<void> {
  const res = await fetch("/api/export/csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, maskContact }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || `Gagal export CSV (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `koshunt_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function fetchResourcePresets() {
  return requestJson<{ success: boolean; presets: ResourceServerPreset[] }>("/api/resources/presets");
}

export function saveResourcePreset(payload: { label: string; url: string }) {
  return requestJson<{ success: boolean; preset: ResourceServerPreset; presets: ResourceServerPreset[] }>(
    "/api/resources/presets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export function deleteResourcePreset(id: string) {
  return requestJson<{ success: boolean; deleted: string; presets: ResourceServerPreset[] }>(
    `/api/resources/presets/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export function fetchResourceResults() {
  return requestJson<{
    success: boolean;
    files: ResultFile[];
    defaultFilename: string | null;
    items: KosItem[];
  }>("/api/resources/results");
}

export function fetchResourceFile(filename: string) {
  return requestJson<{ success: boolean; filename: string; items: KosItem[] }>(
    `/api/resources/results/${encodeURIComponent(filename)}`
  );
}

export function deleteResourceFile(filename: string) {
  return requestJson<{ success: boolean; deleted: string; files: ResultFile[] }>(
    `/api/resources/results/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
}

export function inspectResourceUrl(payload: ResourceInspectPayload) {
  return requestJson<{ success: boolean; stats: ResourceInspectStats; samples: KosItem[] }>(
    "/api/resources/inspect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export function startResourceJob(payload: ResourceJobOptions, googleMapsApiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (googleMapsApiKey?.trim()) {
    headers["x-google-maps-api-key"] = googleMapsApiKey.trim();
  }
  return requestJson<{ success: boolean; job: ScrapeJob }>("/api/resources/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

