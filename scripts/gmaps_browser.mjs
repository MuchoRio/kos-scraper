import { launchSystemBrowser } from "./chrome_launcher.mjs";

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

    const targetUrl =
      url && url.startsWith("http")
        ? url
        : `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=id`;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    const bodyCheck = await page.locator("body").textContent().catch(() => "");
    if (/sorry\/index|unusual traffic/i.test(page.url()) || /unusual traffic/i.test(bodyCheck || "")) {
      return { status: "blocked", reason: "Google rate limit / CAPTCHA check", reviews: [] };
    }

    // Wait briefly for search results list or direct place heading
    await page.waitForSelector('a[href*="/maps/place/"], h1', { timeout: 10000 }).catch(() => {});
    const firstPlace = page.locator('a[href*="/maps/place/"]').first();
    let placeHref = null;
    if (await firstPlace.count()) {
      placeHref = await firstPlace.getAttribute("href").catch(() => null);
      await firstPlace.click();
      await page.waitForSelector("h1", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2200);
    } else {
      await page.waitForFunction(() => /@(-?\d+\.\d+),(-?\d+\.\d+)/.test(location.href), { timeout: 2200 }).catch(() => {});
    }

    const extracted = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim() || null;
      const bodyText = document.body.innerText || "";
      const limitedView =
        bodyText.includes("tampilan terbatas") || bodyText.toLowerCase().includes("limited view");

      const starNodes = Array.from(
        document.querySelectorAll('[aria-label*="bintang"], [aria-label*="star"]')
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

      const revTab = document.querySelector(
        'button[role="tab"][aria-label*="Ulasan"], button[role="tab"][aria-label*="Reviews"]'
      );

      return { h1, rating, reviewCount, limitedView, hasReviewTab: Boolean(revTab) };
    });

    let reviews = [];
    if (extracted.hasReviewTab && !extracted.limitedView) {
      const revTab = page
        .locator('button[role="tab"][aria-label*="Ulasan"], button[role="tab"][aria-label*="Reviews"]')
        .first();
      await revTab.click().catch(() => {});
      await page.waitForTimeout(2000);
      reviews = await page.locator("[data-review-id]").evaluateAll((nodes) =>
        nodes.slice(0, 15).map((n) => {
          const starsRaw =
            n.querySelector('span[role="img"][aria-label]')?.getAttribute("aria-label") || "";
          const mStar = /(\d+[.,]\d+|\d)/.exec(starsRaw);
          return {
            author: n.querySelector(".d4r55")?.textContent?.trim() || "Pengulas Google",
            rating: mStar ? Number(mStar[1].replace(",", ".")) : null,
            relative_time: n.querySelector(".rsqaWe")?.textContent?.trim() || "",
            text: n.querySelector(".wiI7pd")?.textContent?.trim() || "",
          };
        })
      );
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
