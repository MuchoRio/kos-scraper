#!/usr/bin/env node
/** Headless Chrome runner for Mamikos /cari dynamic Vuex room discovery. */

import { launchSystemBrowser } from "./chrome_launcher.mjs";

const AREA_LABELS = {
  "jakarta-selatan": "Jakarta Selatan",
  "jakarta-pusat": "Jakarta Pusat",
  "jakarta-barat": "Jakarta Barat",
  "jakarta-timur": "Jakarta Timur",
  "jakarta-utara": "Jakarta Utara",
  "depok": "Depok",
  "tangerang": "Tangerang",
  "bekasi": "Bekasi",
  "bandung": "Bandung",
};

const NON_LOCATION_WORDS = new Set([
  "pasutri", "bebas", "sopan", "texas", "pet", "cat", "dog", "kucing", "anjing",
  "wifi", "dapur", "km", "kamar", "mandi", "dalam", "luar", "under", "sejuta",
  "exclusive", "eksklusif", "transum", "mrt", "tj", "transjakarta", "krl",
  "halte", "stasiun", "ac", "putri", "putra", "campur", "murah", "parkir",
  "motor", "mobil", "bulanan", "harian", "24", "jam", "free", "non",
]);

function parseArgs(argv) {
  const args = { area: "jakarta-selatan", keywords: "", maxPrice: 0, sort: "price", order: "asc", limit: 40, timeout: 45000 };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--area" && v) args.area = v;
    else if (k === "--keywords" && v !== undefined) args.keywords = v;
    else if (k === "--max-price" && v) args.maxPrice = Number(v) || 0;
    else if (k === "--sort" && v) args.sort = v;
    else if (k === "--order" && v) args.order = v;
    else if (k === "--limit" && v) args.limit = Math.max(1, Math.min(80, Number(v) || 40));
    else if (k === "--timeout" && v) args.timeout = Math.max(10000, Number(v) || 45000);
  }
  return args;
}

function areaSlugToLabel(area) {
  return AREA_LABELS[area] || area.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSearchQueries(area, keywordsCsv) {
  const areaLabel = areaSlugToLabel(area);
  const queries = [];
  const rawKws = String(keywordsCsv || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const kw of rawKws) {
    const tokens = kw.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.every((t) => NON_LOCATION_WORDS.has(t))) continue;
    const cleaned = tokens.filter((t) => !NON_LOCATION_WORDS.has(t)).join(" ");
    if (cleaned.length < 3) continue;
    const q = cleaned.includes("jakarta") ? cleaned : `${cleaned} ${areaLabel}`;
    if (!queries.some((x) => x.toLowerCase() === q.toLowerCase())) queries.push(q);
    if (queries.length >= 2) break;
  }
  if (!queries.some((x) => x.toLowerCase() === areaLabel.toLowerCase())) queries.push(areaLabel);
  return queries;
}

