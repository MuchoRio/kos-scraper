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
      adapters: ["sewakost", "rukita", "mamikos", "infokost", "cove"],
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
        { id: "mamikos", label: "Mamikos.com", supportsPriceFilter: false, supportsGeo: false },
        { id: "infokost", label: "Infokost.id", supportsPriceFilter: false, supportsGeo: true },
        { id: "cove", label: "Cove.id", supportsPriceFilter: false, supportsGeo: false },
      ],
      blockedNote: "99.co/id diblokir verifikasi bot Cloudflare (HTTP 403) dan tidak di-bypass.",
    });
  });

  return router;
}

