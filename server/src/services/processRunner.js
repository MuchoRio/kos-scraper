import path from "node:path";

export function buildPythonArgs(rootDir, dataDir, options) {
  const scriptPath = path.join(rootDir, "kos_scraper.py");
  if (options.kind === "resource") {
    const args = [
      scriptPath,
      "analyze-resource",
      "--url", options.url,
      "--area", options.area,
      "--details", String(options.detailsLimit),
      "--concurrency", String(options.concurrency || 4),
      "--out-dir", dataDir,
      "--progress-jsonl",
    ];
    if (options.maxPrice) args.push("--max-price", String(options.maxPrice));
    if (options.keywords?.length > 0) args.push("--keyword", options.keywords.join(","));
    if (options.onlyAvailable) args.push("--only-available");
    if (options.includeUnpriced) args.push("--include-unpriced");
    if (options.deduplicate === false) args.push("--no-dedup");
    if (options.priceCategory) args.push("--price-category", options.priceCategory);
    if (options.availability) args.push("--availability", options.availability);
    if (options.quality) args.push("--quality", options.quality);
    if (options.gender) args.push("--gender", options.gender);
    if (options.pet) args.push("--pet", options.pet);
    if (options.geocode) args.push("--geocode");
    if (options.gmaps) args.push("--gmaps");
    if (options.refLat !== null && options.refLon !== null) {
      args.push("--ref-lat", String(options.refLat), "--ref-lon", String(options.refLon));
    }
    if (options.maskContact) args.push("--mask-contact");
    if (options.keepHistory) args.push("--keep-history");
    return args;
  }

  const args = [
    scriptPath,
    "hunt",
    "--sources", options.sources.join(","),
    "--area", options.area,
    "--max-pages", String(options.maxPages),
    "--details", String(options.detailsLimit),
    "--concurrency", String(options.concurrency || 4),
    "--sort", options.sort,
    "--order", options.order,
    "--out-dir", dataDir,
    "--progress-jsonl",
  ];
  if (options.maxPrice) args.push("--max-price", String(options.maxPrice));
  if (options.keywords.length > 0) args.push("--keyword", options.keywords.join(","));
  if (options.geocode) args.push("--geocode");
  if (options.gmaps) args.push("--gmaps");
  if (options.refLat !== null && options.refLon !== null) {
    args.push("--ref-lat", String(options.refLat), "--ref-lon", String(options.refLon));
  }
  if (options.maskContact) args.push("--mask-contact");
  if (options.keepHistory) args.push("--keep-history");
  return args;
}

export function terminateChildProcess(spawnFn, child) {
  if (!child) return;
  try {
    if (process.platform === "win32" && child.pid) {
      spawnFn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2000).unref();
    }
  } catch {
    // Process already exited
  }
}

