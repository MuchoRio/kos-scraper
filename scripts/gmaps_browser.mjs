import { launchSystemBrowser } from "./chrome_launcher.mjs";

const REAL_PHOTO_PATH_RE =
  /^https:\/\/lh[345]\.googleusercontent\.com\/(?:p|gps-cs-s|gps-proxy|grass-cs|places|ci)\/[A-Za-z0-9_-]{20,}$/i;
const REAL_PHOTO_SCAN_G =
  /https:\/\/lh[345]\.googleusercontent\.com\/(?:p|gps-cs-s|gps-proxy|grass-cs|places|ci)\/[A-Za-z0-9_-]{20,}(?:=[A-Za-z0-9_-]+)?/gi;

function normalizeGmapsPhotoUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\\u003d/gi, "=");
  if (!trimmed || /\/a\/|AAAAAAAAAAI|streetviewpixels|default_geocode|staticmap/i.test(trimmed)) {
    return null;
  }
  const base = trimmed.split("=")[0];
  if (!REAL_PHOTO_PATH_RE.test(base)) return null;
  return `${base}=w960-h720-k-no`;
}

function collectNormalizedPhotos(rawList, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const raw of rawList) {
    const norm = normalizeGmapsPhotoUrl(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
    if (out.length >= limit) break;
  }
  return out;
}

function parseCliArgs(argv) {
  let query = "";
  let url = "";
  let timeoutMs = 20000;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--query" && argv[i + 1]) query = argv[i + 1];
    if (argv[i] === "--url" && argv[i + 1]) url = argv[i + 1];
    if (argv[i] === "--timeout" && argv[i + 1]) timeoutMs = Number(argv[i + 1]) || 20000;
  }
  return { query, url, timeoutMs };
}

function parseCoordsFromUrl(url) {
  const mBang = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url || "");
  if (mBang) return { lat: Number(mBang[1]), lon: Number(mBang[2]) };
  const mAt = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url || "");
  if (mAt) return { lat: Number(mAt[1]), lon: Number(mAt[2]) };
  const mQ = /[?&]q=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i.exec(url || "");
  if (mQ) return { lat: Number(mQ[1]), lon: Number(mQ[2]) };
  return { lat: null, lon: null };
}

