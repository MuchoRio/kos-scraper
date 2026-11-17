import express from "express";
import { AppError, buildCsvContent } from "../utils/validation.js";

export function createExportRouter({ queue }) {
  const router = express.Router();

  router.post("/export/csv", (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items)) {
      throw new AppError("Payload export harus menyertakan array items.", 400);
    }
    const maskContact = Boolean(req.body?.maskContact);
    const csv = buildCsvContent(items, { maskContact });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="kos_export_${stamp}.csv"`);
    res.send(csv);
  });

  router.get("/export/:jobId", (req, res) => {
    const job = queue.getJob(req.params.jobId);
    if (!job) throw new AppError("Job tidak ditemukan.", 404);
    const format = String(req.query.format || "csv").toLowerCase();
    const maskContact = req.query.maskContact === "true";

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${job.id}.json"`);
      return res.send(JSON.stringify(job.items || [], null, 2));
    }

    const csv = buildCsvContent(job.items || [], { maskContact });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.id}.csv"`);
    return res.send(csv);
  });

  return router;
}

