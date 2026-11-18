const ALLOWED_SOURCES = new Set([
  "sewakost",
  "rukita",
  "mamikos",
  "infokost",
  "cove",
  "djuragankamar",
  "rumah123",
  "kostjakarta",
]);
const AREA_SLUG_RE = /^[a-z0-9-]{2,60}$/;
const SAFE_FILENAME_RE = /^[a-zA-Z0-9_.-]+\.(json|csv)$/;
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function safeResultFilename(rawName) {
  const name = String(rawName || "").trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || !SAFE_FILENAME_RE.test(name)) {
    throw new AppError("Nama file hasil tidak valid.", 400);
  }
  return name;
}

export function validateJobPayload(body) {
  if (!body || typeof body !== "object") {
    throw new AppError("Payload job wajib berupa objek JSON.", 400);
  }

  const rawSources = Array.isArray(body.sources)
    ? body.sources
    : String(body.sources || "sewakost").split(",");
  const sources = [...new Set(rawSources.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
  if (sources.length === 0) {
    throw new AppError("Pilih minimal satu sumber data (sewakost / rukita).", 400);
  }
  for (const src of sources) {
    if (!ALLOWED_SOURCES.has(src)) {
      throw new AppError(`Sumber tidak dikenali: ${src}`, 400);
    }
  }

  const area = String(body.area || "jakarta-selatan").trim().toLowerCase();
  if (!AREA_SLUG_RE.test(area)) {
    throw new AppError("Format area hanya boleh huruf kecil, angka, dan tanda hubung.", 400);
  }

  let maxPrice = null;
  if (body.maxPrice !== null && body.maxPrice !== undefined && body.maxPrice !== "") {
    const parsed = Number(body.maxPrice);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000_000) {
      throw new AppError("Max harga harus berupa angka positif yang wajar.", 400);
    }
    maxPrice = Math.round(parsed);
  }

  const maxPages = Math.min(20, Math.max(1, Number.parseInt(body.maxPages ?? 5, 10) || 5));
  const detailsLimit = Math.min(60, Math.max(1, Number.parseInt(body.detailsLimit ?? 20, 10) || 20));
  const concurrency = Math.min(8, Math.max(1, Number.parseInt(body.concurrency ?? 4, 10) || 4));
  const sort = body.sort === "price" ? "price" : body.sort === "newest" ? "date" : "default";
  const order = body.order === "asc" ? "asc" : "desc";

  const rawKeywords = Array.isArray(body.keywords)
    ? body.keywords
    : String(body.keywords || "").split(",");
  const keywords = rawKeywords
    .map((k) => String(k).replace(/[^\p{L}\p{N}\s.-]/gu, "").trim())
    .filter(Boolean)
    .slice(0, 25);

  const geocode = Boolean(body.geocode);
  const gmaps = Boolean(body.gmaps);
  const maskContact = Boolean(body.maskContact);
  let refLat = null;
  let refLon = null;
  if (body.refLat !== null && body.refLat !== undefined && body.refLat !== "") {
    const lat = Number(body.refLat);
    const lon = Number(body.refLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new AppError("Koordinat referensi tidak valid.", 400);
    }
    refLat = lat;
    refLon = lon;
  }

  return {
    sources,
    area,
    maxPrice,
    maxPages,
    detailsLimit,
    concurrency,
    sort,
    order,
    keywords,
    geocode,
    gmaps,
    maskContact,
    refLat,
    refLon,
  };
}

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const safe = FORMULA_PREFIX_RE.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function maskPhoneValue(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 8) return "••••";
  return `${digits.slice(0, 4)}-••••-${digits.slice(-4)}`;
}

export function buildCsvContent(items, { maskContact = false } = {}) {
  const headers = [
    "sumber",
    "nama",
    "harga_min",
    "estimasi_harga_ulasan",
    "harga_mencurigakan",
    "risiko_penipuan",
    "sinyal_penipuan",
    "rating_gmaps",
    "jumlah_ulasan",
    "evaluasi_positif",
    "evaluasi_negatif",
    "tipe",
    "kecamatan",
    "kelurahan",
    "alamat",
    "jarak_km",
    "fasilitas",
    "pemilik",
    "telp",
    "hp",
    "wa",
    "wa_link",
    "gmaps_url",
    "link",
  ];
  const lines = [headers.join(",")];
  for (const item of items) {
    const telp = maskContact ? maskPhoneValue(item.telp) : (item.telp || "");
    const hp = maskContact ? maskPhoneValue(item.hp) : (item.hp || "");
    const wa = maskContact ? maskPhoneValue(item.wa) : (item.wa || "");
    const waLink = maskContact ? "" : (item.wa_link || "");
    const gm = item.gmaps && typeof item.gmaps === "object" ? item.gmaps : {};
    const scam = item.scam_risk && typeof item.scam_risk === "object" ? item.scam_risk : {};
    const pros = (gm.pros_summary || []).map((t) => `${t.tag} (${t.count})`).join("; ");
    const cons = (gm.cons_summary || []).map((t) => `${t.tag} (${t.count})`).join("; ");
    const row = [
      item.source || "",
      item.title || item.nama_kost || "",
      item.price ?? "",
      item.price_estimate_from_reviews ?? "",
      item.price_suspect ? "Ya" : "Tidak",
      scam.level || "low",
      (scam.signals || []).join("; "),
      gm.rating ?? "",
      gm.review_count ?? "",
      pros,
      cons,
      item.jenis || "",
      item.kecamatan || "",
      item.kelurahan || "",
      item.alamat || "",
      item.distance_km ?? "",
      String(item.fasilitas || "").slice(0, 200),
      item.nama_pemilik || "",
      telp,
      hp,
      wa,
      waLink,
      gm.maps_url || "",
      item.url || "",
    ].map(sanitizeCsvCell);
    lines.push(row.join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

