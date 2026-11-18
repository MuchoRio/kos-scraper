import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { AppError, safeResultFilename } from "../utils/validation.js";

const GOOGLE_DOC_OR_SHEET_RE =
  /^https:\/\/docs\.google\.com\/(?:spreadsheets|document)\/d\/[a-zA-Z0-9_-]{15,}(?:\/[^\s]*)?$/i;
const AREA_RE = /^[a-z0-9-]{2,60}$/;
const ALLOWED_PRICE_CAT = new Set(["all", "murah", "middle", "premium"]);
const ALLOWED_AVAIL = new Set(["available_or_unknown", "strict_available", "all"]);
const ALLOWED_QUALITY = new Set(["all", "curated", "top", "worth_it", "best_deal", "standar"]);
const ALLOWED_GENDER = new Set(["all", "campur", "wanita", "pria", "bebas"]);
const ALLOWED_PET = new Set(["all", "pet_friendly", "no_pet"]);

function pickAllowed(val, set, fallback) {
  const s = String(val || fallback).trim().toLowerCase();
  return set.has(s) ? s : fallback;
}

function validateResourceUrl(raw) {
  const url = String(raw || "").trim();
  if (!GOOGLE_DOC_OR_SHEET_RE.test(url)) {
    throw new AppError("URL harus berupa link publik Google Sheets atau Google Docs (docs.google.com).", 400);
  }
  return url;
}

function validateResourcePayload(body) {
  if (!body || typeof body !== "object") {
    throw new AppError("Payload resource wajib berupa objek JSON.", 400);
  }
  const url = validateResourceUrl(body.url);
  const area = String(body.area || "jakarta-selatan").trim().toLowerCase();
  if (!AREA_RE.test(area)) {
    throw new AppError("Format area tidak valid.", 400);
  }
  let maxPrice = null;
  if (body.maxPrice !== null && body.maxPrice !== undefined && body.maxPrice !== "") {
    const parsed = Number(body.maxPrice);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000_000) {
      throw new AppError("Max harga harus berupa angka positif yang wajar.", 400);
    }
    maxPrice = Math.round(parsed);
  }
  const rawKws = Array.isArray(body.keywords) ? body.keywords : String(body.keywords || "").split(",");
  const keywords = rawKws.map((k) => String(k).replace(/[^\p{L}\p{N}\s.-]/gu, "").trim()).filter(Boolean).slice(0, 20);
  const detailsLimit = Math.min(300, Math.max(1, Number.parseInt(body.detailsLimit ?? 20, 10) || 20));
  const concurrency = Math.min(6, Math.max(1, Number.parseInt(body.concurrency ?? 4, 10) || 4));
  let refLat = null;
  let refLon = null;
  if (body.refLat !== null && body.refLat !== undefined && body.refLat !== "") {
    const lat = Number(body.refLat);
    const lon = Number(body.refLon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      refLat = lat;
      refLon = lon;
    }
  }
  const availability = pickAllowed(
    body.availability,
    ALLOWED_AVAIL,
    body.onlyAvailable === false ? "all" : "available_or_unknown"
  );
  return {
    kind: "resource",
    url,
    area,
    maxPrice,
    keywords,
    detailsLimit,
    concurrency,
    onlyAvailable: availability !== "all",
    deduplicate: body.deduplicate !== false,
    includeUnpriced: Boolean(body.includeUnpriced),
    priceCategory: pickAllowed(body.priceCategory, ALLOWED_PRICE_CAT, "all"),
    availability,
    quality: pickAllowed(body.quality, ALLOWED_QUALITY, "all"),
    gender: pickAllowed(body.gender, ALLOWED_GENDER, "all"),
    pet: pickAllowed(body.pet, ALLOWED_PET, "all"),
    geocode: body.geocode !== false,
    gmaps: body.gmaps !== false,
    maskContact: Boolean(body.maskContact),
    keepHistory: Boolean(body.keepHistory),
    storageMode: ["replace", "merge", "archive"].includes(String(body.storageMode || ""))
      ? String(body.storageMode)
      : body.keepHistory
      ? "archive"
      : "replace",
    refLat,
    refLon,
  };
}

function listResourceFiles(dataDir) {
  const dir = path.join(dataDir, "resources");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") || f.endsWith(".csv"))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, sizeBytes: st.size, modifiedAt: st.mtime.toISOString(), ext: name.endsWith(".csv") ? "csv" : "json" };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function createResourcesRouter({ config, queue }) {
  const router = express.Router();

  router.get("/resources/results", (_req, res) => {
    const files = listResourceFiles(config.dataDir);
    const def = files.find((f) => f.ext === "json" && f.name.startsWith("resource_detail_"));
    let items = [];
    if (def) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(config.dataDir, "resources", def.name), "utf8"));
        if (Array.isArray(raw)) items = raw;
      } catch {
        items = [];
      }
    }
    res.json({ success: true, files, defaultFilename: def?.name || null, items });
  });

  router.get("/resources/results/:filename", (req, res) => {
    const safeName = safeResultFilename(req.params.filename);
    const full = path.join(config.dataDir, "resources", safeName);
    if (!fs.existsSync(full)) {
      throw new AppError(`File resource '${safeName}' tidak ditemukan.`, 404);
    }
    const items = JSON.parse(fs.readFileSync(full, "utf8"));
    res.json({ success: true, filename: safeName, items: Array.isArray(items) ? items : [] });
  });

  router.delete("/resources/results/:filename", (req, res) => {
    const safeName = safeResultFilename(req.params.filename);
    const full = path.join(config.dataDir, "resources", safeName);
    if (!fs.existsSync(full)) {
      throw new AppError(`File resource '${safeName}' tidak ditemukan.`, 404);
    }
    fs.unlinkSync(full);
    res.json({ success: true, deleted: safeName, files: listResourceFiles(config.dataDir) });
  });

  router.post("/resources/inspect", (req, res) => {
    const opts = validateResourcePayload(req.body);
    const args = [
      path.join(config.rootDir, "kos_scraper.py"),
      "inspect-resource",
      "--url", opts.url,
      "--area", opts.area,
      "--price-category", opts.priceCategory,
      "--availability", opts.availability,
      "--quality", opts.quality,
      "--gender", opts.gender,
      "--pet", opts.pet,
    ];
    if (opts.maxPrice) args.push("--max-price", String(opts.maxPrice));
    if (opts.keywords.length > 0) args.push("--keyword", opts.keywords.join(","));
    if (!opts.deduplicate) args.push("--no-dedup");
    if (opts.includeUnpriced) args.push("--include-unpriced");

    const proc = spawnSync(config.pythonBin, args, {
      cwd: config.rootDir,
      encoding: "utf8",
      timeout: 35000,
    });
    if (proc.status !== 0 || !proc.stdout.trim()) {
      throw new AppError(proc.stderr?.trim() || "Gagal memeriksa dokumen/sheet Google.", 400);
    }
    const line = proc.stdout.trim().split(/\r?\n/)[0];
    try {
      res.json(JSON.parse(line));
    } catch {
      throw new AppError("Output JSON dari pemeriksa resource tidak valid.", 500);
    }
  });

  router.post("/resources/jobs", (req, res) => {
    const options = validateResourcePayload(req.body);
    const apiKeyHeader = req.get("x-google-maps-api-key");
    const runtimeSecrets = apiKeyHeader ? { googleMapsApiKey: apiKeyHeader.trim() } : {};
    const job = queue.enqueue(options, runtimeSecrets);
    res.status(201).json({ success: true, job });
  });

  return router;
}
