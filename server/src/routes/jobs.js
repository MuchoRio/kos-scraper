import express from "express";
import { AppError, validateJobPayload } from "../utils/validation.js";

export function createJobsRouter({ queue }) {
  const router = express.Router();

  router.get("/jobs", (_req, res) => {
    res.json({ success: true, jobs: queue.listJobs() });
  });

  router.post("/jobs", (req, res) => {
    const options = validateJobPayload(req.body);
    const apiKeyHeader = req.get("x-google-maps-api-key");
    const runtimeSecrets = apiKeyHeader ? { googleMapsApiKey: apiKeyHeader.trim() } : {};
    const job = queue.enqueue(options, runtimeSecrets);
    res.status(201).json({ success: true, job });
  });

  router.get("/jobs/:id", (req, res) => {
    const job = queue.getJob(req.params.id);
    if (!job) throw new AppError("Job tidak ditemukan.", 404);
    res.json({ success: true, job: queue._publicJob(job) });
  });

  router.post("/jobs/:id/cancel", (req, res) => {
    const job = queue.cancel(req.params.id);
    if (!job) throw new AppError("Job tidak ditemukan.", 404);
    res.json({ success: true, job });
  });

  router.get("/jobs/:id/events", (req, res) => {
    const job = queue.getJob(req.params.id);
    if (!job) throw new AppError("Job tidak ditemukan.", 404);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const unsubscribe = queue.subscribe(req.params.id, res);
    const heartbeat = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}

