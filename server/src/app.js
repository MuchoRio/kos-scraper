import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { createExportRouter } from "./routes/export.js";
import { createFavoritesRouter } from "./routes/favorites.js";
import { createHealthRouter } from "./routes/health.js";
import { createJobsRouter } from "./routes/jobs.js";
import { createResultsRouter } from "./routes/results.js";
import { JobQueueManager } from "./services/jobQueue.js";
import { DataStore } from "./services/store.js";
import { AppError } from "./utils/validation.js";

export function createApp(config, overrides = {}) {
  const store = overrides.store || new DataStore(config.dataDir);
  const queue =
    overrides.queue ||
    new JobQueueManager({
      rootDir: config.rootDir,
      pythonBin: config.pythonBin,
      store,
      spawnFn: overrides.spawnFn,
    });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  const api = express.Router();
  api.use(createHealthRouter({ config }));
  api.use(createJobsRouter({ queue }));
  api.use(createResultsRouter({ store }));
  api.use(createFavoritesRouter({ store }));
  api.use(createExportRouter({ queue }));
  api.use((_req, _res, next) => next(new AppError("Endpoint API tidak ditemukan.", 404)));

  app.use("/api", api);

  const indexHtml = path.join(config.clientDistDir, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDistDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  // Centralized JSON error handler so malformed JSON or validation errors never leak HTML 500
  app.use((err, req, res, _next) => {
    const status = err instanceof SyntaxError && err.status === 400 ? 400 : err?.status || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ success: false, message, path: req.originalUrl });
  });

  return { app, store, queue };
}

