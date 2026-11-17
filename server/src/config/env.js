import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

export function resolveDataDir() {
  return process.env.KOS_DATA_DIR
    ? path.resolve(process.env.KOS_DATA_DIR)
    : path.join(ROOT_DIR, "hasil");
}

export const CLIENT_DIST_DIR = path.join(ROOT_DIR, "client", "dist");

export const PRESET_AREAS = [
  { slug: "jakarta-selatan", label: "Jakarta Selatan" },
  { slug: "jakarta-pusat", label: "Jakarta Pusat" },
  { slug: "jakarta-barat", label: "Jakarta Barat" },
  { slug: "jakarta-timur", label: "Jakarta Timur" },
  { slug: "jakarta-utara", label: "Jakarta Utara" },
  { slug: "depok", label: "Depok" },
  { slug: "tangerang-selatan", label: "Tangerang Selatan" },
  { slug: "bekasi", label: "Bekasi" },
  { slug: "bandung", label: "Bandung" },
  { slug: "yogyakarta", label: "Yogyakarta" },
];

export const LANDMARK_REFS = [
  { id: "blok-m", label: "MRT Blok M BCA", lat: -6.2443, lon: 106.7981 },
  { id: "cipete", label: "MRT Cipete Raya", lat: -6.2784, lon: 106.7973 },
  { id: "sudirman", label: "Stasiun Sudirman / Dukuh Atas", lat: -6.2008, lon: 106.8232 },
  { id: "kuningan", label: "Kuningan / Mega Kuningan", lat: -6.2297, lon: 106.8295 },
  { id: "kemang", label: "Kemang Raya", lat: -6.2608, lon: 106.8147 },
  { id: "ui-depok", label: "Kampus UI Depok", lat: -6.3606, lon: 106.8272 },
];

export function resolvePythonBinary() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPy = process.platform === "win32"
    ? path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    : path.join(ROOT_DIR, ".venv", "bin", "python3");
  const candidates = [];
  if (fs.existsSync(venvPy)) candidates.push(venvPy);
  candidates.push(...(process.platform === "win32" ? ["python", "python3"] : ["python3", "python"]));

  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) return bin;
  }
  return process.platform === "win32" ? "python" : "python3";
}

export function getServerConfig() {
  return {
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3001),
    rootDir: ROOT_DIR,
    dataDir: resolveDataDir(),
    clientDistDir: CLIENT_DIST_DIR,
    pythonBin: resolvePythonBinary(),
  };
}

