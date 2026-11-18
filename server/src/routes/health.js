import { spawnSync } from "node:child_process";
import express from "express";
import { LANDMARK_REFS, PRESET_AREAS } from "../config/env.js";

export function createHealthRouter({ config }) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    const pyCheck = spawnSync(
      config.pythonBin,
      ["-c", "import importlib.util, sys; print(sys.version.split()[0], bool(importlib.util.find_spec('lxml')))"],
      { encoding: "utf8" }
    );
    const [pyVersion, lxmlReady] = (pyCheck.stdout || "").trim().split(" ");
    res.json({
      success: true,
      nodeVersion: process.version,
      pythonBin: config.pythonBin,
      pythonVersion: pyVersion || null,
      lxmlReady: lxmlReady === "True",
      hasGoogleMapsApiKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      adapters: [
        "sewakost",
        "rukita",
        "mamikos",
        "infokost",
        "cove",
        "djuragankamar",
        "rumah123",
        "kostjakarta",
      ],
    });
  });

  router.get("/presets", (_req, res) => {
    res.json({
      success: true,
      areas: PRESET_AREAS,
      landmarks: LANDMARK_REFS,
      adapters: [
        { id: "sewakost", label: "Sewakost.com", supportsPriceFilter: true, supportsGeo: false },
        { id: "rukita", label: "Rukita.co", supportsPriceFilter: false, supportsGeo: true },
        { id: "mamikos", label: "Mamikos.com", supportsPriceFilter: true, supportsGeo: true },
        { id: "infokost", label: "Infokost.id", supportsPriceFilter: false, supportsGeo: true },
        { id: "cove", label: "Cove.id", supportsPriceFilter: false, supportsGeo: true },
        { id: "djuragankamar", label: "DjuraganKamar.com", supportsPriceFilter: false, supportsGeo: true },
        { id: "rumah123", label: "Rumah123.com", supportsPriceFilter: true, supportsGeo: true },
        { id: "kostjakarta", label: "KostJakarta.com", supportsPriceFilter: false, supportsGeo: false },
      ],
      blockedNote:
        "99.co (Cloudflare 403), Trovit (HTTP 401), Papikost (HTTP 403/kosong), IdKos (timeout/404) & JajanKost (Jogja/Jatim saja, /search 500) tidak di-bypass.",
    });
  });

  return router;
}

