import fs from "node:fs";
import path from "node:path";
import { AppError, safeResultFilename } from "../utils/validation.js";

export class DataStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  ensureDir() {
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  listResultFiles() {
    this.ensureDir();
    const entries = fs.readdirSync(this.dataDir, { withFileTypes: true });
    return entries
      .filter((ent) => ent.isFile() && /\.(json|csv)$/i.test(ent.name) && !["favorites.json", "jobs_state.json"].includes(ent.name))
      .map((ent) => {
        const full = path.join(this.dataDir, ent.name);
        const stat = fs.statSync(full);
        return {
          name: ent.name,
          ext: path.extname(ent.name).slice(1).toLowerCase(),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  readResultItems(filename) {
    const safeName = safeResultFilename(filename);
    const full = path.join(this.dataDir, safeName);
    if (!fs.existsSync(full)) {
      throw new AppError(`File hasil '${safeName}' tidak ditemukan.`, 404);
    }
    if (safeName.endsWith(".csv")) {
      return { filename: safeName, type: "csv", content: fs.readFileSync(full, "utf8") };
    }
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    const normalized = items.map((it) => ({
      source: it.source || (String(it.url || "").includes("rukita.co") ? "rukita" : "sewakost"),
      price_suspect: Boolean(it.price_suspect),
      fasilitas_list: Array.isArray(it.fasilitas_list) ? it.fasilitas_list : [],
      ...it,
    }));
    return { filename: safeName, type: "json", items: normalized };
  }

  getDefaultItems() {
    const files = this.listResultFiles().filter((f) => f.ext === "json" && f.name.startsWith("detail_"));
    if (files.length > 0) {
      return this.readResultItems(files[0].name);
    }
    const samplePath = path.join(this.dataDir, "contoh_detail.json");
    if (fs.existsSync(samplePath)) {
      return this.readResultItems("contoh_detail.json");
    }
    return { filename: null, type: "json", items: [] };
  }

  readFavorites() {
    this.ensureDir();
    const favPath = path.join(this.dataDir, "favorites.json");
    if (!fs.existsSync(favPath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(favPath, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveFavorites(items) {
    this.ensureDir();
    const favPath = path.join(this.dataDir, "favorites.json");
    fs.writeFileSync(favPath, JSON.stringify(items, null, 2), "utf8");
    return items;
  }

  loadJobsState() {
    this.ensureDir();
    const statePath = path.join(this.dataDir, "jobs_state.json");
    if (!fs.existsSync(statePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (!Array.isArray(parsed)) return [];
      // Mark previously active jobs as interrupted on restart (never auto-resume silently)
      return parsed.map((job) =>
        job.status === "queued" || job.status === "running"
          ? { ...job, status: "interrupted", updatedAt: new Date().toISOString() }
          : job
      );
    } catch {
      return [];
    }
  }

  persistJobsState(jobs) {
    this.ensureDir();
    const statePath = path.join(this.dataDir, "jobs_state.json");
    const serializable = jobs.slice(0, 25).map(({ id, options, status, progress, logs, error, files, createdAt, updatedAt, itemsCount }) => ({
      id,
      options,
      status,
      progress,
      logs: (logs || []).slice(-100),
      error,
      files,
      itemsCount,
      createdAt,
      updatedAt,
    }));
    fs.writeFileSync(statePath, JSON.stringify(serializable, null, 2), "utf8");
  }
}

