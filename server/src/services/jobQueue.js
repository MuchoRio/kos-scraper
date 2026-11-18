import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { buildPythonArgs, terminateChildProcess } from "./processRunner.js";

const MAX_LOGS = 200;

export class JobQueueManager {
  constructor({ rootDir, pythonBin, store, spawnFn = spawn }) {
    this.rootDir = rootDir;
    this.pythonBin = pythonBin;
    this.store = store;
    this.spawnFn = spawnFn;
    this.jobs = new Map();
    this.queue = [];
    this.activeJobId = null;
    this.activeChild = null;
    this.subscribers = new Map();

    for (const saved of this.store.loadJobsState()) {
      this.jobs.set(saved.id, { ...saved, items: [] });
    }
  }

  listJobs() {
    return Array.from(this.jobs.values())
      .map((j) => this._publicJob(j))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  enqueue(options, runtimeSecrets = {}) {
    const id = `job_${crypto.randomBytes(5).toString("hex")}`;
    const now = new Date().toISOString();
    const job = {
      id,
      options,
      _apiKey: runtimeSecrets.googleMapsApiKey || null,
      _resourceUrl: runtimeSecrets.resourceUrl || null,
      status: "queued",
      progress: { phase: "queued", current: 0, total: 0, message: "Menunggu giliran antrean..." },
      logs: [],
      items: [],
      itemsCount: 0,
      files: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    this._persist();
    this._drain();
    return this._publicJob(job);
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    if (job.status === "queued") {
      this.queue = this.queue.filter((qid) => qid !== jobId);
      job.status = "cancelled";
      job.updatedAt = new Date().toISOString();
      this._pushLog(job, "Job dibatalkan sebelum berjalan.");
      this._broadcast(jobId, "status", this._publicJob(job));
      this._persist();
      return this._publicJob(job);
    }

    if (job.status === "running" && this.activeJobId === jobId && this.activeChild) {
      job.status = "cancelled";
      job.updatedAt = new Date().toISOString();
      this._pushLog(job, "Menghentikan worker Python...");
      this._terminateChild(this.activeChild);
      this._broadcast(jobId, "status", this._publicJob(job));
      this._persist();
      return this._publicJob(job);
    }

    return this._publicJob(job);
  }

  subscribe(jobId, res) {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId).add(res);
    const job = this.jobs.get(jobId);
    if (job) {
      this._writeSse(res, "snapshot", this._publicJob(job));
    }
    return () => {
      const set = this.subscribers.get(jobId);
      if (set) {
        set.delete(res);
        if (set.size === 0) this.subscribers.delete(jobId);
      }
    };
  }

  shutdown() {
    if (this.activeChild) {
      this._terminateChild(this.activeChild);
    }
  }

  _drain() {
    if (this.activeJobId || this.queue.length === 0) return;
    const nextId = this.queue.shift();
    const job = this.jobs.get(nextId);
    if (!job || job.status !== "queued") {
      this._drain();
      return;
    }
    this._runJob(job);
  }

  _runJob(job) {
    this.activeJobId = job.id;
    job.status = "running";
    job.updatedAt = new Date().toISOString();
    job.progress = { phase: "starting", current: 0, total: 0, message: "Menjalankan engine..." };
    const targetLabel = job.options.detailsLimit === 0 ? "Semua" : job.options.detailsLimit;
    const startMsg =
      job.options.kind === "resource"
        ? `Memulai riset direktori: ${job.options.area} (target ${targetLabel})`
        : `Memulai scrape: ${job.options.sources.join(", ")} (${job.options.area})`;
    this._pushLog(job, startMsg);
    this._broadcast(job.id, "status", this._publicJob(job));

    const runOpts = job._resourceUrl ? { ...job.options, url: job._resourceUrl } : job.options;
    job._resourceUrl = null;
    const args = buildPythonArgs(this.rootDir, this.store.dataDir, runOpts);
    const childEnv = { ...process.env };
    if (job._apiKey) {
      childEnv.GOOGLE_MAPS_API_KEY = job._apiKey;
      job._apiKey = null;
    }
    const child = this.spawnFn(this.pythonBin, args, {
      cwd: this.rootDir,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.activeChild = child;

    let stdoutBuf = "";
    let stderrBuf = "";
    const MAX_STDOUT = 32 * 1024 * 1024;

    child.stdout.on("data", (chunk) => {
      if (stdoutBuf.length < MAX_STDOUT) {
        stdoutBuf += chunk.toString("utf8");
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf8");
      const lines = stderrBuf.split(/\r?\n/);
      stderrBuf = lines.pop() || "";
      for (const line of lines) {
        this._handleStderrLine(job, line);
      }
    });

    child.on("error", (err) => {
      job.status = "failed";
      job.error = err.message;
      this._finishJob(job);
    });

    child.on("close", (code) => {
      if (stderrBuf.trim()) this._handleStderrLine(job, stderrBuf);
      if (job.status !== "cancelled") {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdoutBuf);
            job.items = Array.isArray(parsed.items) ? parsed.items : job.items;
            const reportedCount = Number.isFinite(parsed.detail_count) ? parsed.detail_count : null;
            job.itemsCount =
              parsed.items_saved_to_file && reportedCount !== null ? reportedCount : job.items.length;
            job.files = parsed.files || job.files;
            job.status = "completed";
            job.progress = {
              phase: "done",
              current: job.itemsCount,
              total: job.itemsCount,
              message: `Selesai (${job.itemsCount} kos tersimpan).`,
            };
          } catch (parseErr) {
            job.status = "failed";
            job.error = `Output JSON tidak valid: ${parseErr.message}`;
          }
        } else {
          job.status = "failed";
          job.error = job.error || `Scraper keluar dengan kode ${code}`;
        }
      }
      this._finishJob(job);
    });
  }

  _finishJob(job) {
    job.updatedAt = new Date().toISOString();
    this.activeJobId = null;
    this.activeChild = null;
    this._broadcast(job.id, "done", this._publicJob(job));
    this._persist();
    this._drain();
  }

  _handleStderrLine(job, rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    try {
      const ev = JSON.parse(trimmed);
      job.updatedAt = new Date().toISOString();
      if (ev.type === "phase") {
        job.progress = {
          phase: ev.phase || "running",
          current: ev.current || 0,
          total: ev.total || 0,
          message: ev.message || "",
        };
        this._pushLog(job, ev.message || `${ev.phase} ${ev.source || ""}`);
        this._broadcast(job.id, "progress", this._publicJob(job));
      } else if (ev.type === "item" && ev.item) {
        job.items.push(ev.item);
        job.itemsCount = job.items.length;
        this._broadcast(job.id, "item", { item: ev.item, current: ev.current, total: ev.total });
      } else if (ev.type === "error") {
        this._pushLog(job, `ERR: ${ev.error}`);
        this._broadcast(job.id, "log", { message: `ERR: ${ev.error}` });
      } else if (ev.type === "done" && ev.summary) {
        job.files = ev.summary.files || null;
      }
    } catch {
      this._pushLog(job, trimmed);
      this._broadcast(job.id, "log", { message: trimmed });
    }
  }

  _terminateChild(child) {
    terminateChildProcess(this.spawnFn, child);
  }

  _pushLog(job, message) {
    job.logs.push({ ts: new Date().toISOString(), message });
    if (job.logs.length > MAX_LOGS) {
      job.logs.splice(0, job.logs.length - MAX_LOGS);
    }
  }

  _broadcast(jobId, event, data) {
    const subs = this.subscribers.get(jobId);
    if (!subs) return;
    for (const res of subs) {
      this._writeSse(res, event, data);
    }
  }

  _writeSse(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  _publicJob(job) {
    return {
      id: job.id,
      options: job.options,
      status: job.status,
      progress: job.progress,
      logs: job.logs,
      items: job.items,
      itemsCount: job.itemsCount,
      files: job.files,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  _persist() {
    this.store.persistJobsState(Array.from(this.jobs.values()));
  }
}