async function scrapeGoogleMapsPlace({ query, url }, timeoutMs) {
  const browser = await launchSystemBrowser();
  try {
    const context = await browser.newContext({
      locale: "id-ID",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const xhrPhotoMatches = [];
    page.on("response", async (res) => {
      const resUrl = res.url();
      if (!/maps\/preview\/place|listugcposts|photometa/.test(resUrl)) return;
      const txt = await res.text().catch(() => "");
      const found = txt.match(REAL_PHOTO_SCAN_G);
      if (found) xhrPhotoMatches.push(...found);
    });

    const targetUrl =
      url && url.startsWith("http")
        ? url
        : `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=id`;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    const bodyCheck = await page.locator("body").textContent().catch(() => "");
    if (/sorry\/index|unusual traffic/i.test(page.url()) || /unusual traffic/i.test(bodyCheck || "")) {
      return { status: "blocked", reason: "Google rate limit / CAPTCHA check", reviews: [], photos: [] };
    }

    // Wait briefly for search results list or direct place heading
    await page.waitForSelector('div[role="feed"] a[href*="/maps/place/"], a.hfpxzc[href*="/maps/place/"], a[href*="/maps/place/"], h1', { timeout: 10000 }).catch(() => {});
    const feedFirst = page.locator('div[role="feed"] a[href*="/maps/place/"], a.hfpxzc[href*="/maps/place/"]').first();
    const fallbackFirst = page.locator('a[href*="/maps/place/"]').first();
    const firstPlace = (await feedFirst.count()) ? feedFirst : fallbackFirst;
    const usedFeed = (await firstPlace.count()) > 0;
    let placeHref = null;
    if (usedFeed) {
      xhrPhotoMatches.length = 0;
      placeHref = await firstPlace.getAttribute("href").catch(() => null);
      await firstPlace.click();
      await page.waitForFunction(() => {
        const hs = Array.from(document.querySelectorAll("h1")).map((e) => e.textContent?.trim() || "");
        return hs.some((t) => t && !/^(hasil|results)$/i.test(t));
      }, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2200);
    } else {
      await page.waitForFunction(() => /@(-?\d+\.\d+),(-?\d+\.\d+)/.test(location.href), { timeout: 2200 }).catch(() => {});
      await page.waitForTimeout(1800);
    }

    const extracted = await page.evaluate((includeAppState) => {
      const h1List = Array.from(document.querySelectorAll("h1"))
        .map((e) => e.textContent?.trim() || "")
        .filter(Boolean);
      const h1Duw = document.querySelector("h1.DUwDvf")?.textContent?.trim() || "";
      const h1 =
        (h1Duw && !/^(hasil|results)$/i.test(h1Duw) ? h1Duw : null) ||
        h1List.find((t) => !/^(hasil|results)$/i.test(t)) ||
        h1List[0] ||
        null;

      const mains = Array.from(document.querySelectorAll('[role="main"]'));
      const panel =
        (h1 && mains.find((m) => (m.getAttribute("aria-label") || "").trim() === h1)) ||
        mains.find((m) => {
          const ph = m.querySelector("h1")?.textContent?.trim() || "";
          return ph && !/^(hasil|results)$/i.test(ph);
        }) ||
        mains[mains.length - 1] ||
        document.body;

      const bodyText = (panel && panel.innerText) || document.body.innerText || "";
      const limitedView =
        document.body.innerText.includes("tampilan terbatas") ||
        document.body.innerText.toLowerCase().includes("limited view");

      const starNodes = Array.from(
        (panel || document).querySelectorAll('[aria-label*="bintang"], [aria-label*="star"]')
      );
      let rating = null;
      let reviewCount = null;
      for (const el of starNodes) {
        const label = el.getAttribute("aria-label") || "";
        const mRating = /(\d+[.,]\d+|\d)\s*(?:bintang|stars?)/i.exec(label);
        if (mRating && rating === null) {
          rating = Number(mRating[1].replace(",", "."));
        }
      }
      const mCount = /(\d+(?:[.,]\d+)?)\s*(?:ulasan|reviews?)/i.exec(bodyText);
      if (mCount) {
        reviewCount = Number(mCount[1].replace(/\D/g, ""));
      }

      const photoRe = /https:\/\/lh[345]\.googleusercontent\.com\/(?:p|gps-cs-s|gps-proxy|grass-cs|places|ci)\/[A-Za-z0-9_-]{20,}(?:=[A-Za-z0-9_-]+)?/gi;
      const rawPhotos = [];
      const rootScope = panel || document;
      for (const img of rootScope.querySelectorAll('button.aoRNLd img, button[jsaction*="heroHeaderImage"] img, img')) {
        const s = img.currentSrc || img.getAttribute("src");
        if (s) rawPhotos.push(s);
      }
      for (const el of rootScope.querySelectorAll('[style*="background-image"]')) {
        const m = (el.getAttribute("style") || "").match(photoRe);
        if (m) rawPhotos.push(...m);
      }
      const panelMatches = (panel?.innerHTML || "").match(photoRe);
      if (panelMatches) rawPhotos.push(...panelMatches);
      if (includeAppState && window.APP_INITIALIZATION_STATE) {
        const stateMatches = JSON.stringify(window.APP_INITIALIZATION_STATE).match(photoRe);
        if (stateMatches) rawPhotos.push(...stateMatches);
      }

      const revTab = document.querySelector(
        'button[role="tab"][aria-label*="Ulasan"], button[role="tab"][aria-label*="Reviews"]'
      );

      return { h1, rating, reviewCount, limitedView, hasReviewTab: Boolean(revTab), rawPhotos };
    }, !usedFeed);

    let reviews = [];
    const reviewPhotos = [];
    if (extracted.hasReviewTab && !extracted.limitedView) {
      const revTab = page
        .locator('button[role="tab"][aria-label*="Ulasan"], button[role="tab"][aria-label*="Reviews"]')
        .first();
      await revTab.click().catch(() => {});
      await page.waitForTimeout(2000);
      const revData = await page.locator("[data-review-id]").evaluateAll((nodes) =>
        nodes.slice(0, 15).map((n) => {
          const starsRaw =
            n.querySelector('span[role="img"][aria-label]')?.getAttribute("aria-label") || "";
          const mStar = /(\d+[.,]\d+|\d)/.exec(starsRaw);
          const imgs = [];
          for (const el of n.querySelectorAll('button[data-photo-index], [style*="background-image"], img')) {
            const st = el.getAttribute("style") || "";
            const mBg = /url\(["']?(https?:\/\/[^"'\s)]+)/.exec(st);
            const u = el.tagName === "IMG" ? (el.currentSrc || el.getAttribute("src")) : mBg?.[1];
            if (u) imgs.push(u);
          }
          return {
            author: n.querySelector(".d4r55")?.textContent?.trim() || "Pengulas Google",
            rating: mStar ? Number(mStar[1].replace(",", ".")) : null,
            relative_time: n.querySelector(".rsqaWe")?.textContent?.trim() || "",
            text: n.querySelector(".wiI7pd")?.textContent?.trim() || "",
            imgs,
          };
        })
      );
      for (const r of revData) {
        if (Array.isArray(r.imgs)) reviewPhotos.push(...r.imgs);
        reviews.push({ author: r.author, rating: r.rating, relative_time: r.relative_time, text: r.text });
      }
    }

    const finalUrl = page.url();
    const resolvedMapsUrl = finalUrl.includes("/maps/place/") ? finalUrl : placeHref || finalUrl;
    let { lat, lon } = parseCoordsFromUrl(resolvedMapsUrl);
    if (lat === null || lon === null) {
      const ogImg = await page.locator('meta[property="og:image"], meta[itemprop="image"]').first().getAttribute("content").catch(() => "");
      const mMeta = /center=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i.exec(ogImg || "");
      if (mMeta) {
        lat = Number(mMeta[1]);
        lon = Number(mMeta[2]);
      }
    }
    const photos = collectNormalizedPhotos([...extracted.rawPhotos, ...xhrPhotoMatches, ...reviewPhotos], 8);
    return {
      status: "ok",
      engine: "chrome_browser",
      place_name: extracted.h1,
      rating: extracted.rating,
      review_count: extracted.reviewCount,
      limited_view: extracted.limitedView,
      maps_url: resolvedMapsUrl,
      lat,
      lon,
      photos,
      reviews: reviews.filter((r) => r.text || r.rating),
    };
  } finally {
    await browser.close();
  }
}

const { query, url, timeoutMs } = parseCliArgs(process.argv.slice(2));
if (!query && !url) {
  console.log(JSON.stringify({ status: "error", reason: "Missing --query or --url", reviews: [] }));
  process.exit(0);
}

scrapeGoogleMapsPlace({ query, url }, timeoutMs)
  .then((res) => console.log(JSON.stringify(res)))
  .catch((err) => {
    console.log(JSON.stringify({ status: "error", reason: err.message, reviews: [] }));
    process.exit(0);
  });