function parsePriceIdr(label, numHint) {
  if (typeof numHint === "number" && numHint >= 100000) return Math.round(numHint);
  const digits = String(label || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function normalizeUrl(raw) {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw.split("?")[0];
  if (raw.startsWith("/")) return `https://mamikos.com${raw.split("?")[0]}`;
  return `https://mamikos.com/room/${raw.replace(/^\/+/, "").split("?")[0]}`;
}

async function applyVuexFilters(page, { maxPrice, sort, order }) {
  return page.evaluate(async ({ maxPrice: mp, sort: s, order: o }) => {
    const store = document.querySelector("#app")?.__vue__?.$store;
    if (!store) return { ok: false, reason: "no_store" };
    const findAction = (name) => Object.keys(store._actions || {}).find((k) => k === name || k.endsWith(`/${name}`));
    const filterAct = findAction("settingFilter");
    const sortAct = findAction("settingSort");
    const fetchAct = findAction("fetchRooms");
    if (!fetchAct) return { ok: false, reason: "no_fetch_action" };
    if (mp > 0 && filterAct) await store.dispatch(filterAct, { price_range: [100000, mp] });
    if ((s === "price" || mp > 0) && sortAct) {
      await store.dispatch(sortAct, ["price", o === "desc" ? "desc" : "asc"]);
    }
    await store.dispatch(fetchAct);
    return { ok: true };
  }, { maxPrice, sort, order });
}

async function readVuexState(page) {
  return page.evaluate(() => {
    const st = document.querySelector("#app")?.__vue__?.$store?.state;
    if (!st) return { loading: true, total: 0, cards: [] };
    const cards = st.roomCards || st.kos?.roomCards || [];
    const total = st.totalRooms ?? st.kos?.totalRooms ?? cards.length;
    const loading = Boolean(st.isLoading ?? st.kos?.isLoading);
    return { loading, total, cards: cards.map((e) => e?.data || e).filter(Boolean) };
  });
}

async function queryLocation(page, query, areaLabel, opts, cap) {
  await page.goto("https://mamikos.com/cari", { waitUntil: "domcontentloaded", timeout: opts.timeout });
  await page.locator(".btn-cta-search:visible").first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".btn-cta-search:visible").first().click();

  const input = page.locator('input[type="search"]:visible, input[type="text"]:visible, input:not([type="hidden"]):visible').first();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(query);

  const results = page.locator(".results-list:visible");
  try {
    await results.first().waitFor({ state: "visible", timeout: 9000 });
  } catch {
    return { total: 0, cards: [] };
  }

  const areaWord = areaLabel.split(" ")[0];
  const preferred = results.filter({ hasText: new RegExp(areaWord, "i") }).first();
  const pick = (await preferred.count()) ? preferred : results.first();
  const prevUrl = page.url();
  await Promise.all([
    page.waitForURL((u) => u.toString() !== prevUrl, { timeout: 12000 }).catch(() => {}),
    pick.click(),
  ]);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForFunction(() => {
    const st = document.querySelector("#app")?.__vue__?.$store?.state;
    return Boolean(st && !(st.isLoading ?? st.kos?.isLoading));
  }, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  await applyVuexFilters(page, opts);
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const st = document.querySelector("#app")?.__vue__?.$store?.state;
    return st && !(st.isLoading ?? st.kos?.isLoading);
  }, { timeout: 12000 }).catch(() => {});

  let snap = await readVuexState(page);
  for (let clickIdx = 0; clickIdx < 2 && snap.cards.length < cap && snap.cards.length < snap.total; clickIdx += 1) {
    const moreBtn = page.locator('button:has-text("Lihat lebih banyak"):visible, a:has-text("Lihat lebih banyak"):visible').first();
    if (!(await moreBtn.count())) break;
    const before = snap.cards.length;
    await moreBtn.click();
    await page.waitForFunction((n) => {
      const st = document.querySelector("#app")?.__vue__?.$store?.state;
      return (st?.roomCards || st?.kos?.roomCards || []).length > n;
    }, before, { timeout: 9000 }).catch(() => {});
    snap = await readVuexState(page);
  }
  return snap;
}

function mapCard(c) {
  const url = normalizeUrl(c.share_url || c.slug || c._id);
  const title = String(c["room-title"] || c.room_title || c.name || "").trim();
  if (!url || !title) return null;
  const price = parsePriceIdr(c.priceLabelOnly, c.price_title_format?.discount_price || c.price_title_format?.price);
  return {
    title,
    url,
    price,
    price_label: c.priceLabelOnly || "",
    gender: c.propertyGender ?? c.gender ?? null,
    subdistrict: c.subdistrict || "",
    area_label: c.area_label || "",
    city: c.city || "",
    top_facilities: Array.isArray(c.topFacilities) ? c.topFacilities : [],
    labels: Array.isArray(c.label_array) ? c.label_array.map((x) => x?.label || x).filter(Boolean) : [],
    photo_url: c.photo_url?.large || c.photo_url?.medium || c.photo_url?.small || null,
    rating: c.rating_string ?? c.rating ?? null,
    review_count: c.review_count ?? null,
    is_featured: Boolean(c.is_featured),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const areaLabel = areaSlugToLabel(opts.area);
  const queries = buildSearchQueries(opts.area, opts.keywords);
  const browser = await launchSystemBrowser({
    extraArgs: ["--disable-features=LocalNetworkAccessChecks"],
  });
  const seen = new Set();
  const items = [];
  let maxTotal = 0;

  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "id-ID",
      timezoneId: "Asia/Jakarta",
    });
    const page = await ctx.newPage();
    const perQueryCap = Math.max(20, Math.ceil(opts.limit / queries.length) + 10);

    for (const q of queries) {
      if (items.length >= opts.limit) break;
      const snap = await queryLocation(page, q, areaLabel, opts, perQueryCap);
      maxTotal = Math.max(maxTotal, Number(snap.total || 0));
      for (const raw of snap.cards || []) {
        const mapped = mapCard(raw);
        if (!mapped || seen.has(mapped.url)) continue;
        if (opts.maxPrice > 0 && mapped.price > 0 && mapped.price > opts.maxPrice) continue;
        seen.add(mapped.url);
        items.push(mapped);
        if (items.length >= opts.limit) break;
      }
    }
    process.stdout.write(JSON.stringify({ status: "ok", queries, total: maxTotal, items }) + "\n");
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ status: "error", message: String(err?.message || err), items: [] }) + "\n");
  process.exit(1);
});
