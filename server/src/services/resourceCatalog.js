import fs from "node:fs";
import path from "node:path";
import { AppError } from "../utils/validation.js";

export const GOOGLE_DOC_OR_SHEET_RE =
  /^https:\/\/docs\.google\.com\/(?:spreadsheets|document)\/d\/[a-zA-Z0-9_-]{15,}(?:\/[^\s]*)?$/i;

function catalogPath(dataDir) {
  return path.join(dataDir, "resource_catalog.json");
}

function inferKind(url) {
  return String(url).includes("/document/") ? "doc" : "sheet";
}

function readEnvPresets() {
  const raw = process.env.RESOURCE_CATALOG_JSON;
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLocalCatalog(dataDir) {
  const file = catalogPath(dataDir);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEntries(entries, readonly = false) {
  const out = [];
  for (const ent of entries) {
    if (!ent || typeof ent !== "object") continue;
    const id = String(ent.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    const label = String(ent.label || "").trim();
    const url = String(ent.url || "").trim();
    if (!id || !label || !GOOGLE_DOC_OR_SHEET_RE.test(url)) continue;
    out.push({ id, label, url, kind: inferKind(url), readonly });
  }
  return out;
}

function loadMergedCatalog(dataDir) {
  const local = normalizeEntries(readLocalCatalog(dataDir), false);
  const envEntries = normalizeEntries(readEnvPresets(), true);
  const seen = new Set();
  const merged = [];
  for (const item of [...local, ...envEntries]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

/** Public metadata only — raw Google Sheet/Doc URLs stay strictly server-side. */
export function listPublicPresets(dataDir) {
  return loadMergedCatalog(dataDir).map(({ id, label, kind }) => ({ id, label, kind }));
}

export function resolveCatalogEntry(dataDir, presetId) {
  const cleanId = String(presetId || "").trim().toLowerCase();
  const found = loadMergedCatalog(dataDir).find((e) => e.id === cleanId);
  if (!found) {
    throw new AppError("Sumber database server tidak ditemukan.", 404);
  }
  return found;
}

export function saveCatalogPreset(dataDir, { label, url }) {
  const cleanLabel = String(label || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const cleanUrl = String(url || "").trim();
  if (!cleanLabel) {
    throw new AppError("Nama sumber database wajib diisi.", 400);
  }
  if (!GOOGLE_DOC_OR_SHEET_RE.test(cleanUrl)) {
    throw new AppError("URL harus berupa link publik Google Sheets atau Google Docs.", 400);
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const existing = normalizeEntries(readLocalCatalog(dataDir), false);
  const baseSlug = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sumber";
  let slug = baseSlug;
  let seq = 2;
  while (existing.some((e) => e.id === slug)) {
    slug = `${baseSlug}-${seq}`;
    seq += 1;
  }
  const next = [
    ...existing.map(({ id, label: l, url: u }) => ({ id, label: l, url: u })),
    { id: slug, label: cleanLabel, url: cleanUrl },
  ];
  fs.writeFileSync(catalogPath(dataDir), JSON.stringify(next, null, 2), "utf8");
  return {
    preset: { id: slug, label: cleanLabel, kind: inferKind(cleanUrl) },
    presets: listPublicPresets(dataDir),
  };
}

export function deleteCatalogPreset(dataDir, rawId) {
  const cleanId = String(rawId || "").trim().toLowerCase();
  const existing = normalizeEntries(readLocalCatalog(dataDir), false);
  const filtered = existing.filter((e) => e.id !== cleanId);
  if (filtered.length === existing.length) {
    throw new AppError("Preset database server tidak ditemukan atau hanya baca.", 404);
  }
  fs.writeFileSync(
    catalogPath(dataDir),
    JSON.stringify(filtered.map(({ id, label, url }) => ({ id, label, url })), null, 2),
    "utf8"
  );
  return { deleted: cleanId, presets: listPublicPresets(dataDir) };
}

